/* =============================================================================
 * 蜂汇智理 原型 v0.1 — 数据层（data.js）
 * -----------------------------------------------------------------------------
 * 重要声明：
 *   1. 产品数据（工单、服务点、积分等）全部为【虚构或脱敏的演示数据】，不含任何真实个人信息。
 *   2. 仿真数值为 AI 2 第一轮合成仿真结果（每情景 20 次重复），在当前项目假设下得出，
 *      不是现实统计或政策效果证明；尚未产出的敏感性分析与平台复跑以 SIM_RESULT_NEEDED 标注。
 *   3. 本原型不接入任何政府、物业、外卖或网约车平台生产系统。
 *   4. 地图与网格编号为示意数据，不代表真实行政区划。
 *   5. 严重事故、火灾或治安事件必须提示联系 110 / 119 / 120 / 122，AI 不替代法定应急渠道。
 * 负责人：AI 3 产品原型与演示工程师
 * ========================================================================== */

window.FHZ_DATA = (function () {
  'use strict';

  var NOTICES = {
    demo: '原型演示环境 · 产品数据为虚构或脱敏 · 不代表真实系统接入 · AI 输出仅为建议',
    placeholder: '本页标注 SIM_RESULT_NEEDED 的条目尚未产出，不得用估计值代替。',
    aiAdvice: 'AI 建议，需人工确认。模型输出不构成行政决定。',
    simDisclaimer: '第一轮合成仿真结果（每情景 20 次重复）。在当前项目假设下得出，不是现实统计或政策效果证明。',
    simSource: '数据来源：simulation/results/aggregated-metrics.csv、paired-effects.csv、run-metrics.csv'
  };

  /* ---------------------------------------------------------------- 情景 S0-S3 */
  var SCENARIOS = [
    {
      id: 'S0', name: '现状基准', added: '微信群、电话或零散反映',
      mechanic: '无统一入口、无自动分类、无持续反馈',
      mechanics: ['微信群 / 电话上报', '人工口头转述', '无统一分类', '无进度反馈'],
      summary: '线索散落在聊天记录与电话里，分类靠人工记忆，上报人通常不知道后续结果。'
    },
    {
      id: 'S1', name: 'AI 上报', added: '一键上报 + AI 脱敏 / 分类 / 合并 / 建议分派',
      mechanic: '唯一新增：AI 上报与建议分派',
      mechanics: ['语音 / 照片 / 位置一键上报', 'AI 脱敏与结构化', '自动分类与风险分级', '重复合并建议', '建议处置主体'],
      summary: '线索被结构化，重复项被合并，治理人员拿到的是带建议的工单而不是一段聊天记录。'
    },
    {
      id: 'S2', name: 'AI 上报 + 透明反馈', added: '责任主体、处理进度、结果反馈',
      mechanic: '唯一新增：透明反馈',
      mechanics: ['展示责任主体', '处理进度可见', '处置结果回传上报人'],
      summary: '上报人能看到自己的线索被谁接走、进行到哪一步、结果如何。'
    },
    {
      id: 'S3', name: 'AI 上报 + 透明反馈 + 差异化激励', added: '积分、驿站权益、托管优先权等服务型激励',
      mechanic: '唯一新增：差异化服务型激励',
      mechanics: ['有效上报获得积分', '驿站服务权益', '托管优先权', '按群体差异化激励'],
      summary: '在透明反馈之上，让持续参与获得服务型回报，而不是现金或派单优待。'
    }
  ];

  /* ------------------------------------------------------------------ 分类规则 */
  var CATEGORIES = [
    {
      key: 'emergency', name: '紧急事件', risk: 'emergency', level: 'emergency', sla: '立即转接法定应急渠道',
      keywords: ['火灾', '起火', '冒烟', '燃气泄漏', '煤气', '打架', '斗殴', '伤者', '受伤', '流血', '晕倒',
        '交通事故', '撞车', '撞人', '触电', '漏电', '高空坠物', '坍塌', '塌方', '有人被困', '溺水', '治安'],
      rationale: '命中法定应急词表'
    },
    {
      key: 'safety', name: '公共安全', risk: 'high', level: 'street', sla: '24 小时内处置',
      keywords: ['消防通道', '消防栓', '燃气', '电线', '裸露', '电箱', '井盖缺失', '围挡倒塌', '易燃', '危险'],
      rationale: '涉及消防、燃气、电力或结构安全'
    },
    {
      key: 'road', name: '道路与设施', risk: 'medium', level: 'street', sla: '72 小时内处置',
      keywords: ['井盖', '路面', '坑洼', '路灯', '护栏', '积水', '塌陷', '破损', '盲道', '斑马线', '减速带'],
      rationale: '属于市政道路与设施管养事项'
    },
    {
      key: 'order', name: '交通与秩序', risk: 'low', level: 'street', sla: '7 天内处置',
      keywords: ['违停', '占道', '单车', '乱停', '围挡', '商贩', '摆摊', '拥堵', '逆行'],
      rationale: '属于交通与市容秩序事项'
    },
    {
      key: 'environment', name: '市容环境', risk: 'low', level: 'community', sla: '7 天内处置',
      keywords: ['垃圾', '堆物', '污水', '油污', '小广告', '异味', '落叶', '粪便', '杂物'],
      rationale: '属于社区市容保洁事项'
    },
    {
      key: 'service', name: '社区服务', risk: 'low', level: 'community', sla: '10 天内反馈',
      keywords: ['驿站', '取餐点', '无障碍', '休息区', '饮水', '充电', '停车位', '母婴', '厕所'],
      rationale: '属于社区末端服务设施建议'
    }
  ];

  var FALLBACK_CATEGORY = {
    key: 'other', name: '其他事项', risk: 'low', level: 'community', sla: '10 天内反馈',
    keywords: [], rationale: '未命中明确规则，建议人工判断类别'
  };

  /* ------------------------------------------------------------------ 脱敏规则
   * 第 1–6 条由 engine.js 的 desensitize() 以正则实现，可在原型中演示。
   * 第 7 条（人脸）属部署阶段规则：原型使用内置演示图，不处理真实照片，
   * 因此该规则不在代码中实现，只在文档与规则表中登记。
   */
  var PII_RULES = [
    { id: 'PII-PHONE', label: '手机号', note: '保留前三后二' },
    { id: 'PII-PLATE', label: '车牌', note: '保留省份简称' },
    { id: 'PII-ID', label: '身份证号', note: '整段遮蔽，保留前 6 后 3' },
    { id: 'PII-CONTACT', label: '微信号 / QQ', note: '替换为联系方式已隐藏' },
    { id: 'PII-ADDR', label: '精确门牌', note: '保留到楼栋号' },
    { id: 'PII-NAME', label: '疑似真实姓名', note: '替换为某先生 / 某女士' },
    { id: 'PII-FACE', label: '人脸', note: '部署阶段规则：照片进入 AI 前本地打码或模糊，原型不处理真实照片', implemented: false }
  ];

  /* ------------------------------------------------- 定位层级（示意，不算真实区划） */
  var LOCALITY = {
    level: 'street',
    name: '示例街道（虚构）',
    grid: '3 号网格',
    description: '玉兰路与望春街交叉口东侧 · 示意底图，不代表真实行政区划'
  };

  var LOCATION_PRESETS = [
    { id: 'G-03', label: '3 号网格 · 玉兰路与望春街交叉口东侧', x: 46, y: 54, note: '路口东侧非机动车道' },
    { id: 'G-05', label: '5 号网格 · 望春街 120 号附近（虚构门牌）', x: 63, y: 38, note: '沿街商铺门前' },
    { id: 'G-01', label: '1 号网格 · 玉兰社区服务中心北门', x: 28, y: 30, note: '社区北门人行道' },
    { id: 'G-07', label: '7 号网格 · 春江路高架下穿段', x: 71, y: 68, note: '下穿段入口' },
    { id: 'G-02', label: '2 号网格 · 玉兰小学南侧支路', x: 37, y: 72, note: '支路与主路交口' }
  ];

  /* --------------------------------------------------------- 演示控制台场景载入 */
  var DEMO_INPUTS = {
    normal: {
      id: 'normal',
      title: '普通事件',
      channel: 'voice',
      rawText: '玉兰路和望春街交叉口东侧的井盖破了，我骑到那儿差点翻车，打 13812340000 找我，旁边停着一辆沪A12345 的白色货车挡着盲道。',
      location: 'G-03',
      photoLabel: '井盖破损 + 盲道被占',
      transcript: '玉兰路和望春街交叉口东侧的井盖破了，我骑到那儿差点翻车……旁边还停着一辆货车挡着盲道。'
    },
    duplicate: {
      id: 'duplicate',
      title: '重复事件',
      channel: 'photo',
      rawText: '又是玉兰路望春街路口那个井盖，看着还是没人修，我拍了张照片。',
      location: 'G-03',
      photoLabel: '同一位置井盖破损',
      transcript: ''
    },
    emergency: {
      id: 'emergency',
      title: '紧急事件',
      channel: 'voice',
      rawText: '玉兰路口有人被车撞倒了，地上有血，伤者动不了，我在旁边不敢动他。',
      location: 'G-03',
      photoLabel: '现场（演示图，非真实照片）',
      transcript: '玉兰路口有人被车撞倒了，地上有血，伤者动不了……'
    }
  };

  /* -------------------------------------------------------------------- 工单数据
   * 全部为虚构演示数据。createdAt 使用固定演示时间戳，保证录屏可重复。
   */
  var SEED_TICKETS = [
    {
      id: 'T-20260312-07',
      createdAt: '2026-03-12 09:12',
      channel: 'mixed',
      rawText: '玉兰路和望春街交叉口东侧的井盖破了，我骑到那儿差点翻车，打 13812340000 找我，旁边停着一辆沪A12345 的白色货车。',
      location: 'G-03',
      photoLabel: '井盖破损 + 盲道被占',
      reporter: 'R-1001 · 示例骑手 A',
      categoryKey: 'road',
      riskLevel: 'medium',
      status: 'submitted',
      modifiedByReporter: false,
      duplicateOf: 'T-20260312-06',
      suggestDispatchOverride: null
    },
    {
      id: 'T-20260312-06',
      createdAt: '2026-03-12 07:40',
      channel: 'text',
      rawText: '望春街往玉兰路方向非机动车道有个井盖下沉，晚上看不清，很危险。',
      location: 'G-03',
      photoLabel: '',
      reporter: 'R-1002 · 示例骑手 B',
      categoryKey: 'road',
      riskLevel: 'medium',
      status: 'processing',
      modifiedByReporter: false,
      duplicateOf: null,
      suggestDispatchOverride: null
    },
    {
      id: 'T-20260312-05',
      createdAt: '2026-03-12 08:05',
      channel: 'photo',
      rawText: '示例社区 3 号楼东侧消防通道被两辆电动车和杂物堵住，通道只剩一半。',
      location: 'G-01',
      photoLabel: '消防通道被占用',
      reporter: 'R-1003 · 示例骑手 C',
      categoryKey: 'safety',
      riskLevel: 'high',
      status: 'dispatched',
      modifiedByReporter: false,
      duplicateOf: null,
      decision: {
        action: 'dispatch', owner: '示例街道 · 应急与消防管理岗',
        note: '高风险事项，转应急与消防管理岗，24 小时内核查', decidedAt: '2026-03-12 08:31'
      },
      suggestDispatchOverride: null
    },
    {
      id: 'T-20260311-18',
      createdAt: '2026-03-11 17:22',
      channel: 'voice',
      rawText: '玉兰社区门口那排共享单车全倒在盲道上，老人推车过不去。',
      location: 'G-01',
      photoLabel: '',
      reporter: 'R-1001 · 示例骑手 A',
      categoryKey: 'order',
      riskLevel: 'low',
      status: 'resolved',
      modifiedByReporter: false,
      duplicateOf: null,
      decision: {
        action: 'dispatch', owner: '示例社区 · 市容秩序岗',
        note: '已转社区市容秩序岗整理', decidedAt: '2026-03-11 17:50'
      },
      resolution: {
        text: '现场共享单车已规范摆放，盲道恢复通行，社区已与运营方约定每日两次巡查。',
        points: 10, at: '2026-03-12 10:15', owner: '示例社区 · 市容秩序岗'
      },
      suggestDispatchOverride: null
    },
    {
      id: 'T-20260311-15',
      createdAt: '2026-03-11 12:03',
      channel: 'text',
      rawText: '春江路高架下穿段积水很深，昨天有骑手在水里摔了，希望处理一下排水。',
      location: 'G-07',
      photoLabel: '',
      reporter: 'R-1004 · 示例网约车司机 D',
      categoryKey: 'road',
      riskLevel: 'medium',
      status: 'resolved',
      modifiedByReporter: true,
      duplicateOf: null,
      decision: {
        action: 'dispatch', owner: '示例街道 · 市政设施管养队',
        note: '已转市政设施管养队排查排水口', decidedAt: '2026-03-11 12:40'
      },
      resolution: {
        text: '已疏通下穿段两处排水口并加设警示牌，高峰期安排巡查。',
        points: 10, at: '2026-03-11 18:20', owner: '示例街道 · 市政设施管养队'
      },
      suggestDispatchOverride: null
    },
    {
      id: 'T-20260311-12',
      createdAt: '2026-03-11 09:36',
      channel: 'location',
      rawText: '玉兰小学南侧支路早上摆摊的太多了，车都过不去，孩子上学很危险。',
      location: 'G-02',
      photoLabel: '',
      reporter: 'R-1005 · 示例骑手 E',
      categoryKey: 'order',
      riskLevel: 'low',
      status: 'need_info',
      modifiedByReporter: false,
      duplicateOf: null,
      decision: {
        action: 'need_info', owner: '', note: '请补充具体时间段与摊位数、是否影响消防通道', decidedAt: '2026-03-11 10:05'
      },
      suggestDispatchOverride: null
    },
    {
      id: 'T-20260311-09',
      createdAt: '2026-03-11 07:15',
      channel: 'photo',
      rawText: '玉兰社区服务中心北门垃圾桶满溢，厨余污水流到人行道上。',
      location: 'G-01',
      photoLabel: '垃圾桶满溢',
      reporter: 'R-1002 · 示例骑手 B',
      categoryKey: 'environment',
      riskLevel: 'low',
      status: 'resolved',
      modifiedByReporter: false,
      duplicateOf: null,
      decision: {
        action: 'dispatch', owner: '示例社区 · 环境卫生岗',
        note: '已转环境卫生岗清理', decidedAt: '2026-03-11 07:48'
      },
      resolution: {
        text: '垃圾桶已清运，地面冲洗完毕，社区调整了该点位清运频次。',
        points: 10, at: '2026-03-11 11:30', owner: '示例社区 · 环境卫生岗'
      },
      suggestDispatchOverride: null
    },
    {
      id: 'T-20260310-21',
      createdAt: '2026-03-10 15:48',
      channel: 'mixed',
      rawText: '望春街 120 号门口路灯连续三天不亮，晚上骑车完全看不见。',
      location: 'G-05',
      photoLabel: '路灯不亮',
      reporter: 'R-1003 · 示例骑手 C',
      categoryKey: 'road',
      riskLevel: 'medium',
      status: 'transferred',
      modifiedByReporter: false,
      duplicateOf: null,
      decision: {
        action: 'transfer', owner: '示例市级 · 城市照明管理单位',
        note: '该路段照明由市级照明管理单位负责，转交处理', decidedAt: '2026-03-10 16:30'
      },
      resolution: null,
      suggestDispatchOverride: null
    }
  ];

  /* ------------------------------------------------------------- 处置主体候选（虚构） */
  var OWNERS = [
    { id: 'OW-C1', name: '示例社区 · 市容秩序岗', level: 'community' },
    { id: 'OW-C2', name: '示例社区 · 环境卫生岗', level: 'community' },
    { id: 'OW-C3', name: '示例社区 · 居民服务岗', level: 'community' },
    { id: 'OW-S1', name: '示例街道 · 市政设施管养队', level: 'street' },
    { id: 'OW-S2', name: '示例街道 · 应急与消防管理岗', level: 'street' },
    { id: 'OW-S3', name: '示例街道 · 交通秩序管理岗', level: 'street' },
    { id: 'OW-M1', name: '示例市级 · 城市照明管理单位', level: 'city' },
    { id: 'OW-M2', name: '示例市级 · 水务排水管理单位', level: 'city' }
  ];

  /* ------------------------------------------------------------ 服务点（演示数据） */
  var SERVICE_POINTS = [
    {
      id: 'SP-01', name: '玉兰社区暖蜂驿站（演示）', type: '驿站', distance: '约 420 米',
      services: ['饮水补给', '手机充电', '雨具借用', '临时休息'],
      openHours: '每日 08:00 - 22:00（演示时段）',
      note: '演示数据，不代表真实驿站'
    },
    {
      id: 'SP-02', name: '望春街骑手取餐休息点（演示）', type: '取餐点',
      distance: '约 900 米', services: ['取餐等候区', '微波炉', '工具箱', '医药包'],
      openHours: '每日 09:00 - 21:00（演示时段）',
      note: '演示数据，不代表真实驿站'
    },
    {
      id: 'SP-03', name: '玉兰小学南侧司机服务站（演示）', type: '服务站',
      distance: '约 1.3 公里', services: ['临时停车位', '洗漱', '饮用水', '厕所'],
      openHours: '每日 07:00 - 20:00（演示时段）',
      note: '演示数据，不代表真实驿站'
    }
  ];

  /* ------------------------------------------------------------------ 激励规则 */
  var INCENTIVES = [
    { id: 'IN-01', name: '有效上报积分', condition: '上报被人工确认为有效线索', points: 10, benefit: '计入积分账户' },
    { id: 'IN-02', name: '高价值线索加成', condition: '被判定为高风险并采纳', points: 30, benefit: '额外积分' },
    { id: 'IN-03', name: '驿站权益兑换', condition: '积分达到 100 分（演示阈值）', points: -100, benefit: '驿站饮水与充电权益包（演示）' },
    { id: 'IN-04', name: '托管优先权', condition: '连续 4 周有效上报（演示条件）', points: 0, benefit: '子女课后托管申请优先受理（演示）' },
    { id: 'IN-05', name: '群体差异化补足', condition: '参与率偏低群体首单奖励（演示）', points: 15, benefit: '降低参与门槛（演示）' }
  ];

  var RIDER_PROFILE = {
    id: 'R-1001',
    name: '示例骑手 A',
    role: '示例骑手（虚构角色）',
    group: '示例骑手（演示分组）',
    points: 120,
    pointsNote: '演示数值，用于展示激励机制界面',
    weekReports: 5,
    weekResolved: 3,
    streakWeeks: 2
  };

  /* ------------------------------------------------ AI 2 第一轮仿真结果（真实数据）
   * 来源：simulation/results/aggregated-metrics.csv（每情景 20 次重复的均值与正态近似 95% 区间）
   *       simulation/results/paired-effects.csv（配对共同随机数下的递进机制差）
   *       simulation/results/run-metrics.csv（分群体参与率，由 20 次逐次运行求均值）
   * 限定语（引用时必须保留）：在当前项目假设下的合成仿真结果，不是现实统计或政策效果证明。
   *   每情景 20 次重复、每次 240 名合成从业者、56 个模拟日、基础随机种子 20260914、配对共同随机数。
   *   第一轮使用自主代码环境，未做统计显著性检验。
   * 尚未产出（一律保留 SIM_RESULT_NEEDED，不自行编造数字）：
   *   sensitivity-analysis.md（敏感性分析）与 final-summary.md（最终汇总）在仓库中不存在。
   */
  var SIM_RESULTS = {
    dataSource: 'AI2-simulation',
    isPlaceholder: false,
    round: '第一轮',
    notice: '第一轮合成仿真结果（每情景 20 次重复）。在当前项目假设下得出，不是现实统计或政策效果证明。',
    runDate: '2026-09-15',
    runDateNote: 'experiment-manifest.json 未记录运行时间，此处采用成果提交日期',
    repeats: 20,
    populationPerRun: 240,
    daysPerRun: 56,
    baseSeed: 20260914,
    limiter: '第一轮使用自主代码环境，尚未在玉兰万象平台复跑；未做统计显著性检验；全部参数为项目假设。',
    metrics: [
      {
        key: 'effectiveReportRate', name: '有效上报率', unit: '%', direction: 'up',
        note: '有效独立上报及成功合并佐证数 ÷ 普通原始上报数', scale: 'index-100',
        values: { S0: 53.5, S1: 71.9, S2: 71.4, S3: 70.1 },
        ci: { S0: [52.6, 54.4], S1: [71.2, 72.7], S2: [70.7, 72.2], S3: [69.6, 70.6] }
      },
      {
        key: 'duplicateOrInvalidRate', name: '重复或无效上报率', unit: '%', direction: 'down',
        note: '无效上报及未合并重复数 ÷ 普通原始上报数（与有效上报率互补）', scale: 'index-100',
        values: { S0: 46.5, S1: 28.1, S2: 28.6, S3: 29.9 },
        ci: { S0: [45.6, 47.4], S1: [27.3, 28.8], S2: [27.8, 29.3], S3: [29.4, 30.4] }
      },
      {
        key: 'dispatchAccuracy', name: '工单分派准确率', unit: '%', direction: 'up',
        note: '正确分派工单数 ÷ 工单数', scale: 'index-100',
        values: { S0: 64.6, S1: 85.2, S2: 85.7, S3: 85.2 },
        ci: { S0: [63.0, 66.3], S1: [84.5, 86.0], S2: [85.1, 86.2], S3: [84.5, 85.9] }
      },
      {
        key: 'avgHandlingHours', name: '平均处置时间', unit: '小时', direction: 'down',
        note: '已解决工单的处置小时均值', scale: 'hours',
        values: { S0: 51.66, S1: 32.39, S2: 27.20, S3: 27.16 },
        ci: { S0: [50.89, 52.44], S1: [32.09, 32.68], S2: [27.03, 27.36], S3: [26.97, 27.35] }
      },
      {
        key: 'participantTimeCost', name: '平均上报耗时', unit: '分钟', direction: 'down',
        note: '所有实际上报（含应急转接）的分钟均值，仅覆盖上报环节、不含等待处置时间；两位小数会把 S1/S2/S3 都显示为 3.00，S2→S3 配对差 +0.0065 分钟且区间跨越 0',
        scale: 'minutes',
        values: { S0: 8.01, S1: 3.00, S2: 3.00, S3: 3.00 },
        ci: { S0: [7.98, 8.04], S1: [2.99, 3.01], S2: [2.99, 3.00], S3: [3.00, 3.01] },
        exact: { S0: 8.0112, S1: 2.9973, S2: 2.9962, S3: 3.0027 }
      },
      {
        key: 'participationGap', name: '群体参与差距', unit: '百分点', direction: 'down',
        note: '骑手参与率与网约车司机参与率之差的绝对值（仅两类群体，非多群体极差）；该项波动明显大于其他指标，不宜用于强结论', scale: 'percentage-points',
        values: { S0: 1.19, S1: 2.33, S2: 2.81, S3: 2.78 },
        ci: { S0: [0.91, 1.48], S1: [1.61, 3.05], S2: [1.90, 3.72], S3: [1.40, 4.17] }
      }
    ],
    // 补充观察项（不属于六项固定指标）
    supplementary: [
      {
        key: 'latePeriodParticipation', name: '最后两周参与率（辅助指标）', unit: '%', direction: 'up',
        note: '第 43—56 日上报数 ÷ 同期普通问题遇见数；对应研究问题中的持续参与',
        values: { S0: 12.2, S1: 29.6, S2: 40.2, S3: 49.3 }
      },
      {
        key: 'issueCoverageRate', name: '独立问题覆盖率（辅助指标）', unit: '%', direction: 'up',
        note: '至少收到有效信息的问题数 ÷ 被遇见的独立问题数',
        values: { S0: 15.3, S1: 41.8, S2: 52.2, S3: 59.6 }
      },
      {
        key: 'resolutionRate', name: '工单解决率（辅助指标）', unit: '%', direction: 'up',
        note: '已解决工单数 ÷ 工单数；S3 相对 S2 轻微下降且 95% 区间跨越 0',
        values: { S0: 78.9, S1: 83.1, S2: 87.2, S3: 86.4 }
      }
    ],
    // 分群体参与率（仅两类，来自 run-metrics.csv 的 20 次均值）
    // 注意：参与差距指标是「每次运行 |骑手−司机| 的均值」，不等于此处两组均值的差，
    //       因此两组均值看起来接近（如 S0 为 12.26% 与 11.93%），而差距指标为 1.19 个百分点。
    groups: [
      { name: '骑手参与率', values: { S0: 12.26, S1: 29.67, S2: 40.04, S3: 48.27 } },
      { name: '网约车司机参与率', values: { S0: 11.93, S1: 28.46, S2: 38.53, S3: 46.03 } }
    ],
    groupNote: '本轮仿真只有骑手与网约车司机两类群体。原型早期版本出现的四分组（早高峰骑手 / 夜间骑手 / 网约车司机 / 兼职骑手）在仿真数据中没有对应分组，已删除。',
    groupCaveat: '两组均值非常接近，是因为本轮的骑手与司机画像差异很小；而「群体参与差距」指标是每次运行下两组参与率之差的均值（不是两组均值的差），因此该指标大于此处两组均值之差。两者不可互相推算。',
    groupMax: 60,
    // 递进机制配对效应（配对共同随机数）
    pairedEffects: [
      { transition: 'S0→S1', metric: '有效上报率', diff: '+18.4 个百分点', ci: '[+17.4, +19.5]', crossesZero: false, caveat: '' },
      { transition: 'S0→S1', metric: '平均上报耗时', diff: '−5.01 分钟', ci: '[−5.04, −4.98]', crossesZero: false, caveat: '' },
      { transition: 'S1→S2', metric: '平均处置时间', diff: '−5.19 小时', ci: '[−5.47, −4.90]', crossesZero: false, caveat: '该步同时调整了基础处置时长参数（36→30 小时），不应全部归因于透明反馈' },
      { transition: 'S1→S2', metric: '最后两周参与率', diff: '+10.6 个百分点', ci: '[+9.3, +11.9]', crossesZero: false, caveat: '' },
      { transition: 'S2→S3', metric: '独立问题覆盖率', diff: '+7.4 个百分点', ci: '[+6.4, +8.3]', crossesZero: false, caveat: '' },
      { transition: 'S2→S3', metric: '群体参与差距', diff: '−0.03 个百分点', ci: '[−1.90, +1.84]', crossesZero: true, caveat: '区间跨越 0，不得宣称激励缩小了参与差距' }
    ],
    conclusion: '在当前项目假设下，模型显示：AI 上报（S1）把平均上报耗时从 8.01 分钟降到 3.00 分钟、有效上报率从 53.5% 提高到 71.9%；透明反馈（S2）把平均处置时间从 32.39 小时降到 27.20 小时；差异化服务激励（S3）把独立问题覆盖率从 52.2% 提高到 59.6%、最后两周参与率从 40.2% 提高到 49.3%，同期有效上报率从 71.4% 小幅回落到 70.1%。群体参与差距没有缩小：S0 至 S2 由 1.19 扩大到 2.81 个百分点，S2→S3 的变化为 −0.03 个百分点且 95% 区间跨越 0。',
    limitations: [
      '本页数值为第一轮合成仿真结果，不是现实统计或政策效果证明，不得作为因果结论引用。',
      '参与者为合成智能体；居民、站长与处置机构在自主代码中被压缩为机制函数。',
      '参数均为项目假设，未经总体数据校准；敏感性分析已设计 6 组低/中/高档位但尚未执行：SIM_RESULT_NEEDED_SENSITIVITY。',
      '第一轮使用自主代码环境，尚未在玉兰万象平台复跑：SIM_RESULT_NEEDED_ONESIM_RERUN。',
      '未做任何统计显著性检验，本页与报告均不使用「显著」表述，只描述差值与 95% 区间。',
      '群体参与差距的 95% 区间明显宽于其他指标（S3 为 [1.40, 4.17]），估计不稳定。',
      'S1→S2 并非严格单变量：该步除反馈机制外还调整了基础处置时长参数（36→30 小时）。',
      '平均处置时间只统计已解决工单；平均上报耗时只覆盖上报环节，不含等待处置时间。'
    ],
    pendingItems: [
      { key: 'SIM_RESULT_NEEDED_SENSITIVITY', desc: '关键参数敏感性分析（simulation/results/sensitivity-analysis.md 尚未产出）' },
      { key: 'SIM_RESULT_NEEDED_FINAL_SUMMARY', desc: '第一轮最终汇总（simulation/results/final-summary.md 尚未产出）' },
      { key: 'SIM_RESULT_NEEDED_ONESIM_RERUN', desc: '玉兰万象平台复跑或导出交叉核对' }
    ],
    assumptionRefs: '参数来源见 simulation/evidence/parameter-register.md（全部登记为项目假设）；CITATION_NEEDED — 条文级政策依据待 AI 1 逐字复核'
  };

  /* ------------------------------------------------------------- 参数与假设表
   * 取值来自 AI 2 的 simulation/code/config.json 与 evidence/parameter-register.md。
   * 来源标注：来自材料 / 机制设定 / 项目假设 / 实验记录 / 待补。
   */
  var SIM_PARAMS = [
    { key: 'population_per_run', name: '每次运行合成从业者数', value: '240 名', source: '项目假设', affects: '全部情景', note: '模型规模设定，未经总体校准' },
    { key: 'days_per_run', name: '每次运行模拟天数', value: '56 天', source: '项目假设', affects: '全部情景', note: '最后两周（第 43—56 日）用于观察持续参与' },
    { key: 'runs_per_scenario', name: '每情景重复次数', value: '20 次', source: '实验记录', affects: '全部情景', note: '计划为至少 5 次，实际完成 20 次' },
    { key: 'base_seed', name: '基础随机种子', value: '20260914', source: '实验记录', affects: '全部情景', note: '与配对共同随机数配合使用' },
    { key: 'paired_common_random_numbers', name: '配对共同随机数', value: '启用', source: '实验设计', affects: 'S0–S3 配对比较', note: '同一 run 编号内比较情景差异' },
    { key: 'daily_encounter_probability', name: '每日问题遇见概率', value: '0.18', source: '项目假设', affects: '全部情景', note: '已列入敏感性档位：0.10 / 0.18 / 0.28' },
    { key: 'rider_share', name: '骑手建模占比', value: '0.773', source: '项目假设', affects: '全部情景', note: '等于调研中两类一线从业者 17/22，不代表真实占比' },
    { key: 'time_pressure', name: '从业者时间压力', value: '0.45–0.95（司机 +0.05）', source: '来自材料（方向）+ 项目假设（范围）', affects: '全部情景', note: '材料支持方向，数值范围为假设' },
    { key: 'trust_baseline', name: '初始信任度', value: '0.30–0.75', source: '来自材料（机制）+ 项目假设（幅度）', affects: '全部情景', note: '已列入敏感性档位：−0.15 / 0 / +0.15' },
    { key: 'structured_capability', name: 'AI 结构化能力', value: '0.88', source: '项目假设', affects: 'S1–S3', note: '已列入敏感性档位：0.70 / 0.88 / 0.95' },
    { key: 'feedback_probability', name: '反馈送达概率', value: 'S2/S3 0.80；S0 无反馈', source: '机制设定', affects: 'S2、S3', note: '已列入敏感性档位：0.60 / 0.80 / 0.92' },
    { key: 'incentive_strength', name: '差异化激励强度', value: '0.55（匹配式）', source: '机制设定', affects: 'S3', note: '已列入敏感性档位：0.20 / 0.55 / 0.85；仅服务型权益，不含现金' },
    { key: 'base_information_quality', name: '基础信息质量', value: '0.56', source: '项目假设', affects: '全部情景', note: '影响接受概率与有效上报率' },
    { key: 'base_resolution_hours', name: '基础处置时长', value: 'S1 36 小时 → S2 30 小时', source: '项目假设', affects: 'S1、S2', note: '该参数在 S1→S2 同时变化，因此 S2 的改善不应全部归因于透明反馈' },
    { key: 'resolved_probability', name: '处置完成概率', value: '0.76（正确分派另有加成）', source: '项目假设', affects: '全部情景', note: '影响工单解决率' },
    { key: 'dedup_threshold', name: '重复判定方式', value: '同类别 + 网格距离 ≤ 1 + 48 小时内', source: '机制设定', affects: 'S1–S3', note: '仿真侧为去重概率；原型 engine.js 使用同规则的确定性版本' },
    { key: 'sensitivity_status', name: '敏感性分析状态', value: 'SIM_RESULT_NEEDED_SENSITIVITY（已设计 6 组档位，未执行）', source: '待补', affects: '全部情景', note: '不得以估计值代替' }
  ];

  var SCENARIO_TRADEOFFS = [
    { risk: '激励可能诱导无效上报', handling: '有效线索才计积分，无效不计分；重复项合并后不重复计分' },
    { risk: '透明反馈可能增加治理端工作量', handling: '反馈模板化、批量处理；原型以模板演示' },
    { risk: '位置信息带来隐私顾虑', handling: '默认只取网格级位置，精确门牌降精度处理；部署阶段需补单独同意与告知（见 safety-and-privacy.md）' },
    { risk: '服务型激励可能扩大群体参与差距', handling: '第一轮仿真显示差距未缩小（S0 1.19 → S2 2.81 个百分点，S2→S3 区间跨 0），因此落地阶段须单列群体参与差距指标，并设计面向低参与群体的可达性措施' },
    { risk: '参与者时间成本几乎不受机制影响', handling: 'S1–S3 平均上报耗时均在 3.00 分钟附近，说明该指标由上报流程步数决定，而非反馈与激励；界面显示两位小数会掩盖差异' }
  ];

  return {
    NOTICES: NOTICES,
    SCENARIOS: SCENARIOS,
    CATEGORIES: CATEGORIES,
    FALLBACK_CATEGORY: FALLBACK_CATEGORY,
    PII_RULES: PII_RULES,
    LOCALITY: LOCALITY,
    LOCATION_PRESETS: LOCATION_PRESETS,
    DEMO_INPUTS: DEMO_INPUTS,
    SEED_TICKETS: SEED_TICKETS,
    OWNERS: OWNERS,
    SERVICE_POINTS: SERVICE_POINTS,
    INCENTIVES: INCENTIVES,
    RIDER_PROFILE: RIDER_PROFILE,
    SIM_RESULTS: SIM_RESULTS,
    SIM_PARAMS: SIM_PARAMS,
    SCENARIO_TRADEOFFS: SCENARIO_TRADEOFFS
  };
})();
