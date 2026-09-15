# 本地多工作区说明（给代行 AI 4 的操作者）

- 编写者：AI 3 产品原型与演示工程师
- 适用场景：同一台电脑上同时维护 `work/evidence`、`work/simulation`、`work/prototype`、`work/integration` 四个分支，并且**只保存在本地、暂不推送**
- 本文不涉及任何推送命令；所有操作都可在本地完成并随时撤销

---

## 1 为什么用 git worktree 而不是复制文件夹

| 方式 | 问题 |
| --- | --- |
| 手工复制整个文件夹 | 复制出来的目录与原仓库没有链接，`git status` 混乱，容易把旧文件覆盖回新分支 |
| **git worktree（推荐）** | 同一份 `.git` 仓库，挂载出多个独立工作目录，每个目录各自处于不同分支，互不影响 |

worktree 的效果就是协作指南第 5.1 节说的「每个 AI 一个独立克隆目录」，但**不额外占用仓库体积**、不重复下载历史。

## 2 当前本机布局

```text
D:\DeepSeekHarness\workspace\
├─ fenghui-zhili-ai3-prototype\        ← AI 3 工作区（分支 work/prototype）
└─ fenghui-zhili-ai4-integration\      ← AI 4 工作区（分支 work/integration）
```

`fenghui-zhili-ai4-integration` 是通过 worktree 从主仓库挂载出来的，它和 AI 3 工作区共享同一个 Git 仓库，
因此：

- AI 4 目录里的提交会进入**同一个本地仓库**；
- 但两个目录的**工作文件完全隔离**，AI 4 改 `integration/`、`submission/` 不会影响 AI 3 的 `prototype/`；
- 目录里的分支各自独立，可以随时切换、随时删除。

## 3 已经执行过的命令（可复查）

```powershell
# ① 进入主仓库（AI 3 工作区）
cd D:\DeepSeekHarness\workspace\fenghui-zhili-ai3-prototype

# ② 让 HTTP 走 1.1：本机 HTTP/2 连接会长时间挂起，1.1 稳定
git config http.version HTTP/1.1

# ③ 取回另外三个 AI 的分支（只更新远端引用，不改动任何工作文件）
git fetch --no-tags origin work/evidence work/integration work/simulation

# ④ 查看取回结果
git branch -r

# ⑤ 为 AI 4 建立独立工作目录，并检出 work/integration 分支
git worktree add D:\DeepSeekHarness\workspace\fenghui-zhili-ai4-integration work/integration
```

## 4 日常使用

### 4.1 在 AI 4 工作区工作

```powershell
cd D:\DeepSeekHarness\workspace\fenghui-zhili-ai4-integration
git status
git branch --show-current      # 应为 work/integration

# 只提交自己负责的目录
git add integration submission
git commit -m "integration: add evaluation mapping and report skeleton"
```

### 4.2 查看另一个 AI 的成果（只读）

不要切换工作区去改别人的目录。用只读命令查看即可：

```powershell
cd D:\DeepSeekHarness\workspace\fenghui-zhili-ai4-integration
git ls-tree -r --name-only origin/work/prototype     # 看 AI 3 有哪些文件
git show origin/work/prototype:prototype/README.md  # 直接读某个文件内容
git diff --stat origin/work/prototype                # 看 AI 3 相对本分支的差异
```

### 4.3 需要真正合并时（只在汇总环节做）

```powershell
cd D:\DeepSeekHarness\workspace\fenghui-zhili-ai4-integration
git merge origin/work/prototype
git status
```

第一轮**不需要**合并：AI 4 的第一轮成果（评审映射、架构、报告骨架、视频结构、README、提交包清单）
不依赖另外三个 AI 的内容，缺失处用 `CITATION_NEEDED` / `SIM_RESULT_NEEDED` / `SCREENSHOT_NEEDED` 占位。

### 4.4 更新远端引用

