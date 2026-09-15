
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


class MetricRecorder(GeneralAgent):
    def __init__(self,
                 sys_prompt: str | None = None,
                 model_config_name: str = None,
                 event_bus_queue: asyncio.Queue = None,
                 profile: AgentProfile=None,
                 memory: MemoryStrategy=None,
                 planning: PlanningBase=None,
                 relationship_manager: RelationshipManager=None) -> None:
        super().__init__(sys_prompt, model_config_name, event_bus_queue, profile, memory, planning, relationship_manager)
        self.register_event("new_employment_worker_update_trust_and_record_round3__metric_recorder_finalize_metrics", "FinalizeMetrics")


    async def FinalizeMetrics(self, event: Event) -> List[Event]:
        """
        Handler: MetricRecorder.FinalizeMetrics
        Topology: 1:1 trigger=any emit=all end
        Event Mappings:
          Trigger(输入门): any — 每个入边事件各自触发一次(不等待其它入边)
          Emit(输出): all — 满足时发出全部出边
          (1) new_employment_worker_update_trust_and_record_round3__metric_recorder_finalize_metrics (from NewEmploymentWorker.UpdateTrustAndRecord_Round3)
              => finalize_metrics_end (to EnvAgent.terminate)
              routing(发给谁): self — 发给自身(内部处理链,不受关系限制)
        """
        # --- Event field extraction ---
        scenario_config = getattr(event, 'scenario_config', "")
        worker_profile = getattr(event, 'worker_profile', "")
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
        _obs_parts.append('Current situation: 汇总并固化全部仿真运行指标数据。 [Interaction context: (11) MetricRecorder::FinalizeMetrics →. 每轮UpdateTrustAndRecord必须追加记录而不是覆盖；FinalizeMetrics必须读取全部三轮记录。]')
        _obs_parts.append(f"Event from: {event.from_agent_id}")
        _obs_parts.append("")
        _obs_parts.append("Received information:")
        _obs_parts.append(f"  scenario_config (仿真场景配置，包含机制开关和三轮固定问题集): {scenario_config}")
        _obs_parts.append(f"  worker_profile (更新后的从业者画像，包含第三轮后的 current_trust 和 reported_in_round3 标记): {worker_profile}")
        _obs_parts.append(f"  metrics_container (追加第三轮完整行为记录后的指标容器): {metrics_container}")
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
        _inst_parts.append('You are a MetricRecorder. Task: 汇总并固化全部仿真运行指标数据。 [Interaction context: (11) MetricRecorder::FinalizeMetrics →. 每轮UpdateTrustAndRecord必须追加记录而不是覆盖；FinalizeMetrics必须读取全部三轮记录。]')
        _inst_parts.append('Executable trigger: trigger=any. This action fires once for each incoming event; do not wait for other arrivals. Waiting/aggregation is only valid for AND or at_least triggers.')
        _inst_parts.append('汇总全部三轮记录，计算八项核心指标：总上报率、各轮信任均值变化、AI使用率（S1-S3）、反馈接收率（S2-S3）、服务兑现率（S3）、工单转化率、应急事件正确分流率、群体间（骑手vs司机）行为差异。确保数据源自每轮UpdateTrustAndRecord的追加记录，不得覆盖或遗漏。')
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
            logger.warning(f"[FinalizeMetrics] generate_reaction failed: {_llm_err}")
        if not isinstance(result, dict) or not result:
            _llm_ok = False
        if not _llm_ok:
            logger.error(
                f"[FinalizeMetrics] LLM decision failed or empty for agent {self.profile_id}; "
                f"emitting NO event (an empty-payload event would silently corrupt downstream)"
            )
            return []
        # --- Event emission ---
        events_to_emit = []
        events_to_emit.append(finalize_metrics_end(
            self.profile_id, "ENV",
            metrics_container=self._coerce_value_to_schema_type(locals().get('metrics_container', result.get('metrics_container', "")), 'dict'),
        ))
        return events_to_emit

