# 蜂汇智理 技术流程与架构说明（原型 v0.1）

- 负责人：AI 3
- 所属轮次：第一轮
- 目标：说明原型如何模拟「上报 → AI 处理 → 建议分派 → 人工决定 → 反馈 → 激励」的完整链路

---

## 1 架构总览

```text
┌──────────────────────────── 浏览器（离线可运行）────────────────────────────┐
│  index.html   结构壳 + 顶部「原型演示环境」声明条 + 演示控制台              │
│  styles.css   设计系统（骑手端移动壳 / 治理端后台 / 指标卡 / 徽标）        │
│  data.js      虚构与脱敏测试数据、AI 规则表、占位仿真结果                  │
│  engine.js    规则式「AI 处理管线」+ 指标口径计算（纯函数）                │
│  app.js       路由、状态存储（localStorage）、界面渲染、人工动作处理       │
│  shot.js      无头截图脚本（Node + Edge，仅开发期使用）                    │
└───────────────────────────────────────────────────────────────────────────┘
```

设计取舍：

| 取舍 | 原因 |
| --- | --- |
| 零依赖、零构建、纯静态 | 保证任何评委电脑上双击即可运行，录屏不会因环境失败 |
| 规则式 AI 而非真实模型调用 | 演示需要确定性；且不引入外部 API 与密钥 |
| 数据存 `localStorage` | 刷新不丢状态，便于分段录屏 |
| 地图为 SVG 示意底图 + 虚构网格 | 避免使用真实行政区划数据与未审核小区地图 |

## 2 数据模型

### 2.1 工单（Ticket）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 工单编号，如 `T-20260312-07` |
| `createdAt` | string | 演示时间戳（不取系统真实时间，保证可重复） |
| `channel` | enum | `voice` / `text` / `photo` / `location` / `mixed` |
| `rawText` | string | 上报人原始描述（含未脱敏内容，仅本地演示） |
| `desensitized` | object | 脱敏结果：`text`、`removed[]` |
| `structured` | object | 结构化要素：`what`、`where`、`when`、`who`、`impact` |
| `category` | object | `key`、`name`、`confidence`、`reason`、`secondary[]` |
| `risk` | object | `level`（`low`/`medium`/`high`/`emergency`）、`reason` |
| `duplicateOf` | string\|null | 重复合并候选 |
| `suggestDispatch` | object | `level`（社区/街道/市级）、`owner`、`sla`、`reason` |
| `decision` | object\|null | 人工决定：`action`、`owner`、`note`、`decidedAt` |
| `status` | enum | 见 `user-flow.md` 第 2.3 节 |
| `timeline` | array | 事件节点：`{at, actor, text, kind}` |
| `resolution` | object\|null | `text`、`points`、`at` |
| `emergency` | boolean | 是否紧急分流 |
| `modifiedByReporter` | boolean | 上报人是否修改过 AI 建议 |

### 2.2 服务点、激励与情景

| 实体 | 关键字段 |
| --- | --- |
| 服务点 `ServicePoint` | `id`、`name`、`type`、`services[]`、`openHours`、`note`（均为虚构演示数据） |
| 激励 `IncentiveRule` | `id`、`name`、`condition`、`points`、`benefit` |
| 情景 `Scenario` | `id`（S0–S3）、`name`、`added`、`mechanics[]` |
| 指标 `Metric` | `key`、`name`、`unit`、`direction`、`note` |

## 3 AI 处理管线（原型实现）

管线在 `engine.js` 中实现为 6 个纯函数，与确认页的区块一一对应：

```text
① desensitize(text)        脱敏
② structure(text, ctx)     结构化
③ classify(text)           类别建议 + 置信度
④ detectDuplicate(ticket)  重复检测与合并建议
⑤ assessRisk(text, cat)    风险分级 + 紧急判定
⑥ suggestDispatch(cat,risk) 建议分派（社区 / 街道 / 市级）+ 时限
```

### 3.1 脱敏规则（可解释）

| 规则 ID | 目标 | 处理方式 |
| --- | --- | --- |
| `PII-PHONE` | 手机号 | 遮蔽为 `138****0000` 形式 |
| `PII-PLATE` | 车牌 | 遮蔽为 `沪A·***` 形式 |
| `PII-ID` | 身份证号 | 整段移除，标注「已移除」 |
| `PII-WECHAT` | 微信号 / QQ | 替换为「联系方式已隐藏」 |
| `PII-ADDR` | 精确门牌号 | 保留到楼栋，不保留具体户号 |
| `PII-NAME` | 疑似真实姓名 | 替换为「某先生 / 某女士」 |
| `SAFE-KEEP` | 位置与时间 | 保留，用于定位与核验 |

每次脱敏都会返回 `removed[]` 明细，界面上以「已脱敏」标签逐条展示，演示时可解释。

### 3.2 分类规则表（节选）

| 类别 | 命中关键词示例 | 默认风险 | 建议层级 |
| --- | --- | --- | --- |
| 市容环境 | 垃圾、堆物、污水、油污、小广告 | low | 社区 |
| 道路与设施 | 井盖、路面、路灯、护栏、积水、塌陷 | medium | 街道 |
| 交通与秩序 | 违停、占道、单车、施工围挡 | low | 街道 |
| 公共安全 | 消防通道、燃气、电线、裸露 | high | 街道 / 市级 |
| 社区服务 | 驿站、取餐点、无障碍、休息区 | low | 社区 |
| 紧急事件 | 火灾、打架、伤者、交通事故、燃气泄漏 | emergency | 法定应急渠道 |

分类结果包含置信度与命中理由，便于解释「AI 为什么这样判」。

