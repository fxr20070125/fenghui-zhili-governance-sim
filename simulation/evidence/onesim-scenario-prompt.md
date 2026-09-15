# 蜂汇智理：玉兰万象场景输入稿（稳定建图版）

## 使用方法

1. 将“第一步：概括描述”粘贴到平台的概括描述输入框。
2. 将“第二步：研究目标”填入平台的研究目标栏；若该栏是自动生成的，则直接覆盖。
3. 生成后，将“第三步：Agent 描述”和“第四步：Agent 交互描述”替换平台自动生成的对应内容。
4. 再生成图骨架。此版本采用固定线性骨架和条件执行，避免复杂分支汇合造成 `trigger=all`、断路或漏记指标。

## 第一步：概括描述

```text
本仿真研究“蜂汇智理”平台的不同机制能否促进外卖骑手和网约车司机参与城市治理。新就业群体在移动工作中可能发现道路破损、公共设施损坏、交通信号异常、小区出入口障碍、社区服务缺失或公共安全隐患。仿真不预测现实政策效果，只使用合成人物和合成事件，对不同机制的相对表现进行探索性比较。

每名NewEmploymentWorker具有职业类型、时间压力、家庭照护压力、治理信任、隐私顾虑、服务需求、公民责任感和数字工具熟练度等画像。他们根据画像、当前事件和此前经历决定是否上报。不上报时记录主要原因；上报时可提交语音、文字、图片及处置所需位置。系统删除姓名、手机号、车牌号和连续行动轨迹等个人识别信息，仅保留问题处置所需的信息。

实验比较四种机制。S0为零散上报，不启用AI结构化、透明反馈和服务激励；S1增加AI辅助脱敏、结构化、去重、分类、风险分级和责任主体建议；S2在S1基础上增加责任主体、处置进度、结果和未解决原因等透明反馈；S3在S2基础上，对真实有效上报按个人需求匹配驿站、换电或托管信息等非现金服务权益。不得以商业派单优待作为激励。

所有普通问题的正式派单必须由GovernanceReviewer人工确认，AI不得替代行政决策。确认后的工单交给ResponsibleEntity处理，responsible_type可为community、property或government，且每张工单只能对应一个责任类型。严重交通事故、火灾、治安冲突或急救事件必须标记为emergency，只提示110、119、120或122等法定渠道，后续普通治理节点只传递状态，不得建立普通工单。

每次仿真依次发生三次独立的问题发现机会。三轮使用相同的固定顺序：生成问题、发现问题、判断紧急性、决定是否上报、按机制处理、人工审核、责任主体处置、按机制反馈、按机制匹配非现金服务、更新信任、记录指标。为了稳定生成行为图，所有节点按这一顺序线性连接，不设置多分支汇合；节点根据flow_status决定执行实际操作或仅原样传递状态。若flow_status为emergency、not_reported或review_rejected，不适用的后续节点必须skip并保持原状态，但仍要走到本轮MetricRecorder，确保所有结果均被记录。

第一轮记录后进入第二轮，第二轮记录后进入第三轮，第三轮记录后执行FinalizeMetrics并结束。前一轮更新后的信任供下一轮上报决策使用。最终计算有效上报率、重复或无效上报率、分派准确率、平均处置时间、平均上报耗时、第三轮持续参与率，以及外卖骑手和网约车司机之间的参与差距。四种机制必须使用同一套人物画像、问题集和处置能力。

全部人物画像、事件和结果均为合成数据。仿真结果只用于比较机制方向、展示系统流程和发现潜在权衡，不得表述为真实调查结论、真实平台成效或政策效果证明。
```

## 第二步：研究目标

```text
在保持人物画像、三轮问题集和治理处置能力相同的条件下，以scenario_id（S0、S1、S2、S3）为唯一实验自变量，比较AI辅助上报、透明治理反馈和按需非现金服务激励对新就业群体城市治理参与的影响。因变量为有效上报率、重复或无效上报率、人工分派准确率、平均上报耗时、平均处置时间、第三轮持续参与率、治理信任变化，以及外卖骑手与网约车司机的参与率差距。研究同时检查隐私最小化、法定应急分流和人工最终决策是否在全部情景中得到遵守。所有结论仅用于合成仿真中的机制比较，不外推为现实政策因果效果。
```

