{
  "_notice": "本目录的产品数据（工单、服务点、积分、上报输入）全部为虚构或脱敏的演示数据，仅用于产品原型演示与评审核对；sim-results.json 为 AI 2 第一轮社会仿真结果。两类数据都不代表真实系统接入。",
  "_owner": "AI 3 产品原型与演示工程师",
  "_round": "第一轮建立；第二轮完成仿真数值替换",
  "_rules": [
    "不编造真实访谈、真实统计或真实系统接入。",
    "不把 30 人定性访谈写成总体比例（该材料尚未提供，本轮未引用）。",
    "不把 AI 生成角色和模拟结果冒充真实调查。",
    "仿真数值一律使用 AI 2 的保存结果，并保留「第一轮 / 项目假设 / 20 次重复 / 95% 区间」限定语。",
    "仿真侧尚未产出的材料保留 SIM_RESULT_NEEDED 标记，一律不以估计值代替。",
    "不使用「显著」描述仿真差异（本轮未做统计显著性检验）。"
  ],
  "files": [
    {
      "file": "demo-inputs.json",
      "purpose": "三种演示上报场景（普通 / 重复 / 紧急）的文本、位置与预期 AI 输出",
      "usedBy": "app/data.js 的 DEMO_INPUTS，以及演示控制台「载入场景」",
      "dataType": "虚构演示数据"
    },
    {
      "file": "seed-events.json",
      "purpose": "治理端事件列表与详情页使用的演示工单（含已办结、待补充、已转交等状态）",
      "usedBy": "app/data.js 的 SEED_TICKETS",
      "dataType": "虚构演示数据"
    },
    {
      "file": "sim-results.json",
      "purpose": "仿真端 S0–S3 六项主指标、三项辅助指标、分群体参与率与配对效应；已替换为 AI 2 第一轮真实结果并附 95% 区间",
      "usedBy": "app/data.js 的 SIM_RESULTS，以及报告与视频的数字引用",
      "dataType": "第一轮合成仿真结果（不是现实统计）",
      "sourceFiles": [
        "simulation/results/aggregated-metrics.csv",
        "simulation/results/paired-effects.csv",
        "simulation/results/run-metrics.csv",
        "simulation/results/round-1-summary.md"
      ]
    },
    {
      "file": "ai-rules.json",
      "purpose": "规则式 AI 处理管线的可读规则说明（脱敏 / 分类 / 风险 / 合并 / 建议分派）",
      "usedBy": "评审核对；可执行实现在 app/engine.js",
      "dataType": "规则说明"
    },
    {
      "file": "README.md",
      "purpose": "本说明"
    }
  ],
  "stillMissing": [
    "simulation/results/sensitivity-analysis.md → SIM_RESULT_NEEDED_SENSITIVITY",
    "simulation/results/final-summary.md → SIM_RESULT_NEEDED_FINAL_SUMMARY",
    "玉兰万象平台复跑或导出交叉核对 → SIM_RESULT_NEEDED_ONESIM_RERUN"
  ],
  "verification": {
    "command": "node prototype/app/selftest.js",
    "description": "自检脚本核验脱敏、分类、合并、风险分级、建议分派、指标口径、仿真数据契约（含 95% 区间自洽、互补关系、待补标记）与安全边界。",
    "lastRun": "第二轮交付时通过 116/116"
  }
}
