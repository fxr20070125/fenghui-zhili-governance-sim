# 蜂汇智理复现材料索引

## 目标

本索引用于让评委或审计人员从报告结论追溯到模型配置、运行日志、汇总结果、图表和产品截图。当前仅建立接口，路径须在对应角色提交后验证。

## 仿真复现链

| 环节 | 预期文件 | 负责人 | 当前状态 |
| --- | --- | --- | --- |
| 模型说明 | `simulation/model-spec.md` | AI 2 | 待交付 |
| 智能体画像 | `simulation/agent-profiles.md` | AI 2 | 待交付 |
| 行为图 | `simulation/behavior-graph.md` | AI 2 | 待交付 |
| 场景配置 | `simulation/scenario-config.md` | AI 2 | 待交付 |
| 实验计划 | `simulation/experiment-plan.md` | AI 2 | 待交付 |
| 代码入口 | `simulation/code/` | AI 2 | 待交付 |
| 首轮原始输出 | `simulation/evidence/` | AI 2 | 待交付 |
| 结果摘要 | `simulation/results/round-1-summary.md` | AI 2 | 待交付 |
| 最终结果 | `simulation/results/final-summary.md` | AI 2 | 第二轮待交付 |
| 敏感性分析 | `simulation/results/sensitivity-analysis.md` | AI 2 | 第二轮待交付 |
| 复现说明 | `simulation/reproducibility.md` | AI 2 | 待交付 |

## 产品证据链

| 报告或视频内容 | 预期证据 | 当前状态 |
| --- | --- | --- |
| 骑手上报与用户确认 | `prototype/screenshots/` 对应最终截图 | `SCREENSHOT_NEEDED_RIDER_FLOW` |
| AI 脱敏与结构化 | 输入输出对照截图和虚构测试数据 | `SCREENSHOT_NEEDED_AI_PROCESS` |
| 人工确认与分派 | 治理端操作截图 | `SCREENSHOT_NEEDED_GOV_REVIEW` |
| 应急分流 | 严重事件测试截图 | `SCREENSHOT_NEEDED_EMERGENCY` |
| S0 至 S3 指标比较 | 仿真端最终截图 | `SCREENSHOT_NEEDED_SIM_DASHBOARD` |

## 结论追溯规则

最终报告中的每个实验结论须标注数字登记编号和源结果文件；每张图表须记录生成输入和版本；视频旁白中的数字须与报告采用同一编号。若路径不存在、运行无法复现或数值不一致，相关结论不得进入最终提交。