## 第三步：Agent 描述

```text
【ScenarioController】
仿真实验控制器，负责读取scenario_id并设置机制开关。
LoadScenario：读取S0、S1、S2或S3；设置ai_reporting_enabled、transparent_feedback_enabled、service_reward_enabled，并初始化round_id、flow_status和指标容器。S0三个开关全为false；S1仅AI开关为true；S2开启AI与透明反馈；S3三个开关全为true。

【IssueGenerator】
从固定的合成问题库中按预设顺序提供城市问题，保证不同情景使用相同问题。
IssueGenerator具有三个静态字典属性round1_issue、round2_issue、round3_issue，每个字典固定包含issue_id、issue_type、severity、location_cell、duplicate_group、expected_responsible_type和ground_truth_emergency。四个情景复制使用完全相同的三个字典。
GenerateIssue_Round1：必须直接读取round1_issue属性并逐字段输出，禁止由LLM生成问题字段，禁止让scenario_id影响问题内容；明确设置round_id=1、flow_status=pending，并初始化本轮结果字段。
GenerateIssue_Round2：必须直接读取round2_issue属性并逐字段输出，禁止从第一轮问题字段推导或由LLM生成；将上一轮trust_after复制为本轮trust_before；明确设置round_id=2、flow_status=pending，并将emergency_flag、report_decision、non_report_reason、report_time、processed_by_ai、processing_mode、anonymized_content、duplicate_flag、risk_level、suggested_responsible_type、review_result、responsible_type、rejection_reason、dispatch_correct、resolution_status、resolution_hours、resolution_notes、feedback_delivered、reward_type和valid_report全部重置为本轮默认值，禁止透传第一轮结果。
GenerateIssue_Round3：必须直接读取round3_issue属性并逐字段输出，禁止从第二轮问题字段推导或由LLM生成；将第二轮trust_after复制为本轮trust_before；明确设置round_id=3、flow_status=pending，并按第二轮相同规则重置全部本轮结果字段，禁止透传第二轮结果。

【NewEmploymentWorker】
外卖骑手或网约车司机，是城市问题的发现者和潜在上报者，根据个人画像和既往经历作出行为决策。
DiscoverIssue_Round1：观察第一轮问题；trust_before必须直接读取本人的governance_trust属性，不得由LLM生成；同时输出worker_id、worker_type和当前画像状态。
DecideToReport_Round1：若flow_status为emergency则跳过决策；否则根据时间压力、照护压力、信任、隐私顾虑、服务需求、公民责任感和数字熟练度决定是否上报。上报设置flow_status=reported，不上报设置flow_status=not_reported并记录主要原因和上报耗时。
UpdateTrust_Round1：信任更新的唯一入口条件是report_decision=true且emergency_flag=false。满足条件时，根据feedback_delivered、review_result、resolution_status和reward_type更新trust_after；不满足条件时令trust_after=trust_before。严禁使用flow_status=reported或“后续未被拒绝”作为入口条件，因为执行到本节点时成功工单的flow_status已经是handled，审核拒绝的flow_status已经是review_rejected；审核拒绝也是一次真实上报经历，同样必须参与信任更新。
DiscoverIssue_Round2：观察第二轮问题并读取第一轮更新后的信任。
DecideToReport_Round2：采用与第一轮相同规则作出第二次决定。
UpdateTrust_Round2：信任更新的唯一入口条件仍为report_decision=true且emergency_flag=false。满足条件时，根据feedback_delivered、review_result、resolution_status和reward_type更新trust_after；否则令trust_after=trust_before。严禁判断flow_status是否等于reported；handled和review_rejected状态下均应依据本轮经历更新信任。
DiscoverIssue_Round3：观察第三轮问题并读取第二轮更新后的信任。
DecideToReport_Round3：采用与第一轮相同规则作出第三次决定。
UpdateTrust_Round3：信任更新的唯一入口条件仍为report_decision=true且emergency_flag=false。满足条件时，根据feedback_delivered、review_result、resolution_status和reward_type更新trust_after；否则令trust_after=trust_before。严禁判断flow_status是否等于reported；handled和review_rejected状态下均应依据本轮经历更新信任。

【EmergencyRouter】
判断问题是否必须进入法定应急渠道。
CheckEmergency_Round1：依据ground_truth_emergency核验问题；若属于严重事故、火灾、治安冲突或急救，设置emergency_flag=true、flow_status=emergency并提示110、119、120或122；否则设置emergency_flag=false并保持flow_status=pending，不得生成normal等未声明状态。
CheckEmergency_Round2：采用相同规则判断第二轮问题。
CheckEmergency_Round3：采用相同规则判断第三轮问题。

【AICoordinator】
按情景执行上报辅助，但不作最终行政决定。
ProcessReport_Round1：仅当flow_status=reported时执行。S1、S2、S3执行脱敏、结构化、去重、分类、风险分级和责任主体建议，并设置processed_by_ai=true；S0不执行上述AI处理，仅保留零散上报并设置processing_mode=manual_fragmented、processed_by_ai=false。其他flow_status只传递状态并skip。
ProcessReport_Round2：采用相同规则处理第二轮。
ProcessReport_Round3：采用相同规则处理第三轮。

【GovernanceReviewer】
人工治理审核员，负责审核普通上报并作出最终派单决定。
ReviewAndAssign_Round1：仅当flow_status=reported时人工审核。若拒绝，设置flow_status=review_rejected、valid_report=false并记录原因；若通过，设置flow_status=assigned，从community、property、government中确定唯一responsible_type，并在emergency_flag=false、report_decision=true且duplicate_flag=false时设置valid_report=true，否则设置valid_report=false。其他状态设置valid_report=false，只传递并skip。
ReviewAndAssign_Round2：采用相同规则审核第二轮。
ReviewAndAssign_Round3：采用相同规则审核第三轮。

【ResponsibleEntity】
被人工指定的责任主体，其responsible_type为community、property或government之一。
HandleIssue_Round1：仅当flow_status=assigned时核实并处理工单；通过responsible_type是否等于expected_responsible_type确定dispatch_correct；记录resolution_status、resolution_hours和结果说明，并设置flow_status=handled；其他状态只传递并skip。
HandleIssue_Round2：采用相同规则处理第二轮。
HandleIssue_Round3：采用相同规则处理第三轮。

【FeedbackSystem】
根据实验情景向上报者提供或不提供治理反馈。
DeliverFeedback_Round1：仅当transparent_feedback_enabled=true且本轮提交了普通上报时，返回审核状态、责任主体、处置进度、结果及未解决原因，并设置feedback_delivered=true；其他情况设置feedback_delivered=false后继续。
DeliverFeedback_Round2：采用相同规则处理第二轮。
DeliverFeedback_Round3：采用相同规则处理第三轮。

【ServiceMatcher】
根据情景和个人需求匹配非现金服务权益。
MatchService_Round1：仅当service_reward_enabled=true且本轮属于真实有效上报时，按service_need匹配驿站、换电或托管信息等一项非现金服务，并记录reward_type；否则记录reward_type=none。禁止提供商业派单优待或现金奖励。
MatchService_Round2：采用相同规则处理第二轮。
MatchService_Round3：采用相同规则处理第三轮。

【MetricRecorder】
记录每轮完整结果并在三轮后汇总指标。
MetricRecorder具有私有动态字典属性metrics_container，初始值为{round1_records:[], round2_records:[], round3_records:[]}。该属性是三轮记录的唯一持久存储，禁止在数据流清理阶段删除。
RecordMetrics_Round1：无论本轮是紧急转接、不上报、审核拒绝或正常处置，均把scenario_id、round_id、worker_id、worker_type、issue_id、issue_type、emergency_flag、report_decision、non_report_reason、report_time、processed_by_ai、duplicate_flag、valid_report、review_result、responsible_type、expected_responsible_type、dispatch_correct、resolution_status、resolution_hours、feedback_delivered、reward_type、trust_before和trust_after组成一条记录，追加到自身metrics_container.round1_records并写回metrics_container。valid_report仅当emergency_flag=false、report_decision=true、duplicate_flag=false且review_result=approved时为true。
RecordMetrics_Round2：将同样结构的第二轮记录追加到自身metrics_container.round2_records并写回，必须保留round1_records。
RecordMetrics_Round3：将同样结构的第三轮记录追加到自身metrics_container.round3_records并写回，必须保留前两轮记录。
FinalizeMetrics：必须读取自身持久属性metrics_container中的三轮记录，而不是只读取第三轮入边字段；必须明确输出全部八项因变量：effective_reporting_rate、invalid_or_duplicate_rate、dispatch_accuracy、average_report_time、average_resolution_hours、round3_continued_participation_rate、trust_change、worker_type_participation_gap。有效上报率=valid_report为true的次数/非紧急问题发现次数；重复无效率=普通上报中duplicate_flag=true或review_result=rejected的次数/普通上报次数；分派准确率=正确分派数/审核通过工单数；average_report_time为普通上报report_time的平均分钟数；average_resolution_hours为已处置工单resolution_hours的平均小时数；持续参与率按worker_id关联第一轮与第三轮；trust_change按worker_id计算第三轮trust_after减第一轮trust_before；群体参与差距按worker_type分组计算。
```

