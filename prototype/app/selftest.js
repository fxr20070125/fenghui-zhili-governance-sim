/* =============================================================================
 * 蜂汇智理 原型 v0.1 — 引擎自检（selftest.js）
 * -----------------------------------------------------------------------------
 * 用途：在不需要浏览器的条件下核验规则式 AI 管线与指标口径是否按设计工作，
 *       并检查演示数据与安全边界（紧急分流、占位标记、无自动分派）。
 * 运行：node prototype/app/selftest.js
 * 说明：本脚本只读取 data.js / engine.js，不改动任何交付文件。
 * 负责人：AI 3
 * ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = __dirname;

const sandbox = { window: {}, console: console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);

for (const f of ['data.js', 'engine.js']) {
  const code = fs.readFileSync(path.join(APP, f), 'utf8');
  vm.runInContext(code, sandbox, { filename: f });
}

const D = sandbox.window.FHZ_DATA;
const E = sandbox.window.FHZ_ENGINE;

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) { pass++; console.log('  [PASS] ' + name); }
  else { fail++; failures.push(name + (detail ? ' → ' + detail : '')); console.log('  [FAIL] ' + name + (detail ? ' → ' + detail : '')); }
}

function section(t) { console.log('\n== ' + t + ' =='); }

/* ------------------------------------------------------------------ 1 脱敏 */

section('① 脱敏 desensitize');
const des = E.desensitize(D.DEMO_INPUTS.normal.rawText);
console.log('  输出：' + des.text);
check('手机号被遮蔽', /138\*{4}00/.test(des.text), des.text);
check('原始手机号已消失', des.text.indexOf('13812340000') === -1);
check('车牌被遮蔽', /沪A·\*\*\*/.test(des.text));
check('原始车牌已消失', des.text.indexOf('沪A12345') === -1);
check('脱敏明细包含手机号', des.removed.some(r => r.id === 'PII-PHONE'));
check('脱敏明细包含车牌', des.removed.some(r => r.id === 'PII-PLATE'));

const des2 = E.desensitize('住在玉兰小区 3 号楼 502 室，微信 rider_demo01，身份证 310101199001011234');
check('精确门牌降精度', /502/.test(des2.text) === false, des2.text);
check('联系方式隐藏', /联系方式已隐藏/.test(des2.text));
check('身份证整段遮蔽', /310101\*{8}234/.test(des2.text), des2.text);
check('身份证规则被记录', des2.removed.some(r => r.id === 'PII-ID'));
check('身份证不被手机号规则误伤', !/身份证 \d{6}\*{4}\d{2}/.test(des2.text), des2.text);

/* ------------------------------------------------------------ 2 结构化/分类 */

section('② 结构化与分类');
const st = E.structure(des.text, { location: 'G-03', time: E.DEMO_NOW, reporter: 'R-1001', hasPhoto: true });
check('结构化包含在哪里', /3 号网格/.test(st.where), st.where);
check('结构化包含影响', st.impact.length > 0);
check('结构化包含疑似原因', st.suspectedCause.length > 0);

const cls = E.classify(D.DEMO_INPUTS.normal.rawText);
console.log('  普通事件分类：' + cls.name + ' 置信度 ' + cls.confidence + ' / ' + cls.reason);
check('普通事件归入道路与设施', cls.key === 'road', cls.key);
check('置信度在合理区间', cls.confidence > 0.4 && cls.confidence <= 0.97);
check('提供命中依据', cls.reason.indexOf('命中关键词') === 0);

const emergencyText = D.DEMO_INPUTS.emergency.rawText;
const clsEm = E.classify(emergencyText);
check('紧急文本归入紧急事件', clsEm.key === 'emergency', clsEm.key);

const dupText = D.DEMO_INPUTS.duplicate.rawText;
check('重复场景仍归入道路与设施', E.classify(dupText).key === 'road');

/* --------------------------------------------------------------- 3 风险分级 */

section('③ 风险分级');
const riskNormal = E.assessRisk(D.DEMO_INPUTS.normal.rawText, E.classify(D.DEMO_INPUTS.normal.rawText));
check('井盖破损为中风险', riskNormal.level === 'medium', riskNormal.level);
check('中风险走普通流程', riskNormal.path === 'normal');

const riskEm = E.assessRisk(emergencyText, clsEm);
check('紧急文本判定为紧急', riskEm.level === 'emergency', riskEm.level);
check('紧急事件退出普通流程', riskEm.path === 'emergency');
check('紧急理由可解释', riskEm.reason.indexOf('命中法定应急词表') === 0);

const riskSafety = E.assessRisk('3 号楼消防通道被电动车堵住了');
check('消防通道为高风险', riskSafety.level === 'high', riskSafety.level);

/* -------------------------------------------------------------- 4 建议分派 */

