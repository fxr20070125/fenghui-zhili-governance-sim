# 蜂汇智理协作规范

## 开始工作

1. 阅读 `00_PROJECT_BASELINE.md`，确认项目定位、S0–S3、六项指标和产品边界。
2. 从最新 `main` 同步自己的长期工作分支。
3. 检查当前分支和工作区状态，确认不在 `main` 直接开发。
4. 只修改自己的专属目录；需要其他负责人修改时，在交接记录中提出。

## 文件所有权

| 目录或文件 | 负责人 |
| --- | --- |
| `evidence/` | AI 1 |
| `simulation/` | AI 2 |
| `prototype/` | AI 3 |
| `integration/`、`submission/` | AI 4 |
| `qa/fact-and-citation-audit.md` | AI 1 |
| `qa/numerical-and-reproducibility-audit.md` | AI 2 |
| `qa/demo-product-and-safety-audit.md` | AI 3 |
| 根 README、`.gitignore`、统一底稿和贡献规范 | AI 4 |

## 提交要求

- 一次提交只完成一个清楚目标。
- 推荐前缀：`docs:`、`sim:`、`prototype:`、`security:`、`submission:`、`fix:`、`chore:`。
- 提交前检查差异、占位符、敏感信息和大文件。
- 不使用强制推送，不把账号、密码、访问令牌或 `.env` 加入仓库。

## Pull Request 要求

- Base 选择 `main`，Compare 选择自己的 `work/...` 分支。
- 第一轮可以尽早建立 Draft Pull Request。
- 正文必须填写交接模板，特别说明事实来源、项目假设、占位符和局限。
- 未通过目录所有权、数字追溯、隐私安全或复现检查的 PR 不合并。
- 需要修改时由原目录负责人在原分支继续提交，不跨目录代改。

## 占位符

- `CITATION_NEEDED_<主题>`：待 AI 1 核实来源。
- `SIM_RESULT_NEEDED_<指标>`：待 AI 2 提供结果和原始路径。
- `SCREENSHOT_NEEDED_<页面>`：待 AI 3 提供最终界面证据。

最终提交前，三类占位符必须全部替换、弱化或删除。

## 合并优先级

发生冲突时依次服从：比赛官方要求、可追溯事实、保存的实验结果、已实现可演示功能、安全和合规边界、答辩可解释性。
