# 玉兰万象场景输入稿

## 第一步：概括描述输入

```text
构建一个“新就业群体参与城市问题上报与治理反馈”的可控社会仿真实验。外卖骑手和网约车司机在日常工作动线中发现小区通行、道路设施、交通、社区服务或公共安全问题。他们会根据时间压力、对治理主体的信任、隐私顾虑、服务需求、公民动机和数字熟练度决定是否上报。系统接收语音、文字、图片和抽象位置，对普通问题进行脱敏、结构化、重复合并、分类和风险分级，但只提供建议分派，必须由治理人员人工确认。社区、物业或政府部门处理工单并反馈进度与结果。严重事故、火灾、治安或急救事件必须跳出普通流程，提示使用 110、119、120 或 122。比较四种情景：S0 零散渠道；S1 增加 AI 上报；S2 在 S1 上增加透明反馈；S3 在 S2 上增加按托管、驿站、换电等服务需求匹配的差异化激励。研究重点是有效上报、重复或无效、分派准确、处置时间、参与者耗时和群体参与差距。所有角色和结果均为合成仿真，不代表真实调查。
```

## 第二步：Agent 与交互描述输入

```text
Agent 类型包括：NewEmploymentWorker（动作：发现、判断、上报、放弃、确认、查看反馈、更新信任）；StationManager（提醒、核实、协助补充）；Resident（产生问题、补充信息、确认改善）；AICoordinator（脱敏、结构化、去重、分类、风险分级、建议分派）；GovernanceReviewer（人工确认、退回、分派）；CommunityResolver、PropertyResolver、GovernmentResolver（核实、处理、转交、反馈）；EmergencyRouter（识别紧急事件并提示法定应急号码）；ServiceMatcher（按需求匹配非现金服务权益）；MetricRecorder（记录事件与指标）。

交互必须形成有限、无环流程：Resident/环境产生问题 → Worker 发现并决定 → 放弃则记录结束，上报则由 EmergencyRouter 判断 → 紧急则提示法定渠道并结束，普通问题进入 AICoordinator → GovernanceReviewer 人工确认 → 从 Community/Property/Government 三类处置者中择一 → Feedback 返回 → S3 才经过 ServiceMatcher → Worker 更新信任 → MetricRecorder 记录并结束。不得让 AI 自动代替应急机构或行政人员作最终决定。
```

## 第三步：画像字段

`NewEmploymentWorker` 至少包含：`worker_id`、`worker_type`、`time_pressure`、`care_pressure`、`trust`、`privacy_concern`、`service_need`、`civic_motivation`、`digital_comfort`、`past_feedback_quality`。

处置者至少包含：`jurisdiction`、`capacity`、`backlog`、`response_norm_hours`、`manual_review_strictness`。问题环境至少包含：`issue_type`、`severity`、`location_cell`、`duplicate_group`、`created_step`。

## 第四步：四次复制实验

复制同一场景为 S0—S3，使用相同画像主本和副本。每个情景至少运行 5 个副本；正式报告建议 20 轮。每次只按 `scenario-config.md` 打开对应机制，导出事件、决策、执行记录、平台报告和关键界面截图。