section('④ 建议分派（仅建议）');
const dispNormal = E.suggestDispatch(cls, riskNormal);
check('普通事件建议街道级', dispNormal.level === 'street', dispNormal.level);
check('建议主体非空', !!dispNormal.owner, dispNormal.owner);
check('建议标记为建议', dispNormal.isAdvice === true);
check('建议包含时限', !!dispNormal.sla);
check('非紧急事件不带 emergency 标记', dispNormal.emergency === false);

const dispEm = E.suggestDispatch(clsEm, riskEm);
check('紧急事件建议转接法定渠道', dispEm.level === 'emergency' && dispEm.emergency === true);
check('紧急建议主体为四个号码', dispEm.owner === '110 / 119 / 120 / 122', dispEm.owner);

/* ---------------------------------------------------------------- 5 去重 */

section('⑤ 重复检测');
const seed = D.SEED_TICKETS.map(t => ({
  id: t.id, createdAt: t.createdAt, location: t.location, categoryKey: t.categoryKey,
  categoryName: t.categoryKey, rawText: t.rawText, status: t.status, desensitized: { text: t.rawText }
}));
const dup = E.detectDuplicate(
  { id: '(新)', createdAt: E.DEMO_NOW, location: 'G-03', categoryKey: 'road' },
  seed.filter(t => t.status !== 'resolved' && t.status !== 'transferred')
);
check('检测到重复候选', dup.hasDuplicate === true);
check('候选来自同网格的未办结工单',
  !!dup.candidate && ['T-20260312-06', 'T-20260312-07'].indexOf(dup.candidate.id) !== -1,
  JSON.stringify(dup.candidate));
check('候选网格距离为相邻或同格', dup.candidate && dup.candidate.distance <= 1, String(dup.candidate && dup.candidate.distance));
check('候选时间在 48 小时内', dup.candidate && dup.candidate.hours <= 48, String(dup.candidate && dup.candidate.hours));
check('重复说明提到合并建议', /建议合并处理/.test(dup.note), dup.note);

const noDup = E.detectDuplicate(
  { id: '(新)', createdAt: E.DEMO_NOW, location: 'G-05', categoryKey: 'service' },
  seed
);
check('远端不同类别不报重复', noDup.hasDuplicate === false, JSON.stringify(noDup.candidate));

/* ------------------------------------------------------------ 6 完整管线 */

section('⑥ 完整管线与工单构建');
const rv = E.runPipeline(D.DEMO_INPUTS.normal, D.SEED_TICKETS);
check('管线输出 5 个阶段', rv.stages.length === 5);
check('管线包含脱敏结果', !!rv.desensitized.text);
check('管线包含风险分级', !!rv.risk.level);
check('管线包含建议分派', !!rv.dispatch.owner);

const ids = D.SEED_TICKETS.map(t => t.id);
const ticket = E.buildTicket(rv, { channel: 'mixed', location: 'G-03', photoLabel: '演示图' }, ids, 0);
console.log('  生成工单：' + ticket.id + ' 状态 ' + ticket.status);
check('工单号唯一且格式正确', /^T-\d{8}-\d{2}$/.test(ticket.id) && ids.indexOf(ticket.id) === -1, ticket.id);
check('普通工单初始状态为已受理', ticket.status === 'submitted', ticket.status);
check('工单包含完整时间轴', ticket.timeline.length >= 3);
check('工单不包含 AI 决定（decision 为空）', ticket.decision === null, JSON.stringify(ticket.decision));

const ticketEm = E.buildTicket(E.runPipeline(D.DEMO_INPUTS.emergency, D.SEED_TICKETS),
  { channel: 'voice', location: 'G-03' }, ids, 1);
check('紧急工单带 emergency 标记', ticketEm.emergency === true);
check('紧急工单状态为 emergency', ticketEm.status === 'emergency', ticketEm.status);
check('紧急工单时间轴含应急提示', ticketEm.timeline.some(x => x.kind === 'alert'));

/* -------------------------------------------------- 7 人工决定与办结链路 */

section('⑦ 人工决定与反馈');
const dispatched = E.applyDecision(ticket, { action: 'dispatch', owner: '示例街道 · 市政设施管养队', note: '尽快核查' });
check('分派后状态为处置中', dispatched.status === 'processing', dispatched.status);
check('分派记录写入决定', dispatched.decision.action === 'dispatch');
check('分派写入人工节点', dispatched.timeline.some(x => x.kind === 'human'));
check('分派后推送反馈', dispatched.timeline.some(x => x.kind === 'feedback'));

const needInfo = E.applyDecision(ticket, { action: 'need_info', note: '请补充时间段' });
check('退回补充状态正确', needInfo.status === 'need_info', needInfo.status);

const resolved = E.applyResolution(dispatched, { text: '已修复', points: 10 });
check('办结状态正确', resolved.status === 'resolved', resolved.status);
check('办结记录处置结果', !!resolved.resolution.text);
check('办结触发激励节点', resolved.timeline.some(x => x.kind === 'incentive'));

const flipped = JSON.parse(JSON.stringify(ticket));
E.applyDecision(flipped, { action: 'need_info', note: 'x' });
check('原工单对象未被就地修改', ticket.status === 'submitted', ticket.status);

