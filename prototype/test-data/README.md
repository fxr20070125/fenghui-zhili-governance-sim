{
  "_notice": "本目录全部文件为虚构或脱敏的演示数据，仅用于产品原型演示与评审核对。不含任何真实个人信息，不代表真实系统接入。",
  "_owner": "AI 3 产品原型与演示工程师",
  "_round": "第一轮",
  "_rules": [
    "不编造真实访谈、真实统计或真实系统接入。",
    "不把 30 人定性访谈写成总体比例。",
    "不把 AI 生成角色和模拟结果冒充真实调查。",
    "仿真结果未产生时一律使用 PLACEHOLDER_SIM_RESULT 占位并标注「占位数据，不是实验结果」。"
  ],
  "files": [
    {
      "file": "demo-inputs.json",
      "purpose": "三种演示上报场景（普通 / 重复 / 紧急）的文本、位置与预期 AI 输出",
      "usedBy": "app/data.js 的 DEMO_INPUTS，以及演示控制台「载入场景」"
    },
    {
      "file": "seed-events.json",
      "purpose": "治理端事件列表与详情页使用的演示工单（含已办结、待补充、已转交等状态）",
      "usedBy": "app/data.js 的 SEED_TICKETS"
    },
    {
      "file": "sim-results.json",
      "purpose": "仿真端 S0–S3 六项指标对比数据；当前全部为占位",
      "usedBy": "app/data.js 的 SIM_RESULTS，以及本文件中的替换清单"
    },
    {
      "file": "ai-rules.json",
      "purpose": "规则式 AI 处理管线的可读规则说明（脱敏 / 分类 / 风险 / 合并 / 建议分派）",
      "usedBy": "评审核对；可执行实现在 app/engine.js"
    },
    {
      "file": "README.md",
      "purpose": "本说明"
    }
  ],
  "verification": {
    "command": "node prototype/app/selftest.js",
    "description": "自检脚本会核验脱敏、分类、合并、风险分级、建议分派、指标口径、占位标记与安全边界（87 项断言）。",
    "lastRun": "第一轮交付时通过 87/87"
  }
}
