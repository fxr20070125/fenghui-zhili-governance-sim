# 蜂汇智理：玉兰万象 30 分钟紧凑版输入稿

> 用途：优先跑通玉兰万象完整流程。目标结构为 4 类 Agent、11 个动作节点、约 10 条动作间连线，所有事件最多携带 4 个顶层对象。平台服务器负载不可控，“30 分钟”是图传播数据的目标时间，不是硬性保证。

## 一、使用顺序

1. 新建场景“蜂汇智理-快速版-v1”，不要覆盖已经生成的完整版。
2. 依次填写下列“概括描述、研究目标、Agent 描述、Agent 交互描述”。
3. 生成图骨架后，只有满足“4 类 Agent、11 个动作、单链无回边”才继续。
4. 生成图传播数据后，确认每条事件只有 `scenario_config`、`worker_profile`、`case_state`、`metrics_container` 四个顶层对象；禁止展开为二十多个独立字段。
5. 首次画像只建立 4 个主本实例，每类 Agent 各 1 个，并勾选“直接采用主本”。

## 二、概括描述

```text
“蜂汇智理”仿真比较四种新就业群体参与城市治理的机制。外卖骑手和网约车司机在移动工作中发现道路、设施、交通、社区服务或公共安全问题，并依据时间压力、照护压力、治理信任、隐私顾虑、服务需求、公民责任感和数字熟练度决定是否上报。全部人物、问题和结果均为合成数据，只用于机制方向比较。

实验唯一自变量为scenario_id。S0不启用AI辅助、透明反馈和服务激励；S1仅启用AI脱敏、结构化、去重、分类、风险分级和责任主体建议；S2在S1上增加透明反馈；S3在S2上增加驿站、换电或托管信息等按需非现金服务。四种机制必须使用完全相同的人物批次、三轮固定问题和处置能力。

为缩短建图时间，仿真只保留四类Agent：ScenarioController负责实验配置；NewEmploymentWorker以一个批次对象表示若干合成骑手和司机；GovernanceWorkflow表示一个具有明确内部阶段的治理工作流；MetricRecorder负责汇总。GovernanceWorkflow不是自动行政决策者，其内部必须依次记录“应急判断、AI或人工信息处理、人工审核确认、责任主体处置、反馈、服务匹配”。AI只能形成建议，只有human_review_confirmed=true时才能生成普通工单。严重事故、火灾、治安冲突或急救必须转110、119、120或122，不进入普通工单。

每次仿真严格执行三轮：从业者批次发现并决定、治理工作流处理、从业者更新信任并记录；三轮后汇总八项指标。图为单入口、无分支汇合、无回边的线性图。条件不适用时在当前节点内部skip，但仍沿主链向后传播。

为避免图传播数据生成数小时，所有边最多只携带四个顶层对象：scenario_config、worker_profile、case_state、metrics_container。具体变量必须作为对象内部键保存，禁止拆成独立顶层字段。三轮问题与从业者批次均从静态属性读取，禁止由LLM临时生成或随scenario_id改变。
```

## 三、研究目标

### 自变量

| 名称 | 含义 | 档位 |
|---|---|---|
| `scenario_id` | 蜂汇智理机制组合，是唯一实验自变量 | `S0/S1/S2/S3` |

### 因变量

| 名称 | 含义 | 如何测量 |
|---|---|---|
| `effective_reporting_rate` | 有效上报率 | 有效普通上报数 ÷ 非紧急问题发现数 |
| `invalid_or_duplicate_rate` | 重复或无效上报率 | 重复或审核拒绝数 ÷ 普通上报数 |
| `dispatch_accuracy` | 人工分派准确率 | 正确责任主体数 ÷ 审核通过工单数 |
| `average_report_time` | 平均上报耗时 | 普通上报耗时的平均分钟数 |
| `average_resolution_hours` | 平均处置时间 | 已处置工单处理小时数的平均值 |
| `round3_continued_participation_rate` | 第三轮持续参与率 | 第一轮有上报经历者中第三轮仍上报的比例 |
| `trust_change` | 治理信任变化 | 第三轮信任减第一轮初始信任的平均值 |
| `worker_type_participation_gap` | 骑手与司机参与差距 | 两类从业者普通上报率之差的绝对值 |

### 作用机制

```text
scenario_id决定AI辅助、透明反馈和非现金服务三个开关；AI辅助影响上报耗时、信息完整性、去重和分派建议，透明反馈影响经历后的治理信任，按需服务影响持续参与。应急分流和人工最终确认在四个情景中始终不变。人物批次、固定问题集与治理能力保持相同，因此比较只解释为合成仿真内的机制差异，不解释为现实因果效果。
```