/* ------------------------------------------------------------ 8 指标口径 */

section('⑧ 指标口径');
const seedFull = D.SEED_TICKETS.map((s, i) => {
  const c = E.classify(s.rawText);
  const r = E.assessRisk(s.rawText, c);
  return {
    id: s.id, createdAt: s.createdAt, status: s.status, riskLevel: r.level,
    duplicateOf: s.duplicateOf || null, decision: s.decision || null, resolution: s.resolution || null,
    emergency: r.level === 'emergency'
  };
});
const m = E.computeMetrics(seedFull);
console.log('  指标：' + JSON.stringify(m));
check('重复率计算正确', m.duplicateOrInvalidRate === Math.round((seedFull.filter(t => t.duplicateOf).length / seedFull.length) * 100));
check('已办结数量正确', m.closedCount === seedFull.filter(t => t.status === 'resolved').length);
check('未办结数量正确', m.pendingCount === seedFull.filter(t => ['submitted', 'need_info', 'dispatched', 'processing'].indexOf(t.status) !== -1).length);
check('指标附带演示口径声明', /演示口径/.test(m.scope));
check('分派准确率为数值或 null', m.dispatchAccuracy === null || typeof m.dispatchAccuracy === 'number');

/* -------------------------------------------------- 9 占位数据与安全边界 */

section('⑨ 占位标记与安全边界');
const sim = D.SIM_RESULTS;
check('仿真数据源标记为占位', sim.dataSource === E.PLACEHOLDER_PREFIX, sim.dataSource);
check('仿真结果为占位标志', sim.isPlaceholder === true);
check('仿真无运行日期与重复次数', sim.runDate === null && sim.repeats === null);
check('六项固定指标齐全', sim.metrics.length === 6, String(sim.metrics.length));
check('S0–S3 四情景齐全', D.SCENARIOS.length === 4);
check('每个指标含四情景数值', sim.metrics.every(mt => ['S0', 'S1', 'S2', 'S3'].every(k => typeof mt.values[k] === 'number')));
check('结论含占位前缀', sim.conclusion.indexOf(E.PLACEHOLDER_PREFIX) === 0);
check('占位提示文案存在', /占位数据，不是实验结果/.test(sim.notice));
check('假设来源待补引用', /CITATION_NEEDED/.test(sim.assumptionRefs));

const appSrc = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
check('界面代码无自动分派路径', !/autoDispatch|自动分派\s*[:=]/.test(appSrc));
check('界面代码声明 AI 建议需人工确认', /需人工确认/.test(appSrc));
check('界面代码含四个法定号码', ['110', '119', '120', '122'].every(n => appSrc.indexOf(n) !== -1));
check('界面代码声明不替代法定应急渠道', /不替代法定应急渠道/.test(appSrc));
check('界面代码使用占位前缀常量', appSrc.indexOf('E.PLACEHOLDER_PREFIX') !== -1 || appSrc.indexOf('PLACEHOLDER_SIM_RESULT') !== -1);

const dataSrc = fs.readFileSync(path.join(APP, 'data.js'), 'utf8');
check('数据层声明不接入生产系统', /不接入任何政府、物业、外卖或网约车平台生产系统/.test(dataSrc));
const phoneLike = dataSrc.match(/1[3-9]\d{9}/g) || [];
check('数据层仅含虚构演示号码', phoneLike.every(n => n === '13812340000'), JSON.stringify(phoneLike));

const htmlSrc = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
check('入口页含演示环境声明', /虚构或脱敏/.test(htmlSrc) && /PLACEHOLDER_SIM_RESULT/.test(htmlSrc));
check('入口页无外部资源引用', !/https?:\/\//.test(htmlSrc.replace(/<!--[\s\S]*?-->/g, '')), '存在外部链接');
check('入口页含应急号码声明', /110 \/ 119 \/ 120 \/ 122/.test(htmlSrc));

/* ------------------------------------------------- 10 上下文与文案一致性 */

section('⑩ 关键文案与截图/文档一致性');
const review = E.runPipeline(D.DEMO_INPUTS.emergency, D.SEED_TICKETS);
check('紧急管线建议为法定渠道', review.dispatch.owner === '110 / 119 / 120 / 122');
check('紧急管线风险为紧急', review.risk.level === 'emergency');

const catNames = D.CATEGORIES.map(c => c.name);
check('类别数量为 6 类加 1 兜底', catNames.length === 6 && !!D.FALLBACK_CATEGORY.name);
check('每类都有建议层级与时限', D.CATEGORIES.every(c => !!c.level && !!c.sla));
check('脱敏规则表覆盖 6 类', D.PII_RULES.length === 6, String(D.PII_RULES.length));

/* ------------------------------------------------------------------ 汇总 */

console.log('\n========================================');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
if (fail > 0) {
  console.log('\n失败明细：');
  failures.forEach(f => console.log('  - ' + f));
}
console.log('========================================');
process.exit(fail === 0 ? 0 : 1);