## 第四步：Agent 交互描述

```text
本图必须是单入口、无回边的线性有向图。所有节点只有一个直接后继；禁止生成XOR、并行扇出、多对一聚合和trigger=all。节点遇到不适用状态时执行skip并原样传递flow_status，不能提前进入End。

start →
(1) ScenarioController::LoadScenario →
(2) IssueGenerator::GenerateIssue_Round1 →
(3) NewEmploymentWorker::DiscoverIssue_Round1 →
(4) EmergencyRouter::CheckEmergency_Round1 →
(5) NewEmploymentWorker::DecideToReport_Round1 →
(6) AICoordinator::ProcessReport_Round1 →
(7) GovernanceReviewer::ReviewAndAssign_Round1 →
(8) ResponsibleEntity::HandleIssue_Round1 →
(9) FeedbackSystem::DeliverFeedback_Round1 →
(10) ServiceMatcher::MatchService_Round1 →
(11) NewEmploymentWorker::UpdateTrust_Round1: 只按report_decision=true且emergency_flag=false判断是否更新信任；成功处置handled和审核拒绝review_rejected都属于真实上报经历，均需结合feedback_delivered、review_result、resolution_status和reward_type更新trust_after；禁止使用flow_status=reported作为条件 →
(12) MetricRecorder::RecordMetrics_Round1 →
(13) IssueGenerator::GenerateIssue_Round2 →
(14) NewEmploymentWorker::DiscoverIssue_Round2 →
(15) EmergencyRouter::CheckEmergency_Round2 →
(16) NewEmploymentWorker::DecideToReport_Round2 →
(17) AICoordinator::ProcessReport_Round2 →
(18) GovernanceReviewer::ReviewAndAssign_Round2 →
(19) ResponsibleEntity::HandleIssue_Round2 →
(20) FeedbackSystem::DeliverFeedback_Round2 →
(21) ServiceMatcher::MatchService_Round2 →
(22) NewEmploymentWorker::UpdateTrust_Round2: 只按report_decision=true且emergency_flag=false判断是否更新信任；handled和review_rejected均需更新，禁止使用flow_status=reported作为条件 →
(23) MetricRecorder::RecordMetrics_Round2 →
(24) IssueGenerator::GenerateIssue_Round3 →
(25) NewEmploymentWorker::DiscoverIssue_Round3 →
(26) EmergencyRouter::CheckEmergency_Round3 →
(27) NewEmploymentWorker::DecideToReport_Round3 →
(28) AICoordinator::ProcessReport_Round3 →
(29) GovernanceReviewer::ReviewAndAssign_Round3 →
(30) ResponsibleEntity::HandleIssue_Round3 →
(31) FeedbackSystem::DeliverFeedback_Round3 →
(32) ServiceMatcher::MatchService_Round3 →
(33) NewEmploymentWorker::UpdateTrust_Round3: 只按report_decision=true且emergency_flag=false判断是否更新信任；handled和review_rejected均需更新，禁止使用flow_status=reported作为条件 →
(34) MetricRecorder::RecordMetrics_Round3 →
(35) MetricRecorder::FinalizeMetrics →
end

状态执行规则：
- flow_status=emergency：从DecideToReport到ServiceMatcher的治理动作均skip，不建立普通工单；UpdateTrust保持信任不变；MetricRecorder记录紧急转接。
- flow_status=not_reported：AICoordinator、GovernanceReviewer、ResponsibleEntity、FeedbackSystem和ServiceMatcher均skip或输出false/none；MetricRecorder记录不上报原因。
- flow_status=reported：AICoordinator依据scenario_id采用AI处理或manual_fragmented处理，然后交由人工审核。
- flow_status=review_rejected：ResponsibleEntity不得处置；FeedbackSystem依据情景决定是否告知拒绝及原因；之后正常记录指标。
- flow_status=assigned：仅ResponsibleEntity执行处置，并将状态改为handled。
- 所有情景、所有结果都必须依次经过本轮UpdateTrust与MetricRecorder，任何节点不得提前连接End。三个UpdateTrust动作的入口判断只能使用report_decision和emergency_flag，绝对禁止使用flow_status=reported；flow_status只作为经历结果传入信任更新公式。
- worker_id必须从NewEmploymentWorker画像读取并在三轮中保持不变；trust_before在第一轮读取governance_trust，第二、三轮分别等于上一轮trust_after。
- 每轮开始必须重置本轮结果字段。round_id依次明确赋值为1、2、3，flow_status依次重置为pending，禁止把上一轮的处理结果直接透传为下一轮初值。
- 统一枚举：worker_type仅使用delivery_rider/ride_driver；resolution_status仅使用not_applicable/resolved/partially_resolved/unresolved；reward_type仅使用none/rest_station/battery_swap/childcare；report_time统一使用分钟。
- scenario_id是唯一实验自变量；三个机制开关必须由scenario_id确定，不得随机生成。
- MetricRecorder的metrics_container必须作为自身动态属性跨三轮保存；RecordMetrics_Round1、Round2、Round3分别追加记录，FinalizeMetrics从该属性读取完整历史。禁止在字段清理时删除metrics_container，禁止仅凭第三轮当前事件计算跨轮指标。
```

