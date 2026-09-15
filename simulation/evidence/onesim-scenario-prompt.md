# 玉兰万象场景输入稿

## 第一步：概括描述输入

```text
构建一个“新就业群体参与城市问题上报与治理反馈”的可控多智能体社会仿真实验，研究什么样的上报、反馈和服务激励机制，能够在不明显增加从业者时间成本和隐私风险的情况下，提高城市问题的有效发现、正确分派、处置效率和持续参与。

外卖骑手和网约车司机在日常移动工作中，可能发现小区出入口障碍、道路或公共设施损坏、交通信号异常、社区服务缺失及公共安全隐患。每名从业者具有不同的时间压力、家庭照护压力、对治理主体的信任、隐私顾虑、服务需求、公民责任感和数字工具熟练度，并根据个人画像、以往反馈和当前治理机制决定是否上报。不上报时应记录主要原因；上报时可提交语音、文字、图片和处理问题所必需的位置，系统应删除姓名、手机号、车牌和连续行动轨迹等个人识别信息，但保留治理处置所需的问题位置。

普通问题进入治理流程后，系统可按当前机制进行信息结构化、重复合并、问题分类和风险分级，并生成责任层级与处置主体建议。所有正式派单必须经过治理人员人工确认，AI 不得代替社区、物业、街道或政府部门作出最终行政决定。经确认的工单由社区、物业或相应政府部门处理，系统记录是否正确分派、是否解决、处置耗时、进度反馈和最终结果。涉及严重交通事故、火灾、治安冲突或急救的事件必须在所有情景中跳出普通工单流程，只提示使用 110、119、120 或 122 等法定应急渠道。

实验使用同一套问题、画像和处置能力，依次比较四种机制：S0 为微信群、电话等零散上报，缺少统一结构化和持续反馈；S1 仅在 S0 基础上增加 AI 辅助上报，包括脱敏、结构化、去重、分类和建议分派；S2 仅在 S1 基础上增加透明反馈，包括责任主体、处理进度、处置结果和未解决原因；S3 仅在 S2 基础上增加按个人服务需求匹配的非现金激励，例如驿站权益、换电优惠或托管优先信息，不使用商业派单优待作为激励。

为观察反馈对后续信任和持续参与的影响，每次仿真包含三次依次发生的问题发现机会。三次机会必须在行为图中展开为“第一次发现—处置—反馈—信任更新，第二次发现—处置—反馈—信任更新，第三次发现—处置—反馈—信任更新”的有限顺序结构，不画循环回边。最终比较有效上报率、重复或无效上报率、工单分派准确率、平均处置时间、平均上报耗时、最后一次机会的持续参与率，以及骑手和网约车司机之间的参与差距。

全部人物画像、事件和实验结果均为合成数据。仿真用于比较机制方向和暴露潜在权衡，不代表真实调查、真实平台运行成效或政策效果证明。
```

## 点击 B 前：追加到概括描述末尾的生成约束

平台没有单独的“第二步提示词”输入框。完成按钮 A 后，请把下面内容追加到可编辑的概括描述末尾，再点击按钮 B；如果已经生成过 B，则追加后重新生成。

```text
Agent 类型包括：NewEmploymentWorker（动作：发现、判断、上报、放弃、确认、查看反馈、更新信任）；StationManager（提醒、核实、协助补充）；Resident（产生问题、补充信息、确认改善）；AICoordinator（脱敏、结构化、去重、分类、风险分级、建议分派）；GovernanceReviewer（人工确认、退回、分派）；CommunityResolver、PropertyResolver、GovernmentResolver（核实、处理、转交、反馈）；EmergencyRouter（识别紧急事件并提示法定应急号码）；FeedbackSystem（按情景返回责任主体、进度、结果和未解决原因）；ServiceMatcher（按需求匹配非现金服务权益）；MetricRecorder（记录事件与指标）。

交互必须形成有限、无环流程。单次机会为：Resident/环境产生问题 → Worker 发现并决定 → 放弃则记录原因，上报则由 EmergencyRouter 判断 → 紧急则提示法定渠道并结束该机会，普通问题依据情景进入零散渠道或 AICoordinator → GovernanceReviewer 人工确认 → 从 Community/Property/Government 三类处置者中择一 → S2、S3 由 FeedbackSystem 返回透明反馈 → 仅 S3 经过 ServiceMatcher → Worker 更新信任 → MetricRecorder 记录。将这一过程明确展开为三次顺序机会，前一次更新后的信任供下一次决定使用，但不得画循环回边。不得让 AI 自动代替应急机构或行政人员作最终决定。

分支必须正确：不上报、紧急转接或人工拒绝均不得进入责任主体处置动作，而应记录本次结果后进入下一次发现机会；只有经人工确认的普通工单才能进入责任主体处置。三个机会使用 Round1、Round2、Round3 三套不同动作名称，禁止用回边形成循环。所有事件需携带 scenario_id、worker_type、issue_id、report_decision、report_time、duplicate_flag、dispatch_correct、resolution_status、resolution_hours、feedback_delivered、reward_type、trust_before、trust_after 等可统计字段。
```

## 第三步：画像字段

`NewEmploymentWorker` 至少包含：`worker_id`、`worker_type`、`time_pressure`、`care_pressure`、`trust`、`privacy_concern`、`service_need`、`civic_motivation`、`digital_comfort`、`past_feedback_quality`。

处置者至少包含：`jurisdiction`、`capacity`、`backlog`、`response_norm_hours`、`manual_review_strictness`。问题环境至少包含：`issue_type`、`severity`、`location_cell`、`duplicate_group`、`created_step`。

## 第四步：四次复制实验

复制同一场景为 S0—S3，使用相同画像主本和副本。每个情景至少运行 5 个副本；正式报告建议 20 轮。每次只按 `scenario-config.md` 打开对应机制，导出事件、决策、执行记录、平台报告和关键界面截图。