### 3.3 重复合并规则

```text
同一类别 且 网格距离 ≤ 1 格 且 48 小时内  → 建议合并
网格距离 ≤ 1 格 且 类别不同            → 提示「可能相关」
```

合并建议只作为**建议**出现在确认页；上报人可以选择合并或继续单独上报，治理端仍保留人工判断。

### 3.4 风险分级

| 等级 | 判定 | 处理路径 |
| --- | --- | --- |
| 紧急 | 命中紧急词表 | 退出普通工单流，展示应急转接卡 |
| 高 | 消防、燃气、电力、结构安全类关键词 | 高风险标记，建议 24 小时内处置，需人工确认 |
| 中 | 道路设施、积水、井盖等 | 建议 72 小时 |
| 低 | 市容、秩序、服务类 | 建议 7 天 |

### 3.5 建议分派

建议分派由「类别 × 风险 × 位置层级」共同决定，输出：`层级`、`建议处置主体`（虚构示例）、`建议时限`、`理由`。
输出文案固定为「AI 建议」，治理端必须人工点击确认才生成决定。

## 4 人工决定与反馈链路

```text
确认并分派 ──► decision{action:'dispatch', owner, note} ──► status='dispatched'
退回补充   ──► decision{action:'need_info', note}        ──► status='need_info'
转交       ──► decision{action:'transfer', owner}       ──► status='transferred'
录入处置   ──► resolution{text, points}                 ──► status='resolved' + 积分入账
```

每次动作都会写入 `timeline`，骑手端进度页按时间轴展示，实现「透明反馈」机制（S2）。

## 5 指标口径

所有指标的计算在 `engine.js` 中有单一实现，避免多处口径不一致：

| 指标 | 口径 | 单位 | 方向 |
| --- | --- | --- | --- |
| 有效上报率 | 有效工单数 / 总上报数 | % | 越高越好 |
| 重复或无效上报率 | （重复 + 无效）/ 总上报数 | % | 越低越好 |
| 工单分派准确率 | 一次分派即被认可数 / 已分派工单数 | % | 越高越好 |
| 平均处置时间 | 从工单受理到办结的平均时长 | 小时 | 越低越好 |
| 参与者时间成本 | 单次上报的平均操作与等待时间 | 分钟 | 越低越好 |
| 参与差距 | 不同新就业群体分组参与率极差 | 百分点 | 越小越好 |

其中前五项在治理端「核心指标概览」中以**演示口径**展示（基于原型内置的示例工单），
第六项与全部 S0–S3 对比值标记为占位，等待 AI 2 结果。

## 6 与 AI 2 结果的对接协议

### 6.1 替换步骤

1. 将 AI 2 的最终结果整理为 `prototype/test-data/sim-results.json`（结构见现文件）。
2. 删除所有 `PLACEHOLDER_SIM_RESULT` 前缀，改由 `dataSource: "AI2-simulation"` 标识。
3. 保留占位期间的 `assumptionRefs` 字段，改为指向 `simulation/results/final-summary.md` 的锚点。
4. 运行 `node prototype/app/shot.js` 重新生成截图。
5. 在 `demo-script.md` 中更新录屏旁白数字。

### 6.2 期望的数据结构

```json
{
  "dataSource": "AI2-simulation",
  "runDate": "YYYY-MM-DD",
  "repeats": 0,
  "metrics": {
    "effectiveReportRate": { "S0": 0, "S1": 0, "S2": 0, "S3": 0 },
    "duplicateOrInvalidRate": { "S0": 0, "S1": 0, "S2": 0, "S3": 0 },
    "dispatchAccuracy": { "S0": 0, "S1": 0, "S2": 0, "S3": 0 },
    "avgHandlingHours": { "S0": 0, "S1": 0, "S2": 0, "S3": 0 },
    "participantTimeCostMin": { "S0": 0, "S1": 0, "S2": 0, "S3": 0 },
    "participationGapPp": { "S0": 0, "S1": 0, "S2": 0, "S3": 0 }
  },
  "groups": [],
  "conclusion": "",
  "limitations": []
}
```

### 6.3 当前状态

`prototype/test-data/sim-results.json` 中所有数值均为占位（`PLACEHOLDER_SIM_RESULT`），
界面在表格上方固定显示「占位数据，不是实验结果」，并在**每个单元格**前保留占位标记前缀。

## 7 安全与合规在技术上的落点

| 要求 | 技术实现 |
| --- | --- |
| 无密钥、无外部请求 | 全部资源本地；页面不发起任何网络请求（截图脚本除外，仅读取本地文件） |
| 无真实个人信息 | 测试数据虚构；`prototype/test-data/*.json` 中不含真实姓名、手机号、车牌 |
| 紧急事件不自动化 | 紧急工单不参与普通分派建议，界面强制展示法定渠道 |
| 人工决定不可绕过 | 治理端无自动确认代码路径；`decision` 只能由用户点击产生 |
| 占位不混淆 | `PLACEHOLDER_SIM_RESULT` 前缀由数据层强制，界面二次渲染 |
| 声明常驻 | 顶部声明条在所有屏幕可见，演示模式也不移除 |

## 8 已知技术局限

- 规则式分类在跨类别、长文本、方言口语场景下会退化，仅用于演示可解释流程。
- 无真实地理编码：位置来自虚构网格，距离计算为网格距离近似。
- 无后端：多人协作、并发冲突、权限控制均未实现，属演示范围外。
- 未实现上报人「退回补充」的回填表单（第二轮候选范围）。
- 未做持久化加密；`localStorage` 中的演示数据可被浏览器清除。
