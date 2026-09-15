
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


class GovernanceWorkflow(GeneralAgent):
    def __init__(self,
                 sys_prompt: str | None = None,
                 model_config_name: str = None,
                 event_bus_queue: asyncio.Queue = None,
                 profile: AgentProfile=None,
                 memory: MemoryStrategy=None,
                 planning: PlanningBase=None,
                 relationship_manager: RelationshipManager=None) -> None:
        super().__init__(sys_prompt, model_config_name, event_bus_queue, profile, memory, planning, relationship_manager)
        self.register_event("new_employment_worker_discover_and_decide_round1__governance_workflow_process_round_round1", "ProcessRound_Round1")
        self.register_event("new_employment_worker_discover_and_decide_round2__governance_workflow_process_round_round2", "ProcessRound_Round2")
        self.register_event("new_employment_worker_discover_and_decide_round3__governance_workflow_process_round_round3", "ProcessRound_Round3")


    async def ProcessRound_Round1(self, event: Event) -> List[Event]:
        """
        Handler: GovernanceWorkflow.ProcessRound_Round1
        Topology: 1:1 trigger=any emit=all
        Event Mappings:
          Trigger(输入门): any — 每个入边事件各自触发一次(不等待其它入边)
          Emit(输出): all — 满足时发出全部出边
          (1) new_employment_worker_discover_and_decide_round1__governance_workflow_process_round_round1 (from NewEmploymentWorker.DiscoverAndDecide_Round1)
              => governance_workflow_process_round_round1__new_employment_worker_update_trust_and_record_round1 (to NewEmploymentWorker.UpdateTrustAndRecord_Round1)
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
        # Routing: reply —— 「回信」:发回给消息链上最近一个 NewEmploymentWorker(即谁发起的就回给谁)。
        #   同类型有 ≥2 个候选时,用 LLM 消歧挑出真正的发起者;失败则回退到最近一个。
        _rc = getattr(event, '_routing_context', {}) or {}
        _rc_ids = _rc.get("NewEmploymentWorker", [])
        if isinstance(_rc_ids, str): _rc_ids = [_rc_ids]
        _direct_reply_id = str(event.from_agent_id) if getattr(event, 'from_agent_type', None) == "NewEmploymentWorker" else ""
        if _direct_reply_id and _direct_reply_id not in _rc_ids: _rc_ids.append(_direct_reply_id)
        if len(_rc_ids) >= 2:
            _target_ids = await self._disambiguate_reply_target(_rc_ids, "NewEmploymentWorker", event)
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
        _obs_parts.append('Current situation: 处理第一轮上报案例，判断应急性，执行脱敏审核派单及反馈奖励逻辑。 [Interaction context: (3) GovernanceWorkflow::ProcessRound_Round1 →. (6) GovernanceWorkflow::ProcessRound_Round2 →. (9) GovernanceWorkflow::ProcessRound_Round3 →. GovernanceWorkflow内部严格依次执行应急分流、信息处理、人工确认、责任主体处置、反馈和服务匹配；human_review_confirmed不是AI批准，而是对人工关口的模拟记录。]')
        _obs_parts.append(f"Event from: {event.from_agent_id}")
        _obs_parts.append("")
        _obs_parts.append("Received information:")
        _obs_parts.append(f"  scenario_config (仿真场景配置，包含机制开关和三轮固定问题集): {scenario_config}")
        _obs_parts.append(f"  worker_profile (更新后的从业者画像，包含重置的信任值和第一轮上报决策): {worker_profile}")
        _obs_parts.append(f"  case_state (本轮案例状态，记录每个固定问题是否被上报、上报耗时、从业者类型及上报时的信任值): {case_state}")
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
        _inst_parts.append('You are a GovernanceWorkflow. Task: 处理第一轮上报案例，判断应急性，执行脱敏审核派单及反馈奖励逻辑。 [Interaction context: (3) GovernanceWorkflow::ProcessRound_Round1 →. (6) GovernanceWorkflow::ProcessRound_Round2 →. (9) GovernanceWorkflow::ProcessRound_Round3 →. GovernanceWorkflow内部严格依次执行应急分流、信息处理、人工确认、责任主体处置、反馈和服务匹配；human_review_confirmed不是AI批准，而是对人工关口的模拟记录。]')
        _inst_parts.append('Executable trigger: trigger=any. This action fires once for each incoming event; do not wait for other arrivals. Waiting/aggregation is only valid for AND or at_least triggers.')
        _inst_parts.append('严格按顺序执行六阶段流程：先识别是否属应急事件（火灾、急救等）并直转110/119/120；非应急事件才进入AI处理（仅当scenario启用AI时脱敏、分类、分级）；人工审核确认（human_review_confirmed必须显式设为true才能生成工单）；随后派单、反馈（仅S2/S3）、服务匹配（仅S3）。未启用功能则跳过但不中断流程。')
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
            logger.warning(f"[ProcessRound_Round1] generate_reaction failed: {_llm_err}")
        if not isinstance(result, dict) or not result:
            _llm_ok = False
        if not _llm_ok:
            logger.error(
                f"[ProcessRound_Round1] LLM decision failed or empty for agent {self.profile_id}; "
                f"emitting NO event (an empty-payload event would silently corrupt downstream)"
            )
            return []
        # --- Event emission ---
        events_to_emit = []
        # Target: reply to NewEmploymentWorker from workflow chain
        for tid in _target_ids:
            events_to_emit.append(governance_workflow_process_round_round1__new_employment_worker_update_trust_and_record_round1(
                self.profile_id, tid,
                scenario_config=self._coerce_value_to_schema_type(locals().get('scenario_config', result.get('scenario_config', "")), 'dict'),
                worker_profile=self._coerce_value_to_schema_type(locals().get('worker_profile', result.get('worker_profile', "")), 'dict'),
                case_state=self._coerce_value_to_schema_type(locals().get('case_state', result.get('case_state', "")), 'dict'),
            ))
        return events_to_emit

    async def ProcessRound_Round2(self, event: Event) -> List[Event]:
        """
        Handler: GovernanceWorkflow.ProcessRound_Round2
        Topology: 1:1 trigger=any emit=all
        Event Mappings:
          Trigger(输入门): any — 每个入边事件各自触发一次(不等待其它入边)
          Emit(输出): all — 满足时发出全部出边
          (1) new_employment_worker_discover_and_decide_round2__governance_workflow_process_round_round2 (from NewEmploymentWorker.DiscoverAndDecide_Round2)
              => governance_workflow_process_round_round2__new_employment_worker_update_trust_and_record_round2 (to NewEmploymentWorker.UpdateTrustAndRecord_Round2)
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
        # Routing: reply —— 「回信」:发回给消息链上最近一个 NewEmploymentWorker(即谁发起的就回给谁)。
        #   同类型有 ≥2 个候选时,用 LLM 消歧挑出真正的发起者;失败则回退到最近一个。
        _rc = getattr(event, '_routing_context', {}) or {}
        _rc_ids = _rc.get("NewEmploymentWorker", [])
        if isinstance(_rc_ids, str): _rc_ids = [_rc_ids]
        _direct_reply_id = str(event.from_agent_id) if getattr(event, 'from_agent_type', None) == "NewEmploymentWorker" else ""
        if _direct_reply_id and _direct_reply_id not in _rc_ids: _rc_ids.append(_direct_reply_id)
        if len(_rc_ids) >= 2:
            _target_ids = await self._disambiguate_reply_target(_rc_ids, "NewEmploymentWorker", event)
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
        _obs_parts.append('Current situation: 处理第二轮上报案例，执行脱敏、审核、派单及反馈奖励逻辑。 [Interaction context: (3) GovernanceWorkflow::ProcessRound_Round1 →. (6) GovernanceWorkflow::ProcessRound_Round2 →. (9) GovernanceWorkflow::ProcessRound_Round3 →. GovernanceWorkflow内部严格依次执行应急分流、信息处理、人工确认、责任主体处置、反馈和服务匹配；human_review_confirmed不是AI批准，而是对人工关口的模拟记录。]')
        _obs_parts.append(f"Event from: {event.from_agent_id}")
        _obs_parts.append("")
        _obs_parts.append("Received information:")
        _obs_parts.append(f"  scenario_config (仿真场景配置，含第二轮问题): {scenario_config}")
        _obs_parts.append(f"  worker_profile (更新后的从业者画像，含当前治理信任值): {worker_profile}")
        _obs_parts.append(f"  case_state (第二轮上报案例状态，记录是否上报及上报耗时): {case_state}")
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
        _inst_parts.append('You are a GovernanceWorkflow. Task: 处理第二轮上报案例，执行脱敏、审核、派单及反馈奖励逻辑。 [Interaction context: (3) GovernanceWorkflow::ProcessRound_Round1 →. (6) GovernanceWorkflow::ProcessRound_Round2 →. (9) GovernanceWorkflow::ProcessRound_Round3 →. GovernanceWorkflow内部严格依次执行应急分流、信息处理、人工确认、责任主体处置、反馈和服务匹配；human_review_confirmed不是AI批准，而是对人工关口的模拟记录。]')
        _inst_parts.append('Executable trigger: trigger=any. This action fires once for each incoming event; do not wait for other arrivals. Waiting/aggregation is only valid for AND or at_least triggers.')
        _inst_parts.append('延续第一轮逻辑处理第二轮案例，重点检验透明反馈（S2/S3）是否提升处置可信度：若启用了反馈机制，需模拟向上报者传递处理进展；若启用了服务激励（S3），需根据问题类型匹配换电、托管等非现金服务。人工审核环节不可被AI替代，仅记录是否通过。')
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
            logger.warning(f"[ProcessRound_Round2] generate_reaction failed: {_llm_err}")
        if not isinstance(result, dict) or not result:
            _llm_ok = False
        if not _llm_ok:
            logger.error(
                f"[ProcessRound_Round2] LLM decision failed or empty for agent {self.profile_id}; "
                f"emitting NO event (an empty-payload event would silently corrupt downstream)"
            )
            return []
        # --- Event emission ---
        events_to_emit = []
        # Target: reply to NewEmploymentWorker from workflow chain
        for tid in _target_ids:
            events_to_emit.append(governance_workflow_process_round_round2__new_employment_worker_update_trust_and_record_round2(
                self.profile_id, tid,
                scenario_config=self._coerce_value_to_schema_type(locals().get('scenario_config', result.get('scenario_config', "")), 'dict'),
                worker_profile=self._coerce_value_to_schema_type(locals().get('worker_profile', result.get('worker_profile', "")), 'dict'),
                case_state=self._coerce_value_to_schema_type(locals().get('case_state', result.get('case_state', "")), 'dict'),
            ))
        return events_to_emit

    async def ProcessRound_Round3(self, event: Event) -> List[Event]:
        """
        Handler: GovernanceWorkflow.ProcessRound_Round3
        Topology: 1:1 trigger=any emit=all
        Event Mappings:
          Trigger(输入门): any — 每个入边事件各自触发一次(不等待其它入边)
          Emit(输出): all — 满足时发出全部出边
          (1) new_employment_worker_discover_and_decide_round3__governance_workflow_process_round_round3 (from NewEmploymentWorker.DiscoverAndDecide_Round3)
              => governance_workflow_process_round_round3__new_employment_worker_update_trust_and_record_round3 (to NewEmploymentWorker.UpdateTrustAndRecord_Round3)
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
        # Routing: reply —— 「回信」:发回给消息链上最近一个 NewEmploymentWorker(即谁发起的就回给谁)。
        #   同类型有 ≥2 个候选时,用 LLM 消歧挑出真正的发起者;失败则回退到最近一个。
        _rc = getattr(event, '_routing_context', {}) or {}
        _rc_ids = _rc.get("NewEmploymentWorker", [])
        if isinstance(_rc_ids, str): _rc_ids = [_rc_ids]
        _direct_reply_id = str(event.from_agent_id) if getattr(event, 'from_agent_type', None) == "NewEmploymentWorker" else ""
        if _direct_reply_id and _direct_reply_id not in _rc_ids: _rc_ids.append(_direct_reply_id)
        if len(_rc_ids) >= 2:
            _target_ids = await self._disambiguate_reply_target(_rc_ids, "NewEmploymentWorker", event)
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
        _obs_parts.append('Current situation: 处理第三轮上报案例，执行脱敏、审核、派单及反馈奖励逻辑. [Interaction context: (3) GovernanceWorkflow::ProcessRound_Round1 →. (6) GovernanceWorkflow::ProcessRound_Round2 →. (9) GovernanceWorkflow::ProcessRound_Round3 →. GovernanceWorkflow内部严格依次执行应急分流、信息处理、人工确认、责任主体处置、反馈和服务匹配；human_review_confirmed不是AI批准，而是对人工关口的模拟记录。]')
        _obs_parts.append(f"Event from: {event.from_agent_id}")
        _obs_parts.append("")
        _obs_parts.append("Received information:")
        _obs_parts.append(f"  scenario_config (仿真场景配置，含第三轮固定问题): {scenario_config}")
        _obs_parts.append(f"  worker_profile (更新后的从业者画像，含当前治理信任值): {worker_profile}")
        _obs_parts.append(f"  case_state (第三轮上报案例状态，包含本轮决定上报的问题及其元数据): {case_state}")
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
        _inst_parts.append('You are a GovernanceWorkflow. Task: 处理第三轮上报案例，执行脱敏、审核、派单及反馈奖励逻辑. [Interaction context: (3) GovernanceWorkflow::ProcessRound_Round1 →. (6) GovernanceWorkflow::ProcessRound_Round2 →. (9) GovernanceWorkflow::ProcessRound_Round3 →. GovernanceWorkflow内部严格依次执行应急分流、信息处理、人工确认、责任主体处置、反馈和服务匹配；human_review_confirmed不是AI批准，而是对人工关口的模拟记录。]')
        _inst_parts.append('Executable trigger: trigger=any. This action fires once for each incoming event; do not wait for other arrivals. Waiting/aggregation is only valid for AND or at_least triggers.')
        _inst_parts.append('处理第三轮案例时，需体现机制累积效应：S3中持续的服务兑现应维持高参与意愿，而S0中无反馈可能导致上报锐减。仍须严格执行应急分流优先原则，普通工单必须经人工确认，AI仅提供建议。服务匹配需与问题类型合理关联（如道路积水不匹配换电服务）。')
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
            logger.warning(f"[ProcessRound_Round3] generate_reaction failed: {_llm_err}")
        if not isinstance(result, dict) or not result:
            _llm_ok = False
        if not _llm_ok:
            logger.error(
                f"[ProcessRound_Round3] LLM decision failed or empty for agent {self.profile_id}; "
                f"emitting NO event (an empty-payload event would silently corrupt downstream)"
            )
            return []
        # --- Event emission ---
        events_to_emit = []
        # Target: reply to NewEmploymentWorker from workflow chain
        for tid in _target_ids:
            events_to_emit.append(governance_workflow_process_round_round3__new_employment_worker_update_trust_and_record_round3(
                self.profile_id, tid,
                scenario_config=self._coerce_value_to_schema_type(locals().get('scenario_config', result.get('scenario_config', "")), 'dict'),
                worker_profile=self._coerce_value_to_schema_type(locals().get('worker_profile', result.get('worker_profile', "")), 'dict'),
                case_state=self._coerce_value_to_schema_type(locals().get('case_state', result.get('case_state', "")), 'dict'),
            ))
        return events_to_emit