## 四、Agent 描述

```text
【ScenarioController】
实验控制器，只有1个实例。静态属性scenario_config是一个字典，包含scenario_id、ai_reporting_enabled、transparent_feedback_enabled、service_reward_enabled和fixed_issue_set。fixed_issue_set包含三轮固定合成问题分配，四个情景完全相同。
LoadScenario：读取scenario_id并确定三个开关。S0=(false,false,false)，S1=(true,false,false)，S2=(true,true,false)，S3=(true,true,true)。初始化case_state={round_id:0,cases:[]}和metrics_container={records:[]}。只输出scenario_config、case_state、metrics_container，不展开对象内部字段。

【NewEmploymentWorker】
新就业群体批次代理，只有1个实例。静态属性worker_profile是一个字典，其中workers列表保存至少2名外卖骑手和2名网约车司机的合成画像；每人包含worker_id、worker_type、time_pressure、caregiving_pressure、current_trust、initial_trust、privacy_concern、service_need、civic_responsibility和digital_literacy。
DiscoverAndDecide_Round1：每次新的独立运行开始时，先把每名从业者的current_trust重置为initial_trust，防止上一运行或上一情景污染本次结果；再从scenario_config.fixed_issue_set读取第1轮固定问题，禁止由LLM生成问题；按每名从业者画像分别决定是否尝试上报并估计report_time，写入case_state.cases。将round_id设为1。不得修改metrics_container。
UpdateTrustAndRecord_Round1：读取GovernanceWorkflow返回的每人处置结果。只有attempted_report=true且emergency_flag=false时，才依据feedback_delivered、human_review_result、resolution_status和reward_type更新current_trust；其他情况信任不变。把每人的本轮完整记录追加到metrics_container.records，并把更新后信任写回worker_profile。
DiscoverAndDecide_Round2、DiscoverAndDecide_Round3：分别读取第2、3轮固定问题，沿用上一轮信任并按相同规则决策；每轮必须重建case_state.cases，禁止透传上一轮结果。
UpdateTrustAndRecord_Round2、UpdateTrustAndRecord_Round3：采用相同更新与追加规则，必须保留此前records。

【GovernanceWorkflow】
治理工作流代理，只有1个实例，是对数字平台、人工审核员和责任主体的紧凑表示，不是AI自动行政决策者。
ProcessRound_Round1：逐条处理case_state.cases。第一阶段依据固定问题的ground_truth_emergency判断应急性；紧急事件写入emergency_flag=true和legal_channel=110/119/120/122，不建立普通工单。非紧急且未尝试上报者只记录not_report_reason。非紧急普通上报中，S0采用manual_fragmented，S1/S2/S3才执行AI脱敏、结构化、去重、分类、风险分级和责任主体建议。随后必须单独执行模拟人工审核并写入human_review_confirmed=true及human_review_result；只有人工审核通过才能指定唯一responsible_type并处置。AI建议不能直接成为正式派单。再按情景决定是否透明反馈、是否匹配非现金服务。最后写入valid_report、duplicate_flag、dispatch_correct、resolution_status、resolution_hours、feedback_delivered和reward_type等对象内部键。
ProcessRound_Round2、ProcessRound_Round3：规则相同，仅处理对应轮次新建的case_state；不得修改人物画像或历史metrics_container。

【MetricRecorder】
指标汇总代理，只有1个实例。
FinalizeMetrics：只读取metrics_container.records中的三轮全部个体记录，计算并明确输出effective_reporting_rate、invalid_or_duplicate_rate、dispatch_accuracy、average_report_time、average_resolution_hours、round3_continued_participation_rate、trust_change、worker_type_participation_gap。分母为0时输出null并说明，不得编造。结果同时标注scenario_id和synthetic_simulation=true。
```

## 五、Agent 交互描述

