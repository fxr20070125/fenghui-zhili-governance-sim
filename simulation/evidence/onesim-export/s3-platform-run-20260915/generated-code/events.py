from onesim.events import Event
from typing import Any, List, Dict, Optional
import datetime

class StartEvent(Event):
    """
    Event for StartEvent
    
    Attributes:
        from_agent_id (str): ID of the agent sending this event
        to_agent_id (str): ID of the agent receiving this event
    """
    def __init__(self,
        from_agent_id: str,
        to_agent_id: str,
        **kwargs: Any
    ) -> None:
        super().__init__(from_agent_id=from_agent_id, to_agent_id=to_agent_id, **kwargs)

class scenario_controller_load_scenario__new_employment_worker_discover_and_decide_round1(Event):
    """
    Event for scenario_controller_load_scenario__new_employment_worker_discover_and_decide_round1
    
    Attributes:
        from_agent_id (str): ID of the agent sending this event
        to_agent_id (str): ID of the agent receiving this event
        scenario_config (dict): 仿真场景配置对象，包含机制开关和三轮共用的固定问题集
        case_state (dict): 案例状态容器，初始轮次为0且案例列表为空
        metrics_container (dict): 指标记录容器，初始记录列表为空
    """
    def __init__(self,
        from_agent_id: str,
        to_agent_id: str,
        scenario_config: Optional[Dict[str, Any]] = None,
        case_state: Optional[Dict[str, Any]] = None,
        metrics_container: Optional[Dict[str, Any]] = None,
        **kwargs: Any
    ) -> None:
        super().__init__(from_agent_id=from_agent_id, to_agent_id=to_agent_id, **kwargs)
        if scenario_config is not None:
            self.scenario_config = scenario_config
        if case_state is not None:
            self.case_state = case_state
        if metrics_container is not None:
            self.metrics_container = metrics_container

class new_employment_worker_discover_and_decide_round1__governance_workflow_process_round_round1(Event):
    """
    Event for new_employment_worker_discover_and_decide_round1__governance_workflow_process_round_round1
    
    Attributes:
        from_agent_id (str): ID of the agent sending this event
        to_agent_id (str): ID of the agent receiving this event
        scenario_config (dict): 仿真场景配置，包含机制开关和三轮固定问题集
        worker_profile (dict): 更新后的从业者画像，包含重置的信任值和第一轮上报决策
        case_state (dict): 本轮案例状态，记录每个固定问题是否被上报、上报耗时、从业者类型及上报时的信任值
    """
    def __init__(self,
        from_agent_id: str,
        to_agent_id: str,
        scenario_config: Optional[Dict[str, Any]] = None,
        worker_profile: Optional[Dict[str, Any]] = None,
        case_state: Optional[Dict[str, Any]] = None,
        **kwargs: Any
    ) -> None:
        super().__init__(from_agent_id=from_agent_id, to_agent_id=to_agent_id, **kwargs)
        if scenario_config is not None:
            self.scenario_config = scenario_config
        if worker_profile is not None:
            self.worker_profile = worker_profile
        if case_state is not None:
            self.case_state = case_state

class governance_workflow_process_round_round1__new_employment_worker_update_trust_and_record_round1(Event):
    """
    Event for governance_workflow_process_round_round1__new_employment_worker_update_trust_and_record_round1
    
    Attributes:
        from_agent_id (str): ID of the agent sending this event
        to_agent_id (str): ID of the agent receiving this event
        scenario_config (dict): 仿真场景配置，包含机制开关和固定问题集
        worker_profile (dict): 从业者画像，包含其类型、信任水平及本轮上报决策
        case_state (dict): 第一轮案例处理后的完整状态，记录每条上报的应急判断、AI辅助处理（如适用）、人工审核、派单、反馈与奖励逻辑执行结果
    """
    def __init__(self,
        from_agent_id: str,
        to_agent_id: str,
        scenario_config: Optional[Dict[str, Any]] = None,
        worker_profile: Optional[Dict[str, Any]] = None,
        case_state: Optional[Dict[str, Any]] = None,
        **kwargs: Any
    ) -> None:
        super().__init__(from_agent_id=from_agent_id, to_agent_id=to_agent_id, **kwargs)
        if scenario_config is not None:
            self.scenario_config = scenario_config
        if worker_profile is not None:
            self.worker_profile = worker_profile
        if case_state is not None:
            self.case_state = case_state

