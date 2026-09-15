
from typing import Any, List,Optional
import json
import asyncio
from loguru import logger
from onesim.models import JsonBlockParser
from onesim.agent import GeneralAgent
from onesim.profile import AgentProfile
from onesim.memory import MemoryStrategy
from onesim.planning import PlanningBase
from onesim.events import *
from onesim.relationship import RelationshipManager
from .events import *


class ScenarioController(GeneralAgent):
    def __init__(self,
                 sys_prompt: str | None = None,
                 model_config_name: str = None,
                 event_bus_queue: asyncio.Queue = None,
                 profile: AgentProfile=None,
                 memory: MemoryStrategy=None,
                 planning: PlanningBase=None,
                 relationship_manager: RelationshipManager=None) -> None:
        super().__init__(sys_prompt, model_config_name, event_bus_queue, profile, memory, planning, relationship_manager)
        self.register_event("StartEvent", "LoadScenario")


    async def LoadScenario(self, event: Event) -> List[Event]:
        """
        Handler: ScenarioController.LoadScenario
        Topology: StartEvent 1:1
        Event Mappings:
          Trigger(输入门): any — 每个入边事件各自触发一次(不等待其它入边)
          Emit(输出): all — 满足时发出全部出边
          (1) StartEvent (from EnvAgent.start)
              => scenario_controller_load_scenario__new_employment_worker_discover_and_decide_round1 (to NewEmploymentWorker.DiscoverAndDecide_Round1)
              routing(发给谁): count:1 — 从本 event 关系候选里选 1 个 NewEmploymentWorker
        """
        # ========================= 第 1 步 · 读取状态 =========================
        # 决策前,先把「我是谁、此刻受什么外部干预、用什么语言、我自己的属性值」都读出来。
        #   · interventions / intervention:实验者可临时下发的「干预指令」(env 级)。若设了,会强制影响本次行为。
        #   · language:仿真语言,决定后面的提示词是否要求「用中文回复」。
        #   · 下方每个 self.get_data(...) 读的是【本 agent 自己的画像属性】(来自第三步 Agent 画像),
        #     这些值稍后会写进 observation,让 LLM「按人设」行动。
        # =====================================================================
        _interventions = await self.get_env_data('interventions', {})
        intervention = (_interventions or {}).get(self.profile.agent_type, '') if isinstance(_interventions, dict) else ''
        if not intervention:
            intervention = await self.get_env_data('intervention', '')
        _sim_language = await self.get_env_data('language', 'en')
        my_scenario_id = await self.get_data('my_scenario_id', "")
        # ===================== 第 2 步 · 读取「可发送对象」 =====================
        # 本动作要把消息发出去。对每一条「输出边」,先算出【合法的目标 id 列表 + 他们的画像】:
        #   · _target_ids_<事件名>:这条边【允许发往】的具体 agent 实例 id —— 严格来自第三步定义的关系/routing,
        #     绝不能乱发给没有关系的对象。
        #   · _target_info_<事件名>:这些目标的名字/描述/画像,供 LLM 挑选时参考(例如「投给最认可的候选人」)。
        # 下面每条边上方的 "# Routing: xxx" 注释,说明这条边到底怎么分发(见各自说明)。
        # =====================================================================
        # Routing: count —— 「定量挑选」:候选严格来自本事件的第三步关系,稍后由 LLM 从中挑出指定数量(见下方 instruction 里的『select exactly N』)。
        _target_ids = self.get_forward_candidates('scenario_controller_load_scenario__new_employment_worker_discover_and_decide_round1', "NewEmploymentWorker")
        _target_info = []
        for _rel in (self.relationship_manager.get_relationships_for_event('scenario_controller_load_scenario__new_employment_worker_discover_and_decide_round1') if getattr(self, 'relationship_manager', None) else []):
            _ti = _rel.target_info if isinstance(_rel.target_info, dict) else {}
            _target_info.append({
                "id": _rel.target_id,
                "name": _ti.get("name", ""),
                "description": (_ti.get("description") or _rel.description),
                "profile": {k: v for k, v in _ti.items() if k not in ("agent_type", "description")}
            })
        # ============= 第 3 步 · 构造 Observation(告诉 LLM「你看到的处境」)=============
        # 把发给大模型的「处境描述」一段段拼起来(_obs_parts 每个元素是一行):
        #   你是谁 → 当前任务与整条交互流程 → 收到的消息 → 你自己各属性的当前值 → (若有)干预指令 → 语言要求。
        # 这段文字相当于「此刻的世界状态」,让模型据此做出符合人设的决策。
        # =====================================================================
        _obs_parts = []
        _agent_name = self.profile.get_data("name", "") if hasattr(self.profile, "get_data") else ""
        if _agent_name:
            _obs_parts.append(f"You are {_agent_name} ({self.profile.agent_type}, ID: {self.profile_id}).")
        else:
            _obs_parts.append(f"You are {self.profile.agent_type} (ID: {self.profile_id}).")
        _obs_parts.append('Current situation: 加载仿真场景配置并初始化运行环境。 [Interaction context: (1) ScenarioController::LoadScenario →. 每次独立运行的第一轮必须令current_trust=initial_trust，且LoadScenario必须重新初始化metrics_container={records:[]}，保证S0—S3顺序运行时互不污染。]')
        _obs_parts.append(f"Event from: {event.from_agent_id}")
        if isinstance(locals().get('_arrival_payloads'), list) and _arrival_payloads:
            _obs_parts.append("")
            _obs_parts.append(f"Received batch payloads: {_arrival_payloads}")
        _obs_parts.append("")
        _obs_parts.append("Your current state:")
        _obs_parts.append(f"  my_scenario_id (当前仿真实验的场景标识符，决定AI辅助、透明反馈和非现金服务三个机制开关的组合(结构:enum ['S0', 'S1', 'S2', 'S3'])(取值范围:S0=无任何辅助；S1=仅AI辅助；S2=AI辅助+透明反馈；S3=AI辅助+透明反馈+按需非现金服务)(例:S2)): {my_scenario_id}")
        if intervention:
            _obs_parts.append("")
            _obs_parts.append(f"IMPORTANT — Intervention directive: {intervention}")
        if _sim_language == "zh":
            _obs_parts.insert(0, "【语言要求】请完全用中文回复，所有文本字段的值必须用中文，禁止中英混用。\n")
        observation = "\n".join(_obs_parts)
        # ============= 第 4 步 · 构造 Instruction(告诉 LLM「要你做什么」)=============
        # 把发给大模型的「任务指令」一段段拼起来(_inst_parts 每个元素是一行):
        #   你的具体任务 → 触发语义(这次为何被触发、要不要等齐别人) → 决策指导 →
        #   必须返回的 JSON 字段(含每个字段的含义) → 对每一类目标:可选的 id 列表 + 要选几个。
        # 最终要求模型【只返回一个规定字段齐全的 JSON】,供后续代码解析并据此发事件、写状态。
        # =====================================================================
        _inst_parts = []
        _inst_parts.append('You are a ScenarioController. Task: 加载仿真场景配置并初始化运行环境。 [Interaction context: (1) ScenarioController::LoadScenario →. 每次独立运行的第一轮必须令current_trust=initial_trust，且LoadScenario必须重新初始化metrics_container={records:[]}，保证S0—S3顺序运行时互不污染。]')
        _inst_parts.append('Executable trigger: trigger=any. This action fires once for each incoming event; do not wait for other arrivals. Waiting/aggregation is only valid for AND or at_least triggers.')
        _inst_parts.append('根据scenario_id严格映射到预定义的机制配置（S0-S3），确保ai_reporting_enabled、transparent_feedback_enabled和service_reward_enabled三个开关准确反映对应场景。初始化case_state和metrics_container为干净状态，避免跨场景污染，这是保证四组机制可比性的关键前提。')
        _inst_parts.append('Return a JSON object with your reasoning and decision.')
        _inst_parts.append("You must include a 'reasoning' field (string) explaining WHY you made this decision in 1-2 sentences.")
        _inst_parts.append('Return JSON with fields: reasoning, scenario_config(仿真场景配置对象，包含机制开关和三轮共用的固定问题集), case_state(案例状态容器，初始轮次为0且案例列表为空), metrics_container(指标记录容器，初始记录列表为空)')
        _inst_parts.append("Also return state update fields: my_scenario_config(当前场景的完整配置对象，包含机制开关、固定问题集等(结构:dict{scenario_id:str, ai_assisted:bool, transparent_feedback:bool, on_demand_service:bool, fixed_issue_set:list[dict]})(取值范围:所有字段必须符合机制定义；fixed_issue_set为三轮共用的问题列表，每项含location、issue_type、severity、is_emergency等)(例:{'scenario_id': 'S2', 'ai_assisted': True, 'transparent_feedback': True, 'on_demand_service': False, 'fixed_issue_set': [{'location': '朝阳区建国路88号', 'issue_type': '道路破损', 'severity': '中', 'is_emergency': False}]}))")
        if _sim_language == "zh":
            _inst_parts.insert(0, "【语言要求】请完全用中文回复，所有文本字段的值必须用中文撰写，禁止中英混用。")
        instruction = "\n".join(_inst_parts)
        instruction += f"\n\nAvailable target NewEmploymentWorker agents and their profiles: {_target_info}"
        instruction += f"\nValid target IDs (you MUST only return IDs from this list): {_target_ids}"
        instruction += "\nSelect exactly 1 target(s) for target_ids when at least 1 candidates are available. If fewer than 1 candidates are available, select all available candidates. Return UNIQUE ID(s) only; never repeat the same ID."
        instruction += "\nReturn target id field(s) as list(s) of ID strings ONLY."
        instruction += "\nYou MUST return a JSON object with exactly these top-level keys: reasoning, scenario_config, case_state, metrics_container, my_scenario_config, target_ids"

        result = {}
        _llm_ok = True
        try:
            result = await self.generate_reaction(instruction, observation)
        except ValueError as _llm_err:
            _llm_ok = False
            logger.warning(f"[LoadScenario] generate_reaction failed: {_llm_err}")
        if not isinstance(result, dict) or not result:
            _llm_ok = False
        if not _llm_ok:
            logger.error(
                f"[LoadScenario] LLM decision failed or empty for agent {self.profile_id}; "
                f"emitting NO event (an empty-payload event would silently corrupt downstream)"
            )
            return []
        # --- State writes ---
        def _coerce_state_dict(_value):
            if isinstance(_value, str):
                try:
                    _value = json.loads(_value)
                except (json.JSONDecodeError, ValueError, TypeError):
                    return {}
            return _value if isinstance(_value, dict) else {}

        def _merge_state_dict(_base, _incoming):
            _base = _coerce_state_dict(_base)
            _incoming = _coerce_state_dict(_incoming)
            _merged = dict(_base)
            for _key, _value in _incoming.items():
                if _value is None:
                    continue
                if isinstance(_value, dict) and isinstance(_merged.get(_key), dict):
                    _merged[_key] = _merge_state_dict(_merged.get(_key), _value)
                else:
                    _merged[_key] = _value
            return _merged
        _incoming_my_scenario_config = _coerce_state_dict(result.get('my_scenario_config', {}))
        _existing_my_scenario_config = _coerce_state_dict(await self.get_data('my_scenario_config', {}))
        _case_key_my_scenario_config = None
        for _case_field in ('dispute_id', 'case_id', 'application_id', 'request_id', 'submission_id', 'participant_id', 'patient_id', 'claim_id', 'complaint_id', 'incident_id', 'household_id', 'student_id', 'tenant_id', 'landlord_id'):
            _case_candidate = result.get(_case_field)
            if _case_candidate is None or isinstance(_case_candidate, bool):
                continue
            _case_candidate = str(_case_candidate)
            _case_key_my_scenario_config = _case_candidate
            break
        if _case_key_my_scenario_config:
            _case_patch_my_scenario_config = _incoming_my_scenario_config.get(_case_key_my_scenario_config, _incoming_my_scenario_config)
            _case_existing_my_scenario_config = _existing_my_scenario_config.get(_case_key_my_scenario_config, {})
            _existing_my_scenario_config[_case_key_my_scenario_config] = _merge_state_dict(_case_existing_my_scenario_config, _case_patch_my_scenario_config)
            await self.update_data('my_scenario_config', _existing_my_scenario_config)
        else:
            await self.update_data('my_scenario_config', _merge_state_dict(_existing_my_scenario_config, _incoming_my_scenario_config))
        # --- Event emission ---
        events_to_emit = []
        # Target: NewEmploymentWorker
        target_ids = result.get('target_ids', [])
        if target_ids is None:
            target_ids = []
        elif isinstance(target_ids, str):
            target_ids = [target_ids]
        elif isinstance(target_ids, (tuple, set)):
            target_ids = list(target_ids)
        elif not isinstance(target_ids, list):
            target_ids = [target_ids]
        if target_ids:
            target_ids = [str(_tid) for _tid in target_ids if _tid is not None and not isinstance(_tid, bool)]
            target_ids = list(dict.fromkeys(target_ids))
            # 无条件用候选池(已按目标类型过滤)约束 LLM 选的 target_ids:
            # 候选池为空 → 交集为空 → 该分支【不 emit】,绝不把 LLM 幻觉出的、不在候选池里的 id
            #（常是发送方自己 / 错类型实例)当合法目标发出。
            _valid_target_ids = set(str(_tid) for _tid in _target_ids if _tid is not None and not isinstance(_tid, bool))
            target_ids = [_tid for _tid in target_ids if _tid in _valid_target_ids]
        # Deduplicate and fill: ensure we reach requested count from candidates
        if _target_ids and len(target_ids) < 1:
            for _cid in _target_ids:
                if _cid is None or isinstance(_cid, bool):
                    continue
                _cid = str(_cid)
                if _cid not in target_ids:
                    target_ids.append(_cid)
                if len(target_ids) >= 1:
                    break
        if _target_ids and len(target_ids) > len(_target_ids):
            target_ids = [str(_tid) for _tid in _target_ids if _tid is not None and not isinstance(_tid, bool)]
        if not target_ids:
            if _target_ids:
                target_ids = [str(_tid) for _tid in _target_ids if _tid is not None and not isinstance(_tid, bool)]
            else:
                target_ids = []
        target_ids = target_ids[:1]  # enforce count:1
        for tid in target_ids:
            events_to_emit.append(scenario_controller_load_scenario__new_employment_worker_discover_and_decide_round1(
                self.profile_id, tid,
                scenario_config=self._coerce_value_to_schema_type(result.get('scenario_config', ""), 'dict'),
                case_state=self._coerce_value_to_schema_type(result.get('case_state', ""), 'dict'),
                metrics_container=self._coerce_value_to_schema_type(result.get('metrics_container', ""), 'dict'),
            ))
        return events_to_emit
