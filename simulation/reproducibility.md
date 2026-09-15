# 复现说明

## 1 环境

- Python 3.10 及以上；第一轮已在 Python 3.14.7 验证。
- 仅使用 Python 标准库，无需安装第三方包。
- Windows PowerShell、macOS 或 Linux 终端均可运行。

## 2 从仓库根目录运行

```powershell
python simulation/code/validate_config.py
python simulation/code/run_simulation.py
python simulation/code/validate_outputs.py
python simulation/code/visualize_results.py
```

完整运行在普通个人电脑上约需几十秒。复跑会覆盖 `simulation/results/` 下同名生成文件，但不会改动模型说明或配置。

快速冒烟测试：

```powershell
python simulation/code/run_simulation.py --runs 2 --output-dir simulation/results-smoke
python simulation/code/validate_outputs.py --results simulation/results-smoke
```

自定义情景或种子：

```powershell
python simulation/code/run_simulation.py --scenarios S0 S1 --runs 5 --seed 12345 --output-dir simulation/results-custom
```

## 3 输出文件

- `results/raw/events.csv`：每条实际上报的动作、接受状态、重复状态、分派、解决和耗时。
- `results/run-metrics.csv`：80 行逐次运行指标。
- `results/aggregated-metrics.csv`：各指标均值和 95% 置信区间。
- `results/paired-effects.csv`：机制递进的同轮配对差和 95% 区间。
- `results/round-1-summary.md`：供 AI 4 阅读的结果表和结论边界。
- `results/round-1-dashboard.svg`：可直接预览的六指标看板。
- `results/experiment-manifest.json`：种子、运行规模及关键文件 SHA-256。

CSV 使用 UTF-8 BOM，便于直接用 Excel 打开。摘要为程序生成文件，不应手工修改；需要改变口径时修改代码并整体复跑。

## 4 确定性

同一配置、基础种子和 Python 主版本应生成相同的人群、问题与决策序列。随机数通过基础种子和事件键的 BLAKE2b 哈希隔离，分支路径变化不会使其他随机事件错位。不同 Python 版本的伪随机实现若发生变化，应以 `experiment-manifest.json` 的校验值为准并记录环境。

## 5 玉兰万象复跑

自主代码用于确保第一轮可执行和可审计。玉兰万象平台首次跑通优先使用 `evidence/onesim-fast-scenario-prompt.md`，并严格按 `evidence/onesim-fast-runbook.md` 操作；该版本把流程压缩为4类Agent和11个动作，同时保留三轮、人工审核、应急分流与八项指标。`evidence/onesim-scenario-prompt.md` 保留为35节点完整版，供时间允许时增强验证。平台导出的原始事件、决策和执行记录应保存到 `simulation/evidence/onesim-export/`，不得只保留自动报告截图。