class new_employment_worker_update_trust_and_record_round1__new_employment_worker_discover_and_decide_round2(Event):
    """
    Event for new_employment_worker_update_trust_and_record_round1__new_employment_worker_discover_and_decide_round2
    
    Attributes:
        from_agent_id (str): ID of the agent sending this event
        to_agent_id (str): ID of the agent receiving this event
        scenario_config (dict): 仿真场景配置，包含机制开关和固定问题集
        worker_profile (dict): 更新后的从业者画像，含本轮信任值更新和行为记录
        case_state (dict): 第一轮案例处置状态，由治理工作流处理后生成
        metrics_container (dict): 指标容器，已追加本轮完整记录
    """
    def __init__(self,
        from_agent_id: str,
        to_agent_id: str,
        scenario_config: Optional[Dict[str, Any]] = None,
        worker_profile: Optional[Dict[str, Any]] = None,
        case_state: Optional[Dict[str, Any]] = None,
        metrics_container: Optional[Dict[str, Any]] = None,
        **kwargs: Any
    ) -> None:
        super().__init__(from_agent_id=from_agent_id, to_agent_id=to_agent_id, **kwargs)
        if scenario_config is not None:
            self.scenario_config = scenario_config
        if worker_profile is not None:
            self.worker_profile = worker_profile
        if case_state is not None:
            self.case_state = case_state
        if metrics_container is not None:
            self.metrics_container = metrics_container

class new_employment_worker_discover_and_decide_round2__governance_workflow_process_round_round2(Event):
    """
    Event for new_employment_worker_discover_and_decide_round2__governance_workflow_process_round_round2
    
    Attributes:
        from_agent_id (str): ID of the agent sending this event
        to_agent_id (str): ID of the agent receiving this event
        scenario_config (dict): 仿真场景配置，含第二轮问题
        worker_profile (dict): 更新后的从业者画像，含当前治理信任值
        case_state (dict): 第二轮上报案例状态，记录是否上报及上报耗时
    """
    def __init__(self,
        from_agent_id: str,
        to_agent_id: str,
        scenario_config: Optional[Dict[str, Any]] = None,
        worker_profile: Optional[Dict[str, Any]] = None,
        case_state: Optional[Dict[str, Any]] = None,
        **kwargs: Any
    ) -> None:
        super().__init__(from_agent_id=from_agent_id, to_agent_id=to_agent_id, **kwargs)
        if scenario_config is not None:
            self.scenario_config = scenario_config
        if worker_profile is not None:
            self.worker_profile = worker_profile
        if case_state is not None:
            self.case_state = case_state

class governance_workflow_process_round_round2__new_employment_worker_update_trust_and_record_round2(Event):
    """
    Event for governance_workflow_process_round_round2__new_employment_worker_update_trust_and_record_round2
    
    Attributes:
        from_agent_id (str): ID of the agent sending this event
        to_agent_id (str): ID of the agent receiving this event
        scenario_config (dict): 当前仿真实验的配置参数，包括机制类型和固定问题集
        worker_profile (dict): 第二轮决策后的从业者完整画像，含信任值与历史行为
        case_state (dict): 经第二轮治理工作流处理后的案例状态集合，反映脱敏、审核、派单、反馈及服务匹配结果
    """
    def __init__(self,
        from_agent_id: str,
        to_agent_id: str,
        scenario_config: Optional[Dict[str, Any]] = None,
        worker_profile: Optional[Dict[str, Any]] = None,
        case_state: Optional[Dict[str, Any]] = None,
        **kwargs: Any
    ) -> None:
        super().__init__(from_agent_id=from_agent_id, to_agent_id=to_agent_id, **kwargs)
        if scenario_config is not None:
            self.scenario_config = scenario_config
        if worker_profile is not None:
            self.worker_profile = worker_profile
        if case_state is not None:
            self.case_state = case_state

class new_employment_worker_update_trust_and_record_round2__new_employment_worker_discover_and_decide_round3(Event):
    """
    Event for new_employment_worker_update_trust_and_record_round2__new_employment_worker_discover_and_decide_round3
    
    Attributes:
        from_agent_id (str): ID of the agent sending this event
        to_agent_id (str): ID of the agent receiving this event
        scenario_config (dict): 仿真场景配置，包含机制开关和固定问题集
        worker_profile (dict): 更新后的从业者画像，包含本轮更新的信任值和行为标记
        case_state (dict): 第二轮案例处理状态，包含处置结果关键字段
    """
    def __init__(self,
        from_agent_id: str,
        to_agent_id: str,
        scenario_config: Optional[Dict[str, Any]] = None,
        worker_profile: Optional[Dict[str, Any]] = None,
        case_state: Optional[Dict[str, Any]] = None,
        **kwargs: Any
    ) -> None:
        super().__init__(from_agent_id=from_agent_id, to_agent_id=to_agent_id, **kwargs)
        if scenario_config is not None:
            self.scenario_config = scenario_config
        if worker_profile is not None:
            self.worker_profile = worker_profile
        if case_state is not None:
            self.case_state = case_state