## 第五步：画像字段与数量

`NewEmploymentWorker` 至少包含：`worker_id`、`worker_type`、`time_pressure`、`caregiving_pressure`、`governance_trust`、`privacy_concern`、`service_need`、`civic_responsibility`、`digital_literacy`、`past_feedback_quality`。

`IssueGenerator` 必须包含三个静态字典属性`round1_issue`、`round2_issue`、`round3_issue`，每个字典包含：`issue_id`、`issue_type`、`severity`、`location_cell`、`duplicate_group`、`expected_responsible_type`、`ground_truth_emergency`。`MetricRecorder`必须包含动态字典属性`metrics_container`。`ResponsibleEntity`至少包含：`capacity`、`backlog`、`response_norm_hours`。`GovernanceReviewer`至少包含：`manual_review_strictness`。

由于当前图的路由会把事件按实例数量发送，首次测试时每个副本只放置 1 个`NewEmploymentWorker`，其他功能型Agent也各放1个；通过生成多个画像副本获得不同劳动者样本，避免单次运行中事件成倍扩散。行为图已经包含三轮，单个副本的仿真循环次数设置为1。

## 第六步：四情景实验

复制同一场景为 S0—S3，使用相同画像主本、相同问题库和相同处置能力。每个情景先运行 1 次做流程检查，正式实验至少运行 5 个重复副本，条件允许时建议 20 次。每次只改变三个机制开关，并导出事件日志、决策记录、指标结果、平台报告和关键界面截图。