```text
生成单入口、单主链、无回边的线性有向图。必须恰好包含4类Agent和以下11个动作节点。每个动作只有一个直接后继，每个动作只设置一个Mapping，不得生成XOR、并行扇出、多对一汇合或trigger=all等待多路输入。

start →
(1) ScenarioController::LoadScenario →
(2) NewEmploymentWorker::DiscoverAndDecide_Round1 →
(3) GovernanceWorkflow::ProcessRound_Round1 →
(4) NewEmploymentWorker::UpdateTrustAndRecord_Round1 →
(5) NewEmploymentWorker::DiscoverAndDecide_Round2 →
(6) GovernanceWorkflow::ProcessRound_Round2 →
(7) NewEmploymentWorker::UpdateTrustAndRecord_Round2 →
(8) NewEmploymentWorker::DiscoverAndDecide_Round3 →
(9) GovernanceWorkflow::ProcessRound_Round3 →
(10) NewEmploymentWorker::UpdateTrustAndRecord_Round3 →
(11) MetricRecorder::FinalizeMetrics →
end

数据传播硬约束：
1. 所有动作之间只传播scenario_config:dict、worker_profile:dict、case_state:dict、metrics_container:dict，首条边尚未读取画像时可缺少worker_profile。
2. 禁止把scenario_id、worker_id、flow_status、report_time、trust、review_result等拆成顶层事件字段；它们只能作为上述对象的内部键。
3. scenario_config和既往metrics_container默认passthrough；每轮决策只更新worker_profile与case_state，治理节点只更新case_state，信任记录节点只更新worker_profile与metrics_container。
4. 三轮问题必须读取scenario_config.fixed_issue_set，人物必须读取NewEmploymentWorker.worker_profile，禁止LLM临时创造人物或问题。
5. GovernanceWorkflow内部严格依次执行应急分流、信息处理、人工确认、责任主体处置、反馈和服务匹配；human_review_confirmed不是AI批准，而是对人工关口的模拟记录。
6. 每轮UpdateTrustAndRecord必须追加记录而不是覆盖；FinalizeMetrics必须读取全部三轮记录。
7. 所有功能型Agent只有一个实例，首次运行勾选直接采用主本，避免广播造成事件倍增。
8. 每次独立运行的第一轮必须令current_trust=initial_trust，且LoadScenario必须重新初始化metrics_container={records:[]}，保证S0—S3顺序运行时互不污染。
```

## 六、最小画像主本

首次只建立以下4个主本实例：

### ScenarioController（1个）

```json
{
  "scenario_id": "S1",
  "ai_reporting_enabled": true,
  "transparent_feedback_enabled": false,
  "service_reward_enabled": false,
  "fixed_issue_set": {
    "round1": "道路坑洼，中等风险，责任主体government，非紧急",
    "round2": "消防通道出现明火和浓烟，高风险，转119，紧急",
    "round3": "小区无障碍坡道被杂物堵塞，中等风险，责任主体property，非紧急"
  }
}
```

### NewEmploymentWorker（1个批次实例）

```json
{
  "workers": [
    {"worker_id":"rider_01","worker_type":"delivery_rider","time_pressure":0.90,"caregiving_pressure":0.30,"current_trust":0.45,"initial_trust":0.45,"privacy_concern":0.65,"service_need":"battery_swap","civic_responsibility":0.65,"digital_literacy":0.85},
    {"worker_id":"rider_02","worker_type":"delivery_rider","time_pressure":0.65,"caregiving_pressure":0.70,"current_trust":0.60,"initial_trust":0.60,"privacy_concern":0.45,"service_need":"rest_station","civic_responsibility":0.80,"digital_literacy":0.75},
    {"worker_id":"driver_01","worker_type":"ride_driver","time_pressure":0.80,"caregiving_pressure":0.75,"current_trust":0.40,"initial_trust":0.40,"privacy_concern":0.70,"service_need":"childcare","civic_responsibility":0.55,"digital_literacy":0.65},
    {"worker_id":"driver_02","worker_type":"ride_driver","time_pressure":0.55,"caregiving_pressure":0.40,"current_trust":0.70,"initial_trust":0.70,"privacy_concern":0.35,"service_need":"rest_station","civic_responsibility":0.75,"digital_literacy":0.80}
  ]
}
```

### GovernanceWorkflow（1个）

```json
{"manual_review_strictness":0.60,"capacity":0.75,"backlog":0.35,"response_norm_hours":24,"human_gate_required":true}
```

### MetricRecorder（1个）

```json
{"metric_names":["effective_reporting_rate","invalid_or_duplicate_rate","dispatch_accuracy","average_report_time","average_resolution_hours","round3_continued_participation_rate","trust_change","worker_type_participation_gap"]}
```

## 七、验收红线

- 骨架不是4类Agent或不是11个动作：不要生成图传播数据。
- 事件字段被展开成10个以上顶层字段：停止并返回修改描述。
- 出现人工审核前自动派单：不通过。
- 应急事件进入普通工单：不通过。
- 第二、三轮覆盖而非追加历史记录：不通过。
- S0—S3除三个机制开关外还改变画像、问题或治理能力：不通过。