```powershell
git fetch --no-tags origin          # 若再次出现长时间无响应，确认 http.version 仍为 HTTP/1.1
git config --get http.version
```

## 5 撤销与清理

```powershell
# 查看已挂载的工作区
git worktree list

# 移除 AI 4 工作区（工作目录里有未提交改动时会拒绝，需先处理或加 --force）
git worktree remove D:\DeepSeekHarness\workspace\fenghui-zhili-ai4-integration

# 仅想切换 AI 4 目录到别的分支
cd D:\DeepSeekHarness\workspace\fenghui-zhili-ai4-integration
git switch <分支名>
```

## 6 安全规则（与协作指南一致）

| 禁止 | 说明 |
| --- | --- |
| `git push --force` | 会覆盖他人成果 |
| `git reset --hard` | 会丢弃未提交工作 |
| 直接改 `main` | 只通过 PR 合并 |
| 修改他人目录 | AI 3 只写 `prototype/`；AI 4 只写 `integration/`、`submission/` |
| 上传个人信息、密钥、未授权录音、大体积视频 | 见协作指南第 18、19 节 |

**本轮约定：只在本地提交，先不推送。** 需要推送时再单独执行 `git push`，不要使用 force。

## 7 网络问题的已知处理

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `git fetch` 长时间无响应（数分钟） | 本机 HTTP/2 连接协商异常 | `git config http.version HTTP/1.1` 后重试 |
| `ls-remote` 正常但 `fetch` 报 `could not read Username` | 终端提示被关闭（`GIT_TERMINAL_PROMPT=0`），凭据助手无法取用凭据 | 清除该环境变量后重试：`Remove-Item Env:GIT_TERMINAL_PROMPT` |
| `fetch` 只传输少量对象却很久 | 网络带宽低 | 用后台任务执行，或加 `--depth=50` 做浅取回 |

## 8 AI 4 第一轮需要产出的文件（供代行时核对）

```text
integration/
├─ evaluation-mapping.md      评审标准 → 报告章节与展示证据
├─ system-architecture.md     产品 / AI 处理 / 治理工单 / 仿真模块总体架构
├─ glossary.md                统一术语表
├─ decision-log.md            决策日志
└─ acceptance-checklist.md    验收表
submission/
├─ README.md
├─ package-checklist.md
├─ report/
│  ├─ report-outline.md       报告骨架（为三路材料预留插槽）
│  └─ draft-v0.md             报告 v0
└─ video/
   └─ video-outline.md        10 分钟视频结构与时间分配
```

## 9 与另外三个 AI 的接口（第一轮占位符约定）

| 缺失内容 | 占位符 | 由谁补齐 |
| --- | --- | --- |
| 仿真结果数字 | `SIM_RESULT_NEEDED` | AI 2 |
| 引用与事实来源 | `CITATION_NEEDED` | AI 1 |
| 界面截图 | `SCREENSHOT_NEEDED` | AI 3 |
| 原型占位数字 | `PLACEHOLDER_SIM_RESULT` | AI 3 第二轮替换为 AI 2 结果 |

AI 3 已经交付的、AI 4 可直接引用的内容：

| 需要什么 | 去哪里取 |
| --- | --- |
| 产品能力与边界清单 | `prototype/product-requirements.md` 第 5、6 节 |
| 治理闭环流程图 | `prototype/user-flow.md` 第 1 节 |
| 屏幕与路由清单、截图索引 | `prototype/screen-list.md` 第 2–5 节 |
| 技术架构与 AI 管线 | `prototype/technical-flow.md` 第 1、3 节 |
| 安全文案逐字稿（录屏旁白须一致） | `prototype/safety-and-privacy.md` 第 6 节 |
| 三分钟录屏脚本与逐镜清单 | `prototype/demo-script.md`、`prototype/recording-checklist.md` |
| 13 张真实界面截图 | `prototype/screenshots/01–13` |
| 指标口径 | `prototype/technical-flow.md` 第 5 节 |
