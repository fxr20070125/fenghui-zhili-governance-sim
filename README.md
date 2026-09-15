# 蜂汇智理

蜂汇智理是新就业群体参与城市治理的 AI 协同与仿真平台。骑手和网约车司机通过语音、文字、图片和位置快速上报城市问题，AI 辅助完成脱敏、结构化、重复合并、分类、风险分级和建议分派；治理人员人工确认并反馈处置结果；社会仿真用于比较不同反馈与激励机制的治理效果。

## 研究问题

什么样的 AI 上报、处置反馈和服务激励机制，能够在不明显增加新就业群体时间成本与隐私风险的情况下，提高城市问题的有效上报率、处置效率和持续参与意愿？

## 四路协作

| 分支 | 负责人 | 专属目录 | 第一轮目标 |
| --- | --- | --- | --- |
| `work/evidence` | AI 1 赛题与证据分析师 | `evidence/` | 官方要求、调研发现、公开案例、合规和事实登记 |
| `work/simulation` | AI 2 社会仿真实验工程师 | `simulation/` | 智能体模型、S0–S3、重复运行、结果和复现材料 |
| `work/prototype` | AI 3 产品原型与演示工程师 | `prototype/` | 骑手端、治理端、仿真端原型与演示素材 |
| `work/integration` | AI 4 总编排与申报集成负责人 | `integration/`、`submission/` | 评审映射、架构、报告、视频、汇总与最终提交 |

所有阶段成果通过 Pull Request 审核后合入 `main`。开始工作前先阅读 `00_PROJECT_BASELINE.md`，不得在第一轮擅自改变冻结内容。

## 固定边界

- 现有 30 人访谈只支持定性发现，不能代表总体比例。
- AI 生成角色、回答和模拟结果属于合成数据，不能冒充真实调查。
- AI 只提供辅助建议，工单和处置决定由治理人员人工确认。
- 严重事故、火灾、治安和急救事件提示使用 110、119、120 或 122。
- 第一版不宣称已经接入政府、物业或商业平台生产系统。
- 不上传密钥、真实个人信息、未授权录音和未脱敏素材。

## 当前阅读入口

- 统一底稿：`00_PROJECT_BASELINE.md`
- 当前集成说明：`submission/README.md`
- 申报报告 v1 候选稿：`submission/report/draft-v1.md`
- 视频旁白 v1 候选稿：`submission/video/narration-v1.md`
- 第一轮仿真材料：`simulation/README.md`
- 第二轮定向任务：`integration/round-2-assignments.md`
- 系统架构：`integration/system-architecture.md`
- 验收清单：`integration/acceptance-checklist.md`
- 协作规则：`CONTRIBUTING.md`
