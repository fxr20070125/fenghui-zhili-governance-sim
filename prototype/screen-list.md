# 蜂汇智理 屏幕清单与截图索引（原型 v0.1）

- 负责人：AI 3
- 所属轮次：第一轮
- 运行入口：`prototype/app/index.html`（直接双击即可，无需服务器与构建）

---

## 1 信息架构

```text
顶部：演示控制台（情景切换 / 演示数据重置 / 角色切换）
      + 常驻声明条「原型演示环境 · 数据为虚构或脱敏 · 不代表真实系统接入」

① 骑手端 (#/rider/*)          ② 治理端 (#/gov/*)            ③ 仿真端 (#/sim/*)
├ 首页            home        ├ 事件列表      events       ├ 情景对比      compare
├ 一键上报        report      ├ 事件详情      events/:id   ├ 参数与假设    config
├ AI 识别与确认   ai-review   ├ 事件地图      map          └ 结果局限      limits
├ 处理进度与结果  progress    └ 核心指标概览  metrics
└ 服务查询        services
```

## 2 骑手端屏幕

| 编号 | 屏幕 | 路由 | 关键元素 | 主要动作 |
| --- | --- | --- | --- | --- |
| R-A | 首页 | `#/rider/home` | 身份卡、积分、四个上报入口、我的上报列表、服务卡片 | 选择上报方式；进入进度页；进入服务查询 |
| R-B | 一键上报 | `#/rider/report` | 语音卡、照片卡、位置卡、文字卡、演示控制台 | 录音（演示）、选照片、调位置、填写文字、AI 识别 |
| R-C | AI 识别与确认 | `#/rider/ai-review` | 脱敏结果、结构化要素、类别建议、风险等级、重复候选、应急卡（条件）、确认提交 | 切换类别、编辑描述、合并重复、确认提交 |
| R-D | 处理进度与结果 | `#/rider/progress` | 上报列表、状态筛选、时间轴、处置结果、积分变化 | 切换上报项、查看反馈 |
| R-E | 服务查询 | `#/rider/services` | 驿站服务点卡片、服务内容、开放说明 | 查看服务详情（演示数据） |

## 3 治理端屏幕

| 编号 | 屏幕 | 路由 | 关键元素 | 主要动作 |
| --- | --- | --- | --- | --- |
| G-A | 事件列表 | `#/gov/events` | 指标条、筛选、事件卡片、风险与状态徽标、AI 置信度 | 筛选、选中事件、查看详情 |
| G-B | 事件详情 | `#/gov/events/:id` | 示意地图、AI 建议卡、人工决定区、处置反馈表单、时间轴 | 确认并分派、退回补充、转交、录入处置结果 |
| G-C | 事件地图 | `#/gov/map` | 示意底图、分布标记、重复聚合标记、图例 | 点击标记、切换图层 |
| G-D | 核心指标概览 | `#/gov/metrics` | 「已可演示口径」与「待仿真结果」两区 | 查看占位标记说明 |

## 4 仿真端屏幕

| 编号 | 屏幕 | 路由 | 关键元素 | 主要动作 |
| --- | --- | --- | --- | --- |
| S-A | 情景对比 | `#/sim/compare` | S0–S3 情景卡、占位横幅、六项指标对比表、参与差距分组、结论占位框 | 切换情景、查看单元格依据 |
| S-B | 参数与假设 | `#/sim/config` | 参数表（值 / 来源 / 影响情景）、情景新增机制说明 | 调整参数权重、恢复默认 |
| S-C | 结果局限 | `#/sim/limits` | 占位状态、合成数据声明、未覆盖内容、与报告对接要求 | 阅读 |

## 5 截图索引

所有截图均由本地脚本 `prototype/app/shot.js` 用无头 Edge 渲染**真实页面**生成，不使用手工绘制的示意图。

| 文件 | 对应屏幕 | 说明 |
| --- | --- | --- |
| `screenshots/01-rider-home.png` | R-A | 骑手端首页 |
| `screenshots/02-rider-report-voice.png` | R-B | 上报页：语音 + 照片 + 位置 + 文字组合输入 |
| `screenshots/03-rider-ai-review-ok.png` | R-C | AI 识别与确认（普通事件） |
| `screenshots/04-rider-ai-review-emergency.png` | R-C | AI 识别与确认（紧急事件：应急转接卡） |
| `screenshots/05-rider-progress.png` | R-D | 处理进度与结果反馈 |
| `screenshots/06-rider-services.png` | R-E | 服务查询（驿站演示数据） |
| `screenshots/07-gov-events.png` | G-A | 治理端事件列表 |
| `screenshots/08-gov-event-detail.png` | G-B | 事件详情：AI 建议 vs 人工决定 |
| `screenshots/09-gov-map.png` | G-C | 事件地图与重复聚合 |
| `screenshots/10-gov-metrics.png` | G-D | 核心指标概览（含占位标记） |
| `screenshots/11-sim-compare.png` | S-A | S0–S3 六项指标对比（占位数据） |
| `screenshots/12-sim-config.png` | S-B | 参数与假设 |
| `screenshots/13-sim-limits.png` | S-C | 结果局限说明 |

截图分辨率 1440×1000（设备像素比 2，便于报告排版）。

## 6 演示控制台说明

页面顶部常驻控制台，用于评委提问时快速跳转：

| 控件 | 作用 |
| --- | --- |
| 角色切换 | 在骑手端 / 治理端 / 仿真端之间跳转 |
| 情景下拉 | 在 S0 / S1 / S2 / S3 之间切换（仅演示情景标签与激励开关） |
| 重置演示数据 | 恢复初始虚构数据 |
| 载入场景 | 快速载入「普通事件 / 重复事件 / 紧急事件」三类演示状态 |
| 演示模式 | 隐藏控制台，用于正式录屏 |

## 7 文档与原型的一致性

| 交付物 | 对应实现 |
| --- | --- |
| `product-requirements.md` 第 5 节 R1–R15 | 均在对应屏幕可操作 |
| `user-flow.md` 状态机 | 路由与状态徽标一致 |
| `technical-flow.md` 第 3 节管线 | `engine.js` 中同名函数与阶段标签 |
| `safety-and-privacy.md` 脱敏规则 | `data.js` 中 `piiRules` 与「已脱敏」区块 |
| `demo-script.md` 录屏步骤 | 步骤与截图编号一一对应 |
