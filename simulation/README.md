# 蜂汇智理社会仿真第一轮成果

本目录是 AI 2 的第一轮独立交付。核心目标是在相同人群、相同城市问题流下，对比 S0—S3 四种治理机制。自主仿真只依赖 Python 标准库，可以直接复跑；`evidence/` 同时提供迁移到玉兰万象社会仿真研究室的输入材料。

## 文件导航

- `model-spec.md`：模型边界、过程和机制。
- `agent-profiles.md`：智能体类型、属性及异质性。
- `behavior-graph.md`：行为链与玉兰万象无环图设计。
- `scenario-config.md`：S0—S3 唯一干预差异。
- `experiment-plan.md`：假设、指标和实验设计。
- `reproducibility.md`：复现命令及输出说明。
- `code/`：配置、仿真程序和验证程序。
- `results/`：第一轮原始日志、逐轮指标、聚合指标和摘要。
- `evidence/`：参数登记、材料依据和玉兰万象迁移输入。
- `first-round-handoff.md`：交给 AI 4 的摘要。

## 最短复现命令

```powershell
python simulation/code/validate_config.py
python simulation/code/run_simulation.py
python simulation/code/validate_outputs.py
python simulation/code/visualize_results.py
```

所有数值均为合成仿真结果。可以写“模型显示”或“在当前假设下”，不得写成现实统计、真实平台运行结果或政策效果证明。
