/* =============================================================================
 * 蜂汇智理 原型 v0.1 — 数据层（data.js）
 * -----------------------------------------------------------------------------
 * 重要声明：
 *   1. 本文件全部数据为【虚构或脱敏的演示数据】，不含任何真实个人信息。
 *   2. 仿真相关数值全部带 PLACEHOLDER_SIM_RESULT 前缀，属于【占位数据，不是实验结果】。
 *   3. 本原型不接入任何政府、物业、外卖或网约车平台生产系统。
 *   4. 地图与网格编号为示意数据，不代表真实行政区划。
 *   5. 严重事故、火灾或治安事件必须提示联系 110 / 119 / 120 / 122，AI 不替代法定应急渠道。
 * 负责人：AI 3 产品原型与演示工程师
 * ========================================================================== */

window.FHZ_DATA = (function () {
  'use strict';

  var NOTICES = {
    demo: '原型演示环境 · 演示数据为虚构或脱敏 · 不代表真实系统接入 · AI 输出仅为建议',
    placeholder: '占位数据，不是实验结果。数值用于演示界面结构，须由社会仿真实验的最终结果替换。',
    aiAdvice: 'AI 建议，需人工确认。模型输出不构成行政决定。',
    simDisclaimer: '数值均带 PLACEHOLDER_SIM_RESULT 标记，属占位数据，不是实验结果。'
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

  /* ------------------------------------------------------------------ 脱敏规则 */
  var PII_RULES = [
    { id: 'PII-PHONE', label: '手机号', note: '保留前三后二' },
    { id: 'PII-PLATE', label: '车牌', note: '保留省份简称' },
    { id: 'PII-ID', label: '身份证号', note: '整段移除' },
    { id: 'PII-CONTACT', label: '微信号 / QQ', note: '替换为联系方式已隐藏' },
    { id: 'PII-ADDR', label: '精确门牌', note: '保留到楼栋号' },
    { id: 'PII-NAME', label: '疑似真实姓名', note: '替换为某先生 / 某女士' }
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
    group: '早高峰骑手',
    points: 120,
    pointsNote: '演示数值，用于展示激励机制界面',
    weekReports: 5,
    weekResolved: 3,
    streakWeeks: 2
  };

  /* -------------------------------------------------- 占位仿真结果（PLACEHOLDER） */
  var SIM_RESULTS = {
    dataSource: 'PLACEHOLDER_SIM_RESULT',
    isPlaceholder: true,
    notice: NOTICES.placeholder,
    runDate: null,
    repeats: null,
    // 指标口径（单位与方向），与 technical-flow.md 第 5 节一致
    // 每个指标的 values 为该指标在 S0–S3 的占位数值
    metrics: [
      {
        key: 'effectiveReportRate', name: '有效上报率', unit: '%', direction: 'up',
        note: '有效工单数 / 总上报数', scale: 'index-100',
        values: { S0: 18, S1: 52, S2: 61, S3: 74 }
      },
      {
        key: 'duplicateOrInvalidRate', name: '重复或无效上报率', unit: '%', direction: 'down',
        note: '（重复 + 无效）/ 总上报数', scale: 'index-100',
        values: { S0: 46, S1: 21, S2: 17, S3: 9 }
      },
      {
        key: 'dispatchAccuracy', name: '工单分派准确率', unit: '%', direction: 'up',
        note: '一次分派即被认可的工单占比', scale: 'index-100',
        values: { S0: 41, S1: 63, S2: 71, S3: 79 }
      },
      {
        key: 'avgHandlingHours', name: '平均处置时间', unit: '小时', direction: 'down',
        note: '受理到办结的平均时长', scale: 'hours',
        values: { S0: 41.5, S1: 22.6, S2: 16.8, S3: 15.2 }
      },
      {
        key: 'participantTimeCost', name: '参与者时间成本', unit: '分钟', direction: 'down',
        note: '单次上报的平均操作与等待时间；占位值显示 S2、S3 略高于 S1，用于提示透明反馈与激励带来的额外操作成本', scale: 'minutes',
        values: { S0: 5.4, S1: 1.5, S2: 1.8, S3: 2.1 }
      },
      {
        key: 'participationGap', name: '不同新就业群体参与差距', unit: '百分点', direction: 'down',
        note: '分组参与率的极差', scale: 'percentage-points',
        values: { S0: 21, S1: 13, S2: 9, S3: 6 }
      }
    ],
    // 补充观察项（不属于六项固定指标，单独展示）
    supplementary: [
      { key: 'sustainedParticipation', name: '持续参与意愿指数（补充观察项）', unit: '指数', direction: 'up', values: { S0: 31, S1: 48, S2: 66, S3: 78 } }
    ],
    groups: [
      { name: '早高峰骑手', values: { S0: 26, S1: 58, S2: 66, S3: 79 } },
      { name: '夜间骑手', values: { S0: 17, S1: 44, S2: 55, S3: 71 } },
      { name: '网约车司机', values: { S0: 12, S1: 38, S2: 49, S3: 65 } },
      { name: '兼职骑手', values: { S0: 5, S1: 27, S2: 38, S3: 58 } }
    ],
    conclusion: 'PLACEHOLDER_SIM_RESULT::conclusion — 结论段落将在社会仿真实验完成后写入，' +
      '并区分「模型显示」与「现实证明」。当前不提供任何因果性结论。',
    limitations: [
      '全部数值为占位数据，不是实验结果，不得在报告或答辩中作为证据引用。',
      '数值方向仅用于演示界面结构，不能作为机制有效性的判断依据。',
      '参与者时间成本在 S2、S3 略高于 S1，体现透明反馈与激励带来的额外确认步骤，该现象需由仿真验证。',
      '参与差距为分组参与率的极差，分组口径须由 AI 2 在模型说明中固定。'
    ],
    assumptionRefs: 'CITATION_NEEDED — 参数来源待 AI 1 证据表与 AI 2 实验设计补充'
  };

  /* ------------------------------------------------------------- 参数与假设表 */
  var SIM_PARAMS = [
    { key: 'agentCount', name: '智能体数量', value: '待定', source: '项目假设', affects: '全部情景', note: '由 AI 2 模型说明确定' },
    { key: 'workHours', name: '日均工作时长', value: '10 小时', source: '项目假设', affects: '全部情景', note: '影响可上报时间窗口' },
    { key: 'timePressure', name: '时间压力敏感度', value: '高', source: '项目假设', affects: '全部情景', note: '决定上报意愿衰减速度' },
    { key: 'trustBaseline', name: '初始信任度', value: '低 - 中', source: '项目假设', affects: 'S0-S3', note: '影响首次上报门槛' },
    { key: 'privacyConcern', name: '隐私顾虑强度', value: '中 - 高', source: '项目假设', affects: 'S1-S3', note: '影响是否愿意开启位置与照片' },
    { key: 'feedbackLatency', name: '反馈时延', value: 'S2/S3：分钟级；S0：无反馈', source: '机制设定', affects: 'S2、S3', note: '透明反馈机制的实现方式' },
    { key: 'incentiveStrength', name: '激励强度', value: '服务型权益（演示阈值）', source: '机制设定', affects: 'S3', note: '仅服务型激励，不含现金' },
    { key: 'dedupThreshold', name: '重复合并阈值', value: '同类别 + 网格距离 ≤ 1', source: '机制设定', affects: 'S1-S3', note: '与原型 engine.js 规则一致' }
  ];

  var SCENARIO_TRADEOFFS = [
    { risk: '激励可能诱导无效上报', handling: '有效线索才计积分，无效不计分；重复项合并后不重复计分' },
    { risk: '透明反馈可能增加治理端工作量', handling: '反馈模板化、批量处理；原型以模板演示' },
    { risk: '位置信息带来隐私顾虑', handling: '默认只取网格级位置，精确门牌降精度处理' },
    { risk: '服务型激励可能加剧群体差距', handling: 'S3 设置群体差异化补足规则（演示），实际效果需仿真验证' }
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
