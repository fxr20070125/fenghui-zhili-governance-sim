
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


class NewEmploymentWorker(GeneralAgent):
    def __init__(self,
                 sys_prompt: str | None = None,
                 model_config_name: str = None,
                 event_bus_queue: asyncio.Queue = None,
                 profile: AgentProfile=None,
                 memory: MemoryStrategy=None,
                 planning: PlanningBase=None,
                 relationship_manager: RelationshipManager=None) -> None:
        super().__init__(sys_prompt, model_config_name, event_bus_queue, profile, memory, planning, relationship_manager)
        self.register_event("scenario_controller_load_scenario__new_employment_worker_discover_and_decide_round1", "DiscoverAndDecide_Round1")
        self.register_event("governance_workflow_process_round_round1__new_employment_worker_update_trust_and_record_round1", "UpdateTrustAndRecord_Round1")
        self.register_event("new_employment_worker_update_trust_and_record_round1__new_employment_worker_discover_and_decide_round2", "DiscoverAndDecide_Round2")
        self.register_event("governance_workflow_process_round_round2__new_employment_worker_update_trust_and_record_round2", "UpdateTrustAndRecord_Round2")
        self.register_event("new_employment_worker_update_trust_and_record_round2__new_employment_worker_discover_and_decide_round3", "DiscoverAndDecide_Round3")
        self.register_event("governance_workflow_process_round_round3__new_employment_worker_update_trust_and_record_round3", "UpdateTrustAndRecord_Round3")


    async def DiscoverAndDecide_Round1(self, event: Event) -> List[Event]:
        """
        Handler: NewEmploymentWorker.DiscoverAndDecide_Round1
        Topology: 1:1 trigger=any emit=all
        Event Mappings:
          Trigger(输入门): any — 每个入边事件各自触发一次(不等待其它入边)
          Emit(输出): all — 满足时发出全部出边
          (1) scenario_controller_load_scenario__new_employment_worker_discover_and_decide_round1 (from ScenarioController.LoadScenario)
              => new_employment_worker_discover_and_decide_round1__governance_workflow_process_round_round1 (to GovernanceWorkflow.ProcessRound_Round1)
              routing(发给谁): count:1 — 从本 event 关系候选里选 1 个 GovernanceWorkflow
        """
        # --- Event field extraction ---
        scenario_config = getattr(event, 'scenario_config', "")
        case_state = getattr(event, 'case_state', "")
        metrics_container = getattr(event, 'metrics_container', "")
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
        my_worker_profile = await self.get_data('my_worker_profile', {})
        if isinstance(my_worker_profile, str):
            try:
                my_worker_profile = json.loads(my_worker_profile)
            except (json.JSONDecodeError, ValueError):
                pass  # keep original string value
        # ===================== 第 2 步 · 读取「可发送对象」 =====================
        # 本动作要把消息发出去。对每一条「输出边」,先算出【合法的目标 id 列表 + 他们的画像】:
        #   · _target_ids_<事件名>:这条边【允许发往】的具体 agent 实例 id —— 严格来自第三步定义的关系/routing,
        #     绝不能乱发给没有关系的对象。
        #   · _target_info_<事件名>:这些目标的名字/描述/画像,供 LLM 挑选时参考(例如「投给最认可的候选人」)。
        # 下面每条边上方的 "# Routing: xxx" 注释,说明这条边到底怎么分发(见各自说明)。
        # =====================================================================
        # Routing: count —— 「定量挑选」:候选严格来自本事件的第三步关系,稍后由 LLM 从中挑出指定数量(见下方 instruction 里的『select exactly N』)。
        _target_ids = self.get_forward_candidates('new_employment_worker_discover_and_decide_round1__governance_workflow_process_round_round1', "GovernanceWorkflow")
        _target_info = []
        for _rel in (self.relationship_manager.get_relationships_for_event('new_employment_worker_discover_and_decide_round1__governance_workflow_process_round_round1') if getattr(self, 'relationship_manager', None) else []):
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
        _obs_parts.append('Current situation: 重置信任值，读取第一轮固定问题，决定是否上报并记录报告时间。 [Interaction context: (2) NewEmploymentWorker::DiscoverAndDecide_Round1 →. (4) NewEmploymentWorker::UpdateTrustAndRecord_Round1 →. (5) NewEmploymentWorker::DiscoverAndDecide_Round2 →. (7) NewEmploymentWorker::UpdateTrustAndRecord_Round2 →. (8) NewEmploymentWorker::DiscoverAndDecide_Round3 →]')
        _obs_parts.append(f"Event from: {event.from_agent_id}")
        _obs_parts.append("")
        _obs_parts.append("Received information:")
        _obs_parts.append(f"  scenario_config (仿真场景配置对象，包含机制开关和三轮共用的固定问题集): {scenario_config}")
        _obs_parts.append(f"  case_state (案例状态容器，初始轮次为0且案例列表为空): {case_state}")
        _obs_parts.append(f"  metrics_container (指标记录容器，初始记录列表为空): {metrics_container}")
        if isinstance(locals().get('_arrival_payloads'), list) and _arrival_payloads:
            _obs_parts.append("")
            _obs_parts.append(f"Received batch payloads: {_arrival_payloads}")
        _obs_parts.append("")
        _obs_parts.append("Your current state:")
        _obs_parts.append(f"  my_worker_profile (新就业从业者画像，包含初始信任值、职业类型、时间压力、照护压力、治理信任、隐私顾虑、服务需求、公民责任感、数字熟练度等固定属性(结构:dict{{worker_type:str, initial_trust:float, time_pressure:float, care_pressure:float, governance_trust:float, privacy_concern:float, service_need:float, civic_responsibility:float, digital_literacy:float, ...}})(取值范围:initial_trust ∈ [0,1]；其他压力/态度类变量 ∈ [0,1]；worker_type ∈ ['rider', 'driver'])(例:{{'worker_type': 'rider', 'initial_trust': 0.65, 'time_pressure': 0.8, 'care_pressure': 0.4, 'governance_trust': 0.65, 'privacy_concern': 0.7, 'service_need': 0.5, 'civic_responsibility': 0.6, 'digital_literacy': 0.75}})): {my_worker_profile}")
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
        _inst_parts.append('You are a NewEmploymentWorker. Task: 重置信任值，读取第一轮固定问题，决定是否上报并记录报告时间。 [Interaction context: (2) NewEmploymentWorker::DiscoverAndDecide_Round1 →. (4) NewEmploymentWorker::UpdateTrustAndRecord_Round1 →. (5) NewEmploymentWorker::DiscoverAndDecide_Round2 →. (7) NewEmploymentWorker::UpdateTrustAndRecord_Round2 →. (8) NewEmploymentWorker::DiscoverAndDecide_Round3 →]')
        _inst_parts.append('Executable trigger: trigger=any. This action fires once for each incoming event; do not wait for other arrivals. Waiting/aggregation is only valid for AND or at_least triggers.')
        _inst_parts.append('将所有从业者的current_trust重置为其initial_trust，体现每轮实验从相同信任基线开始。基于第一轮固定问题集，综合时间压力、照护负担、隐私顾虑、数字熟练度及初始信任，判断是否上报：高时间/照护压力或低信任者更可能沉默，而高公民责任感或数字熟练者更倾向报告。')
        _inst_parts.append('Return a JSON object with your reasoning and decision.')
        _inst_parts.append("You must include a 'reasoning' field (string) explaining WHY you made this decision in 1-2 sentences.")
        _inst_parts.append('Return JSON with fields: reasoning, worker_profile(更新后的从业者画像，包含重置的信任值和第一轮上报决策)')
        _inst_parts.append("Also return state update fields: my_worker_profile(新就业从业者画像，包含初始信任值、职业类型、时间压力、照护压力、治理信任、隐私顾虑、服务需求、公民责任感、数字熟练度等固定属性(结构:dict{worker_type:str, initial_trust:float, time_pressure:float, care_pressure:float, governance_trust:float, privacy_concern:float, service_need:float, civic_responsibility:float, digital_literacy:float, ...})(取值范围:initial_trust ∈ [0,1]；其他压力/态度类变量 ∈ [0,1]；worker_type ∈ ['rider', 'driver'])(例:{'worker_type': 'rider', 'initial_trust': 0.65, 'time_pressure': 0.8, 'care_pressure': 0.4, 'governance_trust': 0.65, 'privacy_concern': 0.7, 'service_need': 0.5, 'civic_responsibility': 0.6, 'digital_literacy': 0.75}))")
        if _sim_language == "zh":
            _inst_parts.insert(0, "【语言要求】请完全用中文回复，所有文本字段的值必须用中文撰写，禁止中英混用。")
        instruction = "\n".join(_inst_parts)
        instruction += f"\n\nAvailable target GovernanceWorkflow agents and their profiles: {_target_info}"
        instruction += f"\nValid target IDs (you MUST only return IDs from this list): {_target_ids}"
        instruction += "\nSelect exactly 1 target(s) for target_ids when at least 1 candidates are available. If fewer than 1 candidates are available, select all available candidates. Return UNIQUE ID(s) only; never repeat the same ID."
        instruction += "\nReturn target id field(s) as list(s) of ID strings ONLY."
        instruction += "\nYou MUST return a JSON object with exactly these top-level keys: reasoning, worker_profile, my_worker_profile, target_ids"

        result = {}
        _llm_ok = True
        try:
            result = await self.generate_reaction(instruction, observation)
        except ValueError as _llm_err:
            _llm_ok = False
            logger.warning(f"[DiscoverAndDecide_Round1] generate_reaction failed: {_llm_err}")
        if not isinstance(result, dict) or not result:
            _llm_ok = False
        if not _llm_ok:
            logger.error(
                f"[DiscoverAndDecide_Round1] LLM decision failed or empty for agent {self.profile_id}; "
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
        _incoming_my_worker_profile = _coerce_state_dict(result.get('my_worker_profile', {}))
        _existing_my_worker_profile = _coerce_state_dict(await self.get_data('my_worker_profile', {}))
        _case_key_my_worker_profile = None
        for _case_field in ('dispute_id', 'case_id', 'application_id', 'request_id', 'submission_id', 'participant_id', 'patient_id', 'claim_id', 'complaint_id', 'incident_id', 'household_id', 'student_id', 'tenant_id', 'landlord_id'):
            _case_candidate = result.get(_case_field)
            if _case_candidate is None or isinstance(_case_candidate, bool):
                continue
            _case_candidate = str(_case_candidate)
            _case_key_my_worker_profile = _case_candidate
            break
        if _case_key_my_worker_profile:
            _case_patch_my_worker_profile = _incoming_my_worker_profile.get(_case_key_my_worker_profile, _incoming_my_worker_profile)
            _case_existing_my_worker_profile = _existing_my_worker_profile.get(_case_key_my_worker_profile, {})
            _existing_my_worker_profile[_case_key_my_worker_profile] = _merge_state_dict(_case_existing_my_worker_profile, _case_patch_my_worker_profile)
            await self.update_data('my_worker_profile', _existing_my_worker_profile)
        else:
            await self.update_data('my_worker_profile', _merge_state_dict(_existing_my_worker_profile, _incoming_my_worker_profile))
        # --- Event emission ---
        events_to_emit = []
        # Target: GovernanceWorkflow
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
            events_to_emit.append(new_employment_worker_discover_and_decide_round1__governance_workflow_process_round_round1(
                self.profile_id, tid,
                scenario_config=self._coerce_value_to_schema_type(locals().get('scenario_config', result.get('scenario_config', "")), 'dict'),
                worker_profile=self._coerce_value_to_schema_type(result.get('worker_profile', ""), 'dict'),
                case_state=self._coerce_value_to_schema_type(locals().get('case_state', result.get('case_state', "")), 'dict'),
            ))
        return events_to_emit

    async def UpdateTrustAndRecord_Round1(self, event: Event) -> List[Event]:
        """
        Handler: NewEmploymentWorker.UpdateTrustAndRecord_Round1
        Topology: 1:1 trigger=any emit=all
        Event Mappings:
          Trigger(输入门): any — 每个入边事件各自触发一次(不等待其它入边)
          Emit(输出): all — 满足时发出全部出边
          (1) governance_workflow_process_round_round1__new_employment_worker_update_trust_and_record_round1 (from GovernanceWorkflow.ProcessRound_Round1)
              => new_employment_worker_update_trust_and_record_round1__new_employment_worker_discover_and_decide_round2 (to NewEmploymentWorker.DiscoverAndDecide_Round2)
              routing(发给谁): self — 发给自身(内部处理链,不受关系限制)
        """
        # --- Event field extraction ---
        scenario_config = getattr(event, 'scenario_config', "")
        worker_profile = getattr(event, 'worker_profile', "")
        case_state = getattr(event, 'case_state', "")
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
        # ===================== 第 2 步 · 读取「可发送对象」 =====================
        # 本动作要把消息发出去。对每一条「输出边」,先算出【合法的目标 id 列表 + 他们的画像】:
        #   · _target_ids_<事件名>:这条边【允许发往】的具体 agent 实例 id —— 严格来自第三步定义的关系/routing,
        #     绝不能乱发给没有关系的对象。
        #   · _target_info_<事件名>:这些目标的名字/描述/画像,供 LLM 挑选时参考(例如「投给最认可的候选人」)。
        # 下面每条边上方的 "# Routing: xxx" 注释,说明这条边到底怎么分发(见各自说明)。
        # =====================================================================
        # Routing: self —— 发给「我自己」(同一实例的内部处理链,不跨到别的 agent);目标就是本实例,无需候选列表。
        _target_ids = [str(self.profile_id)]
        _target_info = []  # self-target, no candidate list needed
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
        _obs_parts.append('Current situation: 根据处置结果更新信任值，并将本轮记录写入指标容器和从业者画像。 [Interaction context: (2) NewEmploymentWorker::DiscoverAndDecide_Round1 →. (4) NewEmploymentWorker::UpdateTrustAndRecord_Round1 →. (5) NewEmploymentWorker::DiscoverAndDecide_Round2 →. (7) NewEmploymentWorker::UpdateTrustAndRecord_Round2 →. (8) NewEmploymentWorker::DiscoverAndDecide_Round3 →]')
        _obs_parts.append(f"Event from: {event.from_agent_id}")
        _obs_parts.append("")
        _obs_parts.append("Received information:")
        _obs_parts.append(f"  scenario_config (仿真场景配置，包含机制开关和固定问题集): {scenario_config}")
        _obs_parts.append(f"  worker_profile (从业者画像，包含其类型、信任水平及本轮上报决策): {worker_profile}")
        _obs_parts.append(f"  case_state (第一轮案例处理后的完整状态，记录每条上报的应急判断、AI辅助处理（如适用）、人工审核、派单、反馈与奖励逻辑执行结果): {case_state}")
        if isinstance(locals().get('_arrival_payloads'), list) and _arrival_payloads:
            _obs_parts.append("")
            _obs_parts.append(f"Received batch payloads: {_arrival_payloads}")
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
        _inst_parts.append('You are a NewEmploymentWorker. Task: 根据处置结果更新信任值，并将本轮记录写入指标容器和从业者画像。 [Interaction context: (2) NewEmploymentWorker::DiscoverAndDecide_Round1 →. (4) NewEmploymentWorker::UpdateTrustAndRecord_Round1 →. (5) NewEmploymentWorker::DiscoverAndDecide_Round2 →. (7) NewEmploymentWorker::UpdateTrustAndRecord_Round2 →. (8) NewEmploymentWorker::DiscoverAndDecide_Round3 →]')
        _inst_parts.append('Executable trigger: trigger=any. This action fires once for each incoming event; do not wait for other arrivals. Waiting/aggregation is only valid for AND or at_least triggers.')
        _inst_parts.append('依据治理工作流返回的处置结果（如是否及时反馈、问题是否解决）更新每位从业者的current_trust：有效反馈和问题解决提升信任，无回应或敷衍处理则降低信任。同时将本轮上报行为、决策依据和结果完整记录至metrics_container和worker_profile，用于后续分析参与动态。')
        _inst_parts.append('Return a JSON object with your reasoning and decision.')
        _inst_parts.append("You must include a 'reasoning' field (string) explaining WHY you made this decision in 1-2 sentences.")
        _inst_parts.append('Return JSON with fields: reasoning, metrics_container(指标容器，已追加本轮完整记录)')
        _inst_parts.append("Also return state update fields: my_worker_profile(新就业从业者画像，包含初始信任值、职业类型、时间压力、照护压力、治理信任、隐私顾虑、服务需求、公民责任感、数字熟练度等固定属性(结构:dict{worker_type:str, initial_trust:float, time_pressure:float, care_pressure:float, governance_trust:float, privacy_concern:float, service_need:float, civic_responsibility:float, digital_literacy:float, ...})(取值范围:initial_trust ∈ [0,1]；其他压力/态度类变量 ∈ [0,1]；worker_type ∈ ['rider', 'driver'])(例:{'worker_type': 'rider', 'initial_trust': 0.65, 'time_pressure': 0.8, 'care_pressure': 0.4, 'governance_trust': 0.65, 'privacy_concern': 0.7, 'service_need': 0.5, 'civic_responsibility': 0.6, 'digital_literacy': 0.75}))")
        if _sim_language == "zh":
            _inst_parts.insert(0, "【语言要求】请完全用中文回复，所有文本字段的值必须用中文撰写，禁止中英混用。")
        instruction = "\n".join(_inst_parts)
        instruction += "\nYou MUST return a JSON object with exactly these top-level keys: reasoning, metrics_container, my_worker_profile"

        result = {}
        _llm_ok = True
        try:
            result = await self.generate_reaction(instruction, observation)
        except ValueError as _llm_err:
            _llm_ok = False
            logger.warning(f"[UpdateTrustAndRecord_Round1] generate_reaction failed: {_llm_err}")
        if not isinstance(result, dict) or not result:
            _llm_ok = False
        if not _llm_ok:
            logger.error(
                f"[UpdateTrustAndRecord_Round1] LLM decision failed or empty for agent {self.profile_id}; "
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
        _incoming_my_worker_profile = _coerce_state_dict(result.get('my_worker_profile', {}))
        _existing_my_worker_profile = _coerce_state_dict(await self.get_data('my_worker_profile', {}))
        _case_key_my_worker_profile = None
        for _case_field in ('dispute_id', 'case_id', 'application_id', 'request_id', 'submission_id', 'participant_id', 'patient_id', 'claim_id', 'complaint_id', 'incident_id', 'household_id', 'student_id', 'tenant_id', 'landlord_id'):
            _case_candidate = result.get(_case_field)
            if _case_candidate is None or isinstance(_case_candidate, bool):
                continue
            _case_candidate = str(_case_candidate)
            _case_key_my_worker_profile = _case_candidate
            break
        if _case_key_my_worker_profile:
            _case_patch_my_worker_profile = _incoming_my_worker_profile.get(_case_key_my_worker_profile, _incoming_my_worker_profile)
            _case_existing_my_worker_profile = _existing_my_worker_profile.get(_case_key_my_worker_profile, {})
            _existing_my_worker_profile[_case_key_my_worker_profile] = _merge_state_dict(_case_existing_my_worker_profile, _case_patch_my_worker_profile)
            await self.update_data('my_worker_profile', _existing_my_worker_profile)
        else:
            await self.update_data('my_worker_profile', _merge_state_dict(_existing_my_worker_profile, _incoming_my_worker_profile))
        # --- Event emission ---
        events_to_emit = []
        # Target: self (internal processing chain)
        events_to_emit.append(new_employment_worker_update_trust_and_record_round1__new_employment_worker_discover_and_decide_round2(
            self.profile_id, str(self.profile_id),
            scenario_config=self._coerce_value_to_schema_type(locals().get('scenario_config', result.get('scenario_config', "")), 'dict'),
            worker_profile=self._coerce_value_to_schema_type(locals().get('worker_profile', result.get('worker_profile', "")), 'dict'),
            case_state=self._coerce_value_to_schema_type(locals().get('case_state', result.get('case_state', "")), 'dict'),
            metrics_container=self._coerce_value_to_schema_type(result.get('metrics_container', ""), 'dict'),
        ))
        return events_to_emit

    async def DiscoverAndDecide_Round2(self, event: Event) -> List[Event]:
        """
        Handler: NewEmploymentWorker.DiscoverAndDecide_Round2
        Topology: 1:1 trigger=any emit=all
        Event Mappings:
          Trigger(输入门): any — 每个入边事件各自触发一次(不等待其它入边)
          Emit(输出): all — 满足时发出全部出边
          (1) new_employment_worker_update_trust_and_record_round1__new_employment_worker_discover_and_decide_round2 (from NewEmploymentWorker.UpdateTrustAndRecord_Round1)
              => new_employment_worker_discover_and_decide_round2__governance_workflow_process_round_round2 (to GovernanceWorkflow.ProcessRound_Round2)
              routing(发给谁): reply — 回发给工作流链上最近的发起者(不受关系限制)
        """
        # --- Event field extraction ---
        scenario_config = getattr(event, 'scenario_config', "")
        worker_profile = getattr(event, 'worker_profile', "")
        case_state = getattr(event, 'case_state', "")
        metrics_container = getattr(event, 'metrics_container', "")
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
        # ===================== 第 2 步 · 读取「可发送对象」 =====================
        # 本动作要把消息发出去。对每一条「输出边」,先算出【合法的目标 id 列表 + 他们的画像】:
        #   · _target_ids_<事件名>:这条边【允许发往】的具体 agent 实例 id —— 严格来自第三步定义的关系/routing,
        #     绝不能乱发给没有关系的对象。
        #   · _target_info_<事件名>:这些目标的名字/描述/画像,供 LLM 挑选时参考(例如「投给最认可的候选人」)。
        # 下面每条边上方的 "# Routing: xxx" 注释,说明这条边到底怎么分发(见各自说明)。
        # =====================================================================
        # Routing: reply —— 「回信」:发回给消息链上最近一个 GovernanceWorkflow(即谁发起的就回给谁)。
        #   同类型有 ≥2 个候选时,用 LLM 消歧挑出真正的发起者;失败则回退到最近一个。
        _rc = getattr(event, '_routing_context', {}) or {}
        _rc_ids = _rc.get("GovernanceWorkflow", [])
        if isinstance(_rc_ids, str): _rc_ids = [_rc_ids]
        _direct_reply_id = str(event.from_agent_id) if getattr(event, 'from_agent_type', None) == "GovernanceWorkflow" else ""
        if _direct_reply_id and _direct_reply_id not in _rc_ids: _rc_ids.append(_direct_reply_id)
        if len(_rc_ids) >= 2:
            _target_ids = await self._disambiguate_reply_target(_rc_ids, "GovernanceWorkflow", event)
        else:
            _target_ids = _rc_ids[-1:] if _rc_ids else []
        _target_info = []  # reply-target, no candidate list needed
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
        _obs_parts.append('Current situation: 基于当前信任值决定第二轮是否上报新发现的问题。 [Interaction context: (2) NewEmploymentWorker::DiscoverAndDecide_Round1 →. (4) NewEmploymentWorker::UpdateTrustAndRecord_Round1 →. (5) NewEmploymentWorker::DiscoverAndDecide_Round2 →. (7) NewEmploymentWorker::UpdateTrustAndRecord_Round2 →. (8) NewEmploymentWorker::DiscoverAndDecide_Round3 →]')
        _obs_parts.append(f"Event from: {event.from_agent_id}")
        _obs_parts.append("")
        _obs_parts.append("Received information:")
        _obs_parts.append(f"  scenario_config (仿真场景配置，包含机制开关和固定问题集): {scenario_config}")
        _obs_parts.append(f"  worker_profile (更新后的从业者画像，含本轮信任值更新和行为记录): {worker_profile}")
        _obs_parts.append(f"  case_state (第一轮案例处置状态，由治理工作流处理后生成): {case_state}")
        _obs_parts.append(f"  metrics_container (指标容器，已追加本轮完整记录): {metrics_container}")
        if isinstance(locals().get('_arrival_payloads'), list) and _arrival_payloads:
            _obs_parts.append("")
            _obs_parts.append(f"Received batch payloads: {_arrival_payloads}")
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
        _inst_parts.append('You are a NewEmploymentWorker. Task: 基于当前信任值决定第二轮是否上报新发现的问题。 [Interaction context: (2) NewEmploymentWorker::DiscoverAndDecide_Round1 →. (4) NewEmploymentWorker::UpdateTrustAndRecord_Round1 →. (5) NewEmploymentWorker::DiscoverAndDecide_Round2 →. (7) NewEmploymentWorker::UpdateTrustAndRecord_Round2 →. (8) NewEmploymentWorker::DiscoverAndDecide_Round3 →]')
        _inst_parts.append('Executable trigger: trigger=any. This action fires once for each incoming event; do not wait for other arrivals. Waiting/aggregation is only valid for AND or at_least triggers.')
        _inst_parts.append('基于第一轮后更新的current_trust值决定第二轮上报意愿：信任提升者更可能继续参与，信任受损者可能退出。同时仍需权衡当前轮次问题的紧急性、自身时间/照护压力及隐私顾虑，避免简单重复第一轮行为。')
        _inst_parts.append('Return a JSON object with your reasoning and decision.')
        _inst_parts.append("You must include a 'reasoning' field (string) explaining WHY you made this decision in 1-2 sentences.")
        if _sim_language == "zh":
            _inst_parts.insert(0, "【语言要求】请完全用中文回复，所有文本字段的值必须用中文撰写，禁止中英混用。")
        instruction = "\n".join(_inst_parts)
        instruction += "\nYou MUST return a JSON object with exactly these top-level keys: reasoning"

        result = {}
        _llm_ok = True
        try:
            result = await self.generate_reaction(instruction, observation)
        except ValueError as _llm_err:
            _llm_ok = False
            logger.warning(f"[DiscoverAndDecide_Round2] generate_reaction failed: {_llm_err}")
        if not isinstance(result, dict) or not result:
            _llm_ok = False
        if not _llm_ok:
            logger.error(
                f"[DiscoverAndDecide_Round2] LLM decision failed or empty for agent {self.profile_id}; "
                f"emitting NO event (an empty-payload event would silently corrupt downstream)"
            )
            return []
        # --- Event emission ---
        events_to_emit = []
        # Target: reply to GovernanceWorkflow from workflow chain
        for tid in _target_ids:
            events_to_emit.append(new_employment_worker_discover_and_decide_round2__governance_workflow_process_round_round2(
                self.profile_id, tid,
                scenario_config=self._coerce_value_to_schema_type(locals().get('scenario_config', result.get('scenario_config', "")), 'dict'),
                worker_profile=self._coerce_value_to_schema_type(locals().get('worker_profile', result.get('worker_profile', "")), 'dict'),
                case_state=self._coerce_value_to_schema_type(locals().get('case_state', result.get('case_state', "")), 'dict'),
            ))
        return events_to_emit

    async def UpdateTrustAndRecord_Round2(self, event: Event) -> List[Event]:
        """
        Handler: NewEmploymentWorker.UpdateTrustAndRecord_Round2
        Topology: 1:1 trigger=any emit=all
        Event Mappings:
          Trigger(输入门): any — 每个入边事件各自触发一次(不等待其它入边)
          Emit(输出): all — 满足时发出全部出边
          (1) governance_workflow_process_round_round2__new_employment_worker_update_trust_and_record_round2 (from GovernanceWorkflow.ProcessRound_Round2)
              => new_employment_worker_update_trust_and_record_round2__new_employment_worker_discover_and_decide_round3 (to NewEmploymentWorker.DiscoverAndDecide_Round3)
              routing(发给谁): self — 发给自身(内部处理链,不受关系限制)
        """
        # --- Event field extraction ---
        scenario_config = getattr(event, 'scenario_config', "")
        worker_profile = getattr(event, 'worker_profile', "")
        case_state = getattr(event, 'case_state', "")
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
        # ===================== 第 2 步 · 读取「可发送对象」 =====================
        # 本动作要把消息发出去。对每一条「输出边」,先算出【合法的目标 id 列表 + 他们的画像】:
        #   · _target_ids_<事件名>:这条边【允许发往】的具体 agent 实例 id —— 严格来自第三步定义的关系/routing,
        #     绝不能乱发给没有关系的对象。
        #   · _target_info_<事件名>:这些目标的名字/描述/画像,供 LLM 挑选时参考(例如「投给最认可的候选人」)。
        # 下面每条边上方的 "# Routing: xxx" 注释,说明这条边到底怎么分发(见各自说明)。
        # =====================================================================
        # Routing: self —— 发给「我自己」(同一实例的内部处理链,不跨到别的 agent);目标就是本实例,无需候选列表。
        _target_ids = [str(self.profile_id)]
        _target_info = []  # self-target, no candidate list needed
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
        _obs_parts.append('Current situation: 根据第二轮处置结果更新信任值并记录完整行为数据。 [Interaction context: (2) NewEmploymentWorker::DiscoverAndDecide_Round1 →. (4) NewEmploymentWorker::UpdateTrustAndRecord_Round1 →. (5) NewEmploymentWorker::DiscoverAndDecide_Round2 →. (7) NewEmploymentWorker::UpdateTrustAndRecord_Round2 →. (8) NewEmploymentWorker::DiscoverAndDecide_Round3 →]')
        _obs_parts.append(f"Event from: {event.from_agent_id}")
        _obs_parts.append("")
        _obs_parts.append("Received information:")
        _obs_parts.append(f"  scenario_config (当前仿真实验的配置参数，包括机制类型和固定问题集): {scenario_config}")
        _obs_parts.append(f"  worker_profile (第二轮决策后的从业者完整画像，含信任值与历史行为): {worker_profile}")
        _obs_parts.append(f"  case_state (经第二轮治理工作流处理后的案例状态集合，反映脱敏、审核、派单、反馈及服务匹配结果): {case_state}")
        if isinstance(locals().get('_arrival_payloads'), list) and _arrival_payloads:
            _obs_parts.append("")
            _obs_parts.append(f"Received batch payloads: {_arrival_payloads}")
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
        _inst_parts.append('You are a NewEmploymentWorker. Task: 根据第二轮处置结果更新信任值并记录完整行为数据。 [Interaction context: (2) NewEmploymentWorker::DiscoverAndDecide_Round1 →. (4) NewEmploymentWorker::UpdateTrustAndRecord_Round1 →. (5) NewEmploymentWorker::DiscoverAndDecide_Round2 →. (7) NewEmploymentWorker::UpdateTrustAndRecord_Round2 →. (8) NewEmploymentWorker::DiscoverAndDecide_Round3 →]')
        _inst_parts.append('Executable trigger: trigger=any. This action fires once for each incoming event; do not wait for other arrivals. Waiting/aggregation is only valid for AND or at_least triggers.')
        _inst_parts.append('根据第二轮处置质量（如反馈透明度、服务匹配是否兑现）再次调整current_trust：S2/S3中若承诺反馈或服务未兑现，信任应显著下降。完整记录本轮决策上下文与结果，特别注意服务激励（S3）对网约车司机或骑手的差异化影响。')
        _inst_parts.append('Return a JSON object with your reasoning and decision.')
        _inst_parts.append("You must include a 'reasoning' field (string) explaining WHY you made this decision in 1-2 sentences.")
        _inst_parts.append("Also return state update fields: my_worker_profile(新就业从业者画像，包含初始信任值、职业类型、时间压力、照护压力、治理信任、隐私顾虑、服务需求、公民责任感、数字熟练度等固定属性(结构:dict{worker_type:str, initial_trust:float, time_pressure:float, care_pressure:float, governance_trust:float, privacy_concern:float, service_need:float, civic_responsibility:float, digital_literacy:float, ...})(取值范围:initial_trust ∈ [0,1]；其他压力/态度类变量 ∈ [0,1]；worker_type ∈ ['rider', 'driver'])(例:{'worker_type': 'rider', 'initial_trust': 0.65, 'time_pressure': 0.8, 'care_pressure': 0.4, 'governance_trust': 0.65, 'privacy_concern': 0.7, 'service_need': 0.5, 'civic_responsibility': 0.6, 'digital_literacy': 0.75}))")
        if _sim_language == "zh":
            _inst_parts.insert(0, "【语言要求】请完全用中文回复，所有文本字段的值必须用中文撰写，禁止中英混用。")
        instruction = "\n".join(_inst_parts)
        instruction += "\nYou MUST return a JSON object with exactly these top-level keys: reasoning, my_worker_profile"

        result = {}
        _llm_ok = True
        try:
            result = await self.generate_reaction(instruction, observation)
        except ValueError as _llm_err:
            _llm_ok = False
            logger.warning(f"[UpdateTrustAndRecord_Round2] generate_reaction failed: {_llm_err}")
        if not isinstance(result, dict) or not result:
            _llm_ok = False
        if not _llm_ok:
            logger.error(
                f"[UpdateTrustAndRecord_Round2] LLM decision failed or empty for agent {self.profile_id}; "
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
        _incoming_my_worker_profile = _coerce_state_dict(result.get('my_worker_profile', {}))
        _existing_my_worker_profile = _coerce_state_dict(await self.get_data('my_worker_profile', {}))
        _case_key_my_worker_profile = None
        for _case_field in ('dispute_id', 'case_id', 'application_id', 'request_id', 'submission_id', 'participant_id', 'patient_id', 'claim_id', 'complaint_id', 'incident_id', 'household_id', 'student_id', 'tenant_id', 'landlord_id'):
            _case_candidate = result.get(_case_field)
            if _case_candidate is None or isinstance(_case_candidate, bool):
                continue
            _case_candidate = str(_case_candidate)
            _case_key_my_worker_profile = _case_candidate
            break
        if _case_key_my_worker_profile:
            _case_patch_my_worker_profile = _incoming_my_worker_profile.get(_case_key_my_worker_profile, _incoming_my_worker_profile)
            _case_existing_my_worker_profile = _existing_my_worker_profile.get(_case_key_my_worker_profile, {})
            _existing_my_worker_profile[_case_key_my_worker_profile] = _merge_state_dict(_case_existing_my_worker_profile, _case_patch_my_worker_profile)
            await self.update_data('my_worker_profile', _existing_my_worker_profile)
        else:
            await self.update_data('my_worker_profile', _merge_state_dict(_existing_my_worker_profile, _incoming_my_worker_profile))
        # --- Event emission ---
        events_to_emit = []
        # Target: self (internal processing chain)
        events_to_emit.append(new_employment_worker_update_trust_and_record_round2__new_employment_worker_discover_and_decide_round3(
            self.profile_id, str(self.profile_id),
            scenario_config=self._coerce_value_to_schema_type(locals().get('scenario_config', result.get('scenario_config', "")), 'dict'),
            worker_profile=self._coerce_value_to_schema_type(locals().get('worker_profile', result.get('worker_profile', "")), 'dict'),
            case_state=self._coerce_value_to_schema_type(locals().get('case_state', result.get('case_state', "")), 'dict'),
        ))
        return events_to_emit

    async def DiscoverAndDecide_Round3(self, event: Event) -> List[Event]:
        """
        Handler: NewEmploymentWorker.DiscoverAndDecide_Round3
        Topology: 1:1 trigger=any emit=all
        Event Mappings:
          Trigger(输入门): any — 每个入边事件各自触发一次(不等待其它入边)
          Emit(输出): all — 满足时发出全部出边
          (1) new_employment_worker_update_trust_and_record_round2__new_employment_worker_discover_and_decide_round3 (from NewEmploymentWorker.UpdateTrustAndRecord_Round2)
              => new_employment_worker_discover_and_decide_round3__governance_workflow_process_round_round3 (to GovernanceWorkflow.ProcessRound_Round3)
              routing(发给谁): reply — 回发给工作流链上最近的发起者(不受关系限制)
        """
        # --- Event field extraction ---
        scenario_config = getattr(event, 'scenario_config', "")
        worker_profile = getattr(event, 'worker_profile', "")
        case_state = getattr(event, 'case_state', "")
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
        # ===================== 第 2 步 · 读取「可发送对象」 =====================
        # 本动作要把消息发出去。对每一条「输出边」,先算出【合法的目标 id 列表 + 他们的画像】:
        #   · _target_ids_<事件名>:这条边【允许发往】的具体 agent 实例 id —— 严格来自第三步定义的关系/routing,
        #     绝不能乱发给没有关系的对象。
        #   · _target_info_<事件名>:这些目标的名字/描述/画像,供 LLM 挑选时参考(例如「投给最认可的候选人」)。
        # 下面每条边上方的 "# Routing: xxx" 注释,说明这条边到底怎么分发(见各自说明)。
        # =====================================================================
        # Routing: reply —— 「回信」:发回给消息链上最近一个 GovernanceWorkflow(即谁发起的就回给谁)。
        #   同类型有 ≥2 个候选时,用 LLM 消歧挑出真正的发起者;失败则回退到最近一个。
        _rc = getattr(event, '_routing_context', {}) or {}
        _rc_ids = _rc.get("GovernanceWorkflow", [])
        if isinstance(_rc_ids, str): _rc_ids = [_rc_ids]
        _direct_reply_id = str(event.from_agent_id) if getattr(event, 'from_agent_type', None) == "GovernanceWorkflow" else ""
        if _direct_reply_id and _direct_reply_id not in _rc_ids: _rc_ids.append(_direct_reply_id)
        if len(_rc_ids) >= 2:
            _target_ids = await self._disambiguate_reply_target(_rc_ids, "GovernanceWorkflow", event)
        else:
            _target_ids = _rc_ids[-1:] if _rc_ids else []
        _target_info = []  # reply-target, no candidate list needed
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
        _obs_parts.append('Current situation: 基于当前信任值决定第三轮是否上报新发现的问题。 [Interaction context: (2) NewEmploymentWorker::DiscoverAndDecide_Round1 →. (4) NewEmploymentWorker::UpdateTrustAndRecord_Round1 →. (5) NewEmploymentWorker::DiscoverAndDecide_Round2 →. (7) NewEmploymentWorker::UpdateTrustAndRecord_Round2 →. (8) NewEmploymentWorker::DiscoverAndDecide_Round3 →]')
        _obs_parts.append(f"Event from: {event.from_agent_id}")
        _obs_parts.append("")
        _obs_parts.append("Received information:")
        _obs_parts.append(f"  scenario_config (仿真场景配置，包含机制开关和固定问题集): {scenario_config}")
        _obs_parts.append(f"  worker_profile (更新后的从业者画像，包含本轮更新的信任值和行为标记): {worker_profile}")
        _obs_parts.append(f"  case_state (第二轮案例处理状态，包含处置结果关键字段): {case_state}")
        if isinstance(locals().get('_arrival_payloads'), list) and _arrival_payloads:
            _obs_parts.append("")
            _obs_parts.append(f"Received batch payloads: {_arrival_payloads}")
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
        _inst_parts.append('You are a NewEmploymentWorker. Task: 基于当前信任值决定第三轮是否上报新发现的问题。 [Interaction context: (2) NewEmploymentWorker::DiscoverAndDecide_Round1 →. (4) NewEmploymentWorker::UpdateTrustAndRecord_Round1 →. (5) NewEmploymentWorker::DiscoverAndDecide_Round2 →. (7) NewEmploymentWorker::UpdateTrustAndRecord_Round2 →. (8) NewEmploymentWorker::DiscoverAndDecide_Round3 →]')
        _inst_parts.append('Executable trigger: trigger=any. This action fires once for each incoming event; do not wait for other arrivals. Waiting/aggregation is only valid for AND or at_least triggers.')
        _inst_parts.append('在第三轮决策中，current_trust已累积两轮经验，应体现学习效应：持续正向互动强化参与，反复失望导致退出。结合问题类型（如是否涉及公共安全）与个人约束（如当日订单饱和度模拟的时间压力），做出更情境化的上报判断。')
        _inst_parts.append('Return a JSON object with your reasoning and decision.')
        _inst_parts.append("You must include a 'reasoning' field (string) explaining WHY you made this decision in 1-2 sentences.")
        if _sim_language == "zh":
            _inst_parts.insert(0, "【语言要求】请完全用中文回复，所有文本字段的值必须用中文撰写，禁止中英混用。")
        instruction = "\n".join(_inst_parts)
        instruction += "\nYou MUST return a JSON object with exactly these top-level keys: reasoning"

        result = {}
        _llm_ok = True
        try:
            result = await self.generate_reaction(instruction, observation)
        except ValueError as _llm_err:
            _llm_ok = False
            logger.warning(f"[DiscoverAndDecide_Round3] generate_reaction failed: {_llm_err}")
        if not isinstance(result, dict) or not result:
            _llm_ok = False
        if not _llm_ok:
            logger.error(
                f"[DiscoverAndDecide_Round3] LLM decision failed or empty for agent {self.profile_id}; "
                f"emitting NO event (an empty-payload event would silently corrupt downstream)"
            )
            return []
        # --- Event emission ---
        events_to_emit = []
        # Target: reply to GovernanceWorkflow from workflow chain
        for tid in _target_ids:
            events_to_emit.append(new_employment_worker_discover_and_decide_round3__governance_workflow_process_round_round3(
                self.profile_id, tid,
                scenario_config=self._coerce_value_to_schema_type(locals().get('scenario_config', result.get('scenario_config', "")), 'dict'),
                worker_profile=self._coerce_value_to_schema_type(locals().get('worker_profile', result.get('worker_profile', "")), 'dict'),
                case_state=self._coerce_value_to_schema_type(locals().get('case_state', result.get('case_state', "")), 'dict'),
            ))
        return events_to_emit

    async def UpdateTrustAndRecord_Round3(self, event: Event) -> List[Event]:
        """
        Handler: NewEmploymentWorker.UpdateTrustAndRecord_Round3
        Topology: 1:1 trigger=any emit=all
        Event Mappings:
          Trigger(输入门): any — 每个入边事件各自触发一次(不等待其它入边)
          Emit(输出): all — 满足时发出全部出边
          (1) governance_workflow_process_round_round3__new_employment_worker_update_trust_and_record_round3 (from GovernanceWorkflow.ProcessRound_Round3)
              => new_employment_worker_update_trust_and_record_round3__metric_recorder_finalize_metrics (to MetricRecorder.FinalizeMetrics)
              routing(发给谁): count:1 — 从本 event 关系候选里选 1 个 MetricRecorder
        """
        # --- Event field extraction ---
        scenario_config = getattr(event, 'scenario_config', "")
        worker_profile = getattr(event, 'worker_profile', "")
        case_state = getattr(event, 'case_state', "")
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
        # ===================== 第 2 步 · 读取「可发送对象」 =====================
        # 本动作要把消息发出去。对每一条「输出边」,先算出【合法的目标 id 列表 + 他们的画像】:
        #   · _target_ids_<事件名>:这条边【允许发往】的具体 agent 实例 id —— 严格来自第三步定义的关系/routing,
        #     绝不能乱发给没有关系的对象。
        #   · _target_info_<事件名>:这些目标的名字/描述/画像,供 LLM 挑选时参考(例如「投给最认可的候选人」)。
        # 下面每条边上方的 "# Routing: xxx" 注释,说明这条边到底怎么分发(见各自说明)。
        # =====================================================================
        # Routing: count —— 「定量挑选」:候选严格来自本事件的第三步关系,稍后由 LLM 从中挑出指定数量(见下方 instruction 里的『select exactly N』)。
        _target_ids = self.get_forward_candidates('new_employment_worker_update_trust_and_record_round3__metric_recorder_finalize_metrics', "MetricRecorder")
        _target_info = []
        for _rel in (self.relationship_manager.get_relationships_for_event('new_employment_worker_update_trust_and_record_round3__metric_recorder_finalize_metrics') if getattr(self, 'relationship_manager', None) else []):
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
        _obs_parts.append('Current situation: 根据第三轮处置结果更新信任值并记录完整行为数据。 [Interaction context: (2) NewEmploymentWorker::DiscoverAndDecide_Round1 →. (4) NewEmploymentWorker::UpdateTrustAndRecord_Round1 →. (5) NewEmploymentWorker::DiscoverAndDecide_Round2 →. (7) NewEmploymentWorker::UpdateTrustAndRecord_Round2 →. (8) NewEmploymentWorker::DiscoverAndDecide_Round3 →]')
        _obs_parts.append(f"Event from: {event.from_agent_id}")
        _obs_parts.append("")
        _obs_parts.append("Received information:")
        _obs_parts.append(f"  scenario_config (当前仿真实验的配置参数，决定AI辅助、透明反馈和非现金服务三个机制开关): {scenario_config}")
        _obs_parts.append(f"  worker_profile (第三轮决策后的从业者状态画像，包含本轮是否上报及耗时等信息): {worker_profile}")
        _obs_parts.append(f"  case_state (第三轮所有上报案例经脱敏、审核、派单、反馈及服务匹配后的完整处理状态): {case_state}")
        if isinstance(locals().get('_arrival_payloads'), list) and _arrival_payloads:
            _obs_parts.append("")
            _obs_parts.append(f"Received batch payloads: {_arrival_payloads}")
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
        _inst_parts.append('You are a NewEmploymentWorker. Task: 根据第三轮处置结果更新信任值并记录完整行为数据。 [Interaction context: (2) NewEmploymentWorker::DiscoverAndDecide_Round1 →. (4) NewEmploymentWorker::UpdateTrustAndRecord_Round1 →. (5) NewEmploymentWorker::DiscoverAndDecide_Round2 →. (7) NewEmploymentWorker::UpdateTrustAndRecord_Round2 →. (8) NewEmploymentWorker::DiscoverAndDecide_Round3 →]')
        _inst_parts.append('Executable trigger: trigger=any. This action fires once for each incoming event; do not wait for other arrivals. Waiting/aggregation is only valid for AND or at_least triggers.')
        _inst_parts.append('基于第三轮最终处置结果完成信任更新，形成三轮完整的信任演化轨迹。确保所有行为记录（上报与否、原因、结果满意度）结构化存入指标容器，为后续计算上报率、信任变化斜率等八项指标提供基础数据。')
        _inst_parts.append('Return a JSON object with your reasoning and decision.')
        _inst_parts.append("You must include a 'reasoning' field (string) explaining WHY you made this decision in 1-2 sentences.")
        _inst_parts.append('Return JSON with fields: reasoning, metrics_container(追加第三轮完整行为记录后的指标容器)')
        _inst_parts.append("Also return state update fields: my_worker_profile(新就业从业者画像，包含初始信任值、职业类型、时间压力、照护压力、治理信任、隐私顾虑、服务需求、公民责任感、数字熟练度等固定属性(结构:dict{worker_type:str, initial_trust:float, time_pressure:float, care_pressure:float, governance_trust:float, privacy_concern:float, service_need:float, civic_responsibility:float, digital_literacy:float, ...})(取值范围:initial_trust ∈ [0,1]；其他压力/态度类变量 ∈ [0,1]；worker_type ∈ ['rider', 'driver'])(例:{'worker_type': 'rider', 'initial_trust': 0.65, 'time_pressure': 0.8, 'care_pressure': 0.4, 'governance_trust': 0.65, 'privacy_concern': 0.7, 'service_need': 0.5, 'civic_responsibility': 0.6, 'digital_literacy': 0.75}))")
        if _sim_language == "zh":
            _inst_parts.insert(0, "【语言要求】请完全用中文回复，所有文本字段的值必须用中文撰写，禁止中英混用。")
        instruction = "\n".join(_inst_parts)
        instruction += f"\n\nAvailable target MetricRecorder agents and their profiles: {_target_info}"
        instruction += f"\nValid target IDs (you MUST only return IDs from this list): {_target_ids}"
        instruction += "\nSelect exactly 1 target(s) for target_ids when at least 1 candidates are available. If fewer than 1 candidates are available, select all available candidates. Return UNIQUE ID(s) only; never repeat the same ID."
        instruction += "\nReturn target id field(s) as list(s) of ID strings ONLY."
        instruction += "\nYou MUST return a JSON object with exactly these top-level keys: reasoning, metrics_container, my_worker_profile, target_ids"

        result = {}
        _llm_ok = True
        try:
            result = await self.generate_reaction(instruction, observation)
        except ValueError as _llm_err:
            _llm_ok = False
            logger.warning(f"[UpdateTrustAndRecord_Round3] generate_reaction failed: {_llm_err}")
        if not isinstance(result, dict) or not result:
            _llm_ok = False
        if not _llm_ok:
            logger.error(
                f"[UpdateTrustAndRecord_Round3] LLM decision failed or empty for agent {self.profile_id}; "
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
        _incoming_my_worker_profile = _coerce_state_dict(result.get('my_worker_profile', {}))
        _existing_my_worker_profile = _coerce_state_dict(await self.get_data('my_worker_profile', {}))
        _case_key_my_worker_profile = None
        for _case_field in ('dispute_id', 'case_id', 'application_id', 'request_id', 'submission_id', 'participant_id', 'patient_id', 'claim_id', 'complaint_id', 'incident_id', 'household_id', 'student_id', 'tenant_id', 'landlord_id'):
            _case_candidate = result.get(_case_field)
            if _case_candidate is None or isinstance(_case_candidate, bool):
                continue
            _case_candidate = str(_case_candidate)
            _case_key_my_worker_profile = _case_candidate
            break
        if _case_key_my_worker_profile:
            _case_patch_my_worker_profile = _incoming_my_worker_profile.get(_case_key_my_worker_profile, _incoming_my_worker_profile)
            _case_existing_my_worker_profile = _existing_my_worker_profile.get(_case_key_my_worker_profile, {})
            _existing_my_worker_profile[_case_key_my_worker_profile] = _merge_state_dict(_case_existing_my_worker_profile, _case_patch_my_worker_profile)
            await self.update_data('my_worker_profile', _existing_my_worker_profile)
        else:
            await self.update_data('my_worker_profile', _merge_state_dict(_existing_my_worker_profile, _incoming_my_worker_profile))
        # --- Event emission ---
        events_to_emit = []
        # Target: MetricRecorder
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
            events_to_emit.append(new_employment_worker_update_trust_and_record_round3__metric_recorder_finalize_metrics(
                self.profile_id, tid,
                scenario_config=self._coerce_value_to_schema_type(locals().get('scenario_config', result.get('scenario_config', "")), 'dict'),
                worker_profile=self._coerce_value_to_schema_type(locals().get('worker_profile', result.get('worker_profile', "")), 'dict'),
                metrics_container=self._coerce_value_to_schema_type(result.get('metrics_container', ""), 'dict'),
            ))
        return events_to_emit