class new_employment_worker_discover_and_decide_round3__governance_workflow_process_round_round3(Event):
    """
    Event for new_employment_worker_discover_and_decide_round3__governance_workflow_process_round_round3
    
    Attributes:
        from_agent_id (str): ID of the agent sending this event
        to_agent_id (str): ID of the agent receiving this event
        scenario_config (dict): 仿真场景配置，含第三轮固定问题
        worker_profile (dict): 更新后的从业者画像，含当前治理信任值
        case_state (dict): 第三轮上报案例状态，包含本轮决定上报的问题及其元数据
    """
    def __init__(self,
        from_agent_id: str,
        to_agent_id: str,
        scenario_config: Optional[Dict[str, Any]] = None,
        worker_profile: Optional[Dict[str, Any]] = None,
        case_state: Optional[Dict[str, Any]] = None,
        **kwargs: Any
    ) -> None:
        super().__init__(from_agent_id=from_agent_id, to_agent_id=to_agent_id, **kwargs)
        if scenario_config is not None:
            self.scenario_config = scenario_config
        if worker_profile is not None:
            self.worker_profile = worker_profile
        if case_state is not None:
            self.case_state = case_state

class governance_workflow_process_round_round3__new_employment_worker_update_trust_and_record_round3(Event):
    """
    Event for governance_workflow_process_round_round3__new_employment_worker_update_trust_and_record_round3
    
    Attributes:
        from_agent_id (str): ID of the agent sending this event
        to_agent_id (str): ID of the agent receiving this event
        scenario_config (dict): 当前仿真实验的配置参数，决定AI辅助、透明反馈和非现金服务三个机制开关
        worker_profile (dict): 第三轮决策后的从业者状态画像，包含本轮是否上报及耗时等信息
        case_state (dict): 第三轮所有上报案例经脱敏、审核、派单、反馈及服务匹配后的完整处理状态
    """
    def __init__(self,
        from_agent_id: str,
        to_agent_id: str,
        scenario_config: Optional[Dict[str, Any]] = None,
        worker_profile: Optional[Dict[str, Any]] = None,
        case_state: Optional[Dict[str, Any]] = None,
        **kwargs: Any
    ) -> None:
        super().__init__(from_agent_id=from_agent_id, to_agent_id=to_agent_id, **kwargs)
        if scenario_config is not None:
            self.scenario_config = scenario_config
        if worker_profile is not None:
            self.worker_profile = worker_profile
        if case_state is not None:
            self.case_state = case_state

class new_employment_worker_update_trust_and_record_round3__metric_recorder_finalize_metrics(Event):
    """
    Event for new_employment_worker_update_trust_and_record_round3__metric_recorder_finalize_metrics
    
    Attributes:
        from_agent_id (str): ID of the agent sending this event
        to_agent_id (str): ID of the agent receiving this event
        scenario_config (dict): 仿真场景配置，包含机制开关和三轮固定问题集
        worker_profile (dict): 更新后的从业者画像，包含第三轮后的 current_trust 和 reported_in_round3 标记
        metrics_container (dict): 追加第三轮完整行为记录后的指标容器
    """
    def __init__(self,
        from_agent_id: str,
        to_agent_id: str,
        scenario_config: Optional[Dict[str, Any]] = None,
        worker_profile: Optional[Dict[str, Any]] = None,
        metrics_container: Optional[Dict[str, Any]] = None,
        **kwargs: Any
    ) -> None:
        super().__init__(from_agent_id=from_agent_id, to_agent_id=to_agent_id, **kwargs)
        if scenario_config is not None:
            self.scenario_config = scenario_config
        if worker_profile is not None:
            self.worker_profile = worker_profile
        if metrics_container is not None:
            self.metrics_container = metrics_container

class finalize_metrics_end(Event):
    """
    Event for finalize_metrics_end
    
    Attributes:
        from_agent_id (str): ID of the agent sending this event
        to_agent_id (str): ID of the agent receiving this event
        metrics_container (dict): 汇总并固化全部仿真运行指标数据，包含八项因变量及元信息
    """
    def __init__(self,
        from_agent_id: str,
        to_agent_id: str,
        metrics_container: Optional[Dict[str, Any]] = None,
        **kwargs: Any
    ) -> None:
        super().__init__(from_agent_id=from_agent_id, to_agent_id=to_agent_id, **kwargs)
        if metrics_container is not None:
            self.metrics_container = metrics_container

