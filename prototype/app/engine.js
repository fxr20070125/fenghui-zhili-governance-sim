/* =============================================================================
 * 蜂汇智理 原型 v0.1 — 规则式 AI 处理管线与指标口径（engine.js）
 * -----------------------------------------------------------------------------
 * 说明：本文件用【规则表】模拟 AI 处理，目的是让流程可解释、可复现、可录屏，
 *       不代表任何真实模型能力，也不对外宣称准确率。
 *       所有函数均为纯函数，便于核对与替换。
 * 负责人：AI 3
 * ========================================================================== */

window.FHZ_ENGINE = (function () {
  'use strict';

  var D = window.FHZ_DATA;
  var PLACEHOLDER_PREFIX = 'PLACEHOLDER_SIM_RESULT';

  /* ------------------------------------------------------------------ 基础工具 */

  // 演示时间基准（固定值，保证录屏与截图可重复；不使用系统真实时间）
  var DEMO_NOW = '2026-03-12 11:20';

  function parseTime(str) {
    // 输入格式：'YYYY-MM-DD HH:mm'
    if (!str) return null;
    var m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  }

  function hoursBetween(from, to) {
    var a = parseTime(from), b = parseTime(to);
    if (!a || !b) return null;
    return Math.round(((b - a) / 3600000) * 10) / 10;
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function nextTicketId(existingIds, seq) {
    var d = parseTime(DEMO_NOW);
    var prefix = 'T-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-';
    var today = existingIds.filter(function (id) { return id.indexOf(prefix) === 0; });
    var n = 7 + (seq || 0);
    while (today.indexOf(prefix + pad(n)) !== -1) n += 1;
    return prefix + pad(n);
  }

  // 网格距离：网格编号 G-03 → 索引 3；示意距离，非真实地理距离
  function gridDistance(a, b) {
    if (!a || !b) return null;
    var na = Number(String(a).replace(/\D/g, ''));
    var nb = Number(String(b).replace(/\D/g, ''));
    if (isNaN(na) || isNaN(nb)) return null;
    return Math.abs(na - nb);
  }

  /* ------------------------------------------------------- ① 脱敏 desensitize */

  function desensitize(text) {
    var out = String(text || '');
    var removed = [];

    function apply(re, replacer, id, label) {
      var hit = false;
      out = out.replace(re, function () {
        hit = true;
        return replacer.apply(null, arguments);
      });
      if (hit) removed.push({ id: id, label: label });
    }

    // 身份证优先处理：整段遮蔽（否则 18 位中的 11 位数字会被手机号规则误伤）
    apply(/(?<!\d)\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{4}(?!\d)/g,
      function (m) { return m.slice(0, 6) + '********' + m.slice(-3) + '（已移除）'; }, 'PII-ID', '身份证号');
    apply(/(?<!\d)\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/g,
      function (m) { return m.slice(0, 4) + '**********' + m.slice(-3) + '（已移除）'; }, 'PII-ID', '身份证号');
    // 手机号：保留前三后二（用数字边界避免误伤身份证等长数字串）
    apply(/(?<!\d)1[3-9]\d{9}(?!\d)/g, function (m) { return m.slice(0, 3) + '****' + m.slice(-2); },
      'PII-PHONE', '手机号');
    // 车牌：保留省份简称与首位字母
    apply(/[\u4e00-\u9fa5][A-Z]\s?[A-Z0-9]{5}/g, function (m) { return m.slice(0, 2) + '·***'; },
      'PII-PLATE', '车牌');
    // 微信 / QQ
    apply(/(微信|weixin|wechat|QQ|qq)\s*[:：]?\s*[A-Za-z0-9_-]{5,}/g,
      function (m) { return m.slice(0, 2) + '：联系方式已隐藏'; }, 'PII-CONTACT', '微信号 / QQ');
    // 精确门牌：保留到楼栋
    apply(/(\d{1,4})\s*(号|号楼)\s*(?:\d{1,4}\s*(?:室|门|户))/g,
      function (m, num, unit) { return num + ' ' + unit + '（户号已降精度）'; }, 'PII-ADDR', '精确门牌');
    // 疑似真实姓名：姓 + 1-2 字 + 称谓
    apply(/([\u4e00-\u9fa5])[\u4e00-\u9fa5]{1,2}(先生|女士|师傅)/g,
      function (m, surname, title) { return '某' + title; }, 'PII-NAME', '疑似真实姓名');

    return { text: out, removed: removed, ruleCount: removed.length };
  }

  /* ----------------------------------------------------- ② 结构化 structure */

  function structure(text, ctx) {
    var t = String(text || '');
    var cls = classify(t);
    var loc = (ctx && ctx.location) || null;
    var preset = null;
    for (var i = 0; i < D.LOCATION_PRESETS.length; i++) {
      if (D.LOCATION_PRESETS[i].id === loc) { preset = D.LOCATION_PRESETS[i]; break; }
    }

    var impactHits = [];
    if (/差点|危险|摔|翻车|过不去|看不清|盲道|孩子|学生/.test(t)) impactHits.push('通行安全受影响');
    if (/堵|占用|挡住|过不去/.test(t)) impactHits.push('通行空间被占用');
    if (/污水|异味|满溢|垃圾/.test(t)) impactHits.push('环境卫生受影响');
    if (/伤|血|动不了|被困/.test(t)) impactHits.push('可能有人身伤害');
    if (impactHits.length === 0) impactHits.push('暂未识别人身安全影响');

    var causeHits = [];
    if (/破了|破损|坏了|下沉|坑洼/.test(t)) causeHits.push('设施破损');
    if (/停|违停|占道/.test(t)) causeHits.push('车辆或物品占用');
    if (/积水|排水/.test(t)) causeHits.push('排水不畅');
    if (/没人修|还是|又/.test(t)) causeHits.push('疑似长期未处置');
    if (causeHits.length === 0) causeHits.push('原因待现场核实');

    return {
      what: cls.name + '问题：' + shorten(t, 34),
      where: preset ? (preset.label + '（' + preset.note + '）') : '位置待补充',
      when: (ctx && ctx.time) || DEMO_NOW,
      who: (ctx && ctx.reporter) || 'R-1001 · 示例骑手 A',
      impact: impactHits,
      suspectedCause: causeHits,
      evidence: (ctx && ctx.hasPhoto) ? ['现场照片（演示图）', '位置网格 ' + (loc || '未提供')] : ['位置网格 ' + (loc || '未提供')]
    };
  }

  function shorten(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  /* ------------------------------------------------------- ③ 分类 classify */

  function classify(text) {
    var t = String(text || '');
    var scores = [];

    D.CATEGORIES.forEach(function (cat) {
      var hits = cat.keywords.filter(function (k) { return t.indexOf(k) !== -1; });
      if (hits.length > 0) scores.push({ cat: cat, hits: hits, score: hits.length });
    });

    if (scores.length === 0) {
      return {
        key: D.FALLBACK_CATEGORY.key,
        name: D.FALLBACK_CATEGORY.name,
        confidence: 0.35,
        confidenceLabel: '低',
        level: D.FALLBACK_CATEGORY.level,
        sla: D.FALLBACK_CATEGORY.sla,
        risk: D.FALLBACK_CATEGORY.risk,
        reason: D.FALLBACK_CATEGORY.rationale,
        hitKeywords: [],
        secondary: []
      };
    }

    // 紧急类优先；其余按命中数量排序
    scores.sort(function (a, b) {
      var ae = a.cat.key === 'emergency' ? 1 : 0;
      var be = b.cat.key === 'emergency' ? 1 : 0;
      if (ae !== be) return be - ae;
      return b.score - a.score;
    });

    var top = scores[0];
    var conf = Math.min(0.95, 0.45 + top.score * 0.16);
    if (top.cat.key === 'emergency') conf = Math.min(0.97, 0.78 + top.score * 0.05);

    return {
      key: top.cat.key,
      name: top.cat.name,
      confidence: Math.round(conf * 100) / 100,
      confidenceLabel: conf >= 0.8 ? '高' : (conf >= 0.6 ? '中' : '低'),
      level: top.cat.level,
      sla: top.cat.sla,
      risk: top.cat.risk,
      reason: '命中关键词：' + top.hits.join('、'),
      hitKeywords: top.hits,
      secondary: scores.slice(1, 3).map(function (s) {
        return { key: s.cat.key, name: s.cat.name, hits: s.hits };
      })
    };
  }

  /* ----------------------------------------------- ④ 重复检测 detectDuplicate */

  function detectDuplicate(ticket, tickets) {
    var list = (tickets || []).filter(function (t) {
      return t.id !== ticket.id && t.status !== 'resolved' && t.status !== 'transferred';
    });
    var best = null;

    list.forEach(function (t) {
      var dist = gridDistance(ticket.location, t.location);
      if (dist === null || dist > 1) return;
      var sameCat = t.categoryKey === ticket.categoryKey;
      var hours = hoursBetween(t.createdAt, ticket.createdAt || DEMO_NOW);
      if (hours === null) hours = 0;
      if (Math.abs(hours) > 48) return;
      var score = (sameCat ? 0.6 : 0.3) + (1 - Math.min(dist, 1)) * 0.25 + (1 - Math.min(Math.abs(hours), 48) / 48) * 0.15;
      if (!best || score > best.score) {
        best = {
          id: t.id, score: Math.round(score * 100) / 100, distance: dist, hours: Math.abs(hours),
          sameCategory: sameCat, categoryName: t.categoryName || t.categoryKey,
          summary: shorten(t.desensitized && t.desensitized.text ? t.desensitized.text : t.rawText, 40),
          status: t.status, createdAt: t.createdAt
        };
      }
    });

    if (!best) return { hasDuplicate: false, candidate: null, note: '未发现 48 小时内的同类近邻上报' };
    return {
      hasDuplicate: true,
      candidate: best,
      note: best.sameCategory
        ? '同类别且位于相邻网格，' + best.hours + ' 小时前已有上报，建议合并处理'
        : '位于相邻网格但类别不同，可能相关，建议人工判断是否合并'
    };
  }

  /* -------------------------------------------------- ⑤ 风险分级 assessRisk */

  function assessRisk(text, category) {
    var t = String(text || '');
    var cat = category || classify(t);
    var hits = cat.hitKeywords || [];

    if (cat.key === 'emergency') {
      return {
        level: 'emergency', label: '紧急',
        reason: '命中法定应急词表：' + hits.join('、') + '。此类事件不属于普通工单流程。',
        path: 'emergency'
      };
    }
    if (cat.risk === 'high') {
      return { level: 'high', label: '高', reason: cat.reason + '，涉及安全类风险，建议 24 小时内核查。', path: 'normal' };
    }
    if (cat.risk === 'medium') {
      return { level: 'medium', label: '中', reason: cat.reason + '，建议 72 小时内处置。', path: 'normal' };
    }
    return { level: 'low', label: '低', reason: cat.reason + '，建议 7 天内处置。', path: 'normal' };
  }

  /* --------------------------------------- ⑥ 建议分派 suggestDispatch（仅建议） */

  var LEVEL_LABEL = { community: '社区级', street: '街道级', city: '市级', emergency: '法定应急渠道' };

  function suggestDispatch(category, risk) {
    if (risk && risk.level === 'emergency') {
      return {
        level: 'emergency', levelLabel: LEVEL_LABEL.emergency,
        owner: '110 / 119 / 120 / 122',
        sla: '立即联系法定应急渠道',
        reason: '紧急事件不进入普通分派流程；平台仅留存线索，由法定应急渠道处置。',
        isAdvice: true, emergency: true
      };
    }

    var byCat = {
      safety: '示例街道 · 应急与消防管理岗',
      road: '示例街道 · 市政设施管养队',
      order: '示例街道 · 交通秩序管理岗',
      environment: '示例社区 · 环境卫生岗',
      service: '示例社区 · 居民服务岗',
      other: '示例社区 · 居民服务岗'
    };
    var owner = byCat[category.key] || '示例社区 · 居民服务岗';
    var level = category.level || 'community';

    return {
      level: level,
      levelLabel: LEVEL_LABEL[level] || '社区级',
      owner: owner,
      sla: category.sla,
      reason: '依据类别「' + category.name + '」与风险等级「' + (risk ? risk.label : '低') +
        '」，建议由' + (LEVEL_LABEL[level] || '社区级') + '处置主体受理。该建议需治理人员确认。',
      isAdvice: true,
      emergency: false
    };
  }

  /* ------------------------------------------------ 组合管线 runPipeline */

  function runPipeline(input, tickets) {
    var raw = String((input && input.rawText) || '');
    var des = desensitize(raw);
    var cls = classify(des.text);
    var risk = assessRisk(des.text, cls);
    var structured = structure(des.text, {
      location: input && input.location,
      time: DEMO_NOW,
      reporter: (input && input.reporter) || 'R-1001 · 示例骑手 A',
      hasPhoto: !!(input && input.hasPhoto)
    });
    var draft = {
      id: (input && input.id) || '(新工单)',
      createdAt: DEMO_NOW,
      location: input && input.location,
      categoryKey: cls.key,
      categoryName: cls.name
    };
    var dup = detectDuplicate(draft, tickets);
    var dispatch = suggestDispatch(cls, risk);

    return {
      rawText: raw,
      desensitized: des,
      structured: structured,
      category: cls,
      risk: risk,
      duplicate: dup,
      dispatch: dispatch,
      stages: [
        { key: 'desensitize', name: '脱敏', done: true, detail: des.ruleCount > 0 ? '命中 ' + des.ruleCount + ' 条脱敏规则' : '未命中个人敏感信息' },
        { key: 'structure', name: '结构化', done: true, detail: '抽取 5 类要素' },
        { key: 'classify', name: '分类与风险分级', done: true, detail: cls.name + ' · 置信度 ' + cls.confidence },
        { key: 'dedup', name: '重复检测', done: true, detail: dup.hasDuplicate ? '发现候选 ' + dup.candidate.id : '未发现重复' },
        { key: 'dispatch', name: '建议分派', done: true, detail: dispatch.owner }
      ]
    };
  }

  /* ------------------------------------------------- 工单构建与状态推进 */

  function buildTicket(pipeline, input, existingIds, seq) {
    var id = nextTicketId(existingIds || [], seq || 0);
    var emergency = pipeline.risk.level === 'emergency';
    var reporter = (input && input.reporter) || 'R-1001 · 示例骑手 A';

    return {
      id: id,
      createdAt: DEMO_NOW,
      channel: (input && input.channel) || 'mixed',
      rawText: pipeline.rawText,
      desensitized: pipeline.desensitized,
      structured: pipeline.structured,
      categoryKey: pipeline.category.key,
      categoryName: pipeline.category.name,
      categoryConfidence: pipeline.category.confidence,
      categoryReason: pipeline.category.reason,
      secondaryCategories: pipeline.category.secondary,
      riskLevel: pipeline.risk.level,
      riskLabel: pipeline.risk.label,
      riskReason: pipeline.risk.reason,
      location: input && input.location,
      photoLabel: (input && input.photoLabel) || '',
      reporter: reporter,
      modifiedByReporter: !!(input && input.modifiedByReporter),
      duplicateOf: pipeline.duplicate.hasDuplicate ? pipeline.duplicate.candidate.id : null,
      duplicateNote: pipeline.duplicate.note,
      suggestedDispatch: pipeline.dispatch,
      emergency: emergency,
      status: emergency ? 'emergency' : 'submitted',
      decision: null,
      resolution: null,
      timeline: [
        { at: DEMO_NOW, actor: '上报人', text: '提交上报（' + channelLabel((input && input.channel) || 'mixed') + '）', kind: 'user' },
        { at: DEMO_NOW, actor: 'AI 处理', text: '完成脱敏、结构化、分类、风险分级与建议分派', kind: 'ai' },
        { at: DEMO_NOW, actor: '上报人', text: '确认 AI 识别结果并提交工单 ' + id, kind: 'user' }
      ].concat(emergency ? [{ at: DEMO_NOW, actor: '系统提示', text: '紧急事件：已提示转接 110 / 119 / 120 / 122，不进入普通处置流程', kind: 'alert' }] : [])
    };
  }

  function channelLabel(ch) {
    return ({ voice: '语音', text: '文字', photo: '照片', location: '位置', mixed: '组合输入' })[ch] || '组合输入';
  }

  function applyDecision(ticket, decision) {
    var t = JSON.parse(JSON.stringify(ticket));
    t.decision = {
      action: decision.action,
      owner: decision.owner || '',
      note: decision.note || '',
      decidedAt: DEMO_NOW
    };
    if (decision.action === 'dispatch') {
      t.status = 'dispatched';
      t.timeline.push({ at: DEMO_NOW, actor: '治理人员', text: '人工确认并分派给「' + decision.owner + '」' + (decision.note ? '；备注：' + decision.note : ''), kind: 'human' });
      t.timeline.push({ at: DEMO_NOW, actor: '处置主体', text: '已接收工单，进入处置', kind: 'owner' });
      t.status = 'processing';
      t.timeline.push({ at: DEMO_NOW, actor: '系统反馈', text: '已向上报人推送责任主体与处理进度', kind: 'feedback' });
    } else if (decision.action === 'need_info') {
      t.status = 'need_info';
      t.timeline.push({ at: DEMO_NOW, actor: '治理人员', text: '人工退回补充：' + (decision.note || '请补充现场信息'), kind: 'human' });
      t.timeline.push({ at: DEMO_NOW, actor: '系统反馈', text: '已向上报人推送待补充事项', kind: 'feedback' });
    } else if (decision.action === 'transfer') {
      t.status = 'transferred';
      t.timeline.push({ at: DEMO_NOW, actor: '治理人员', text: '人工转交给「' + decision.owner + '」' + (decision.note ? '；备注：' + decision.note : ''), kind: 'human' });
      t.timeline.push({ at: DEMO_NOW, actor: '系统反馈', text: '已向上报人推送转交信息', kind: 'feedback' });
    }
    return t;
  }

  function applyResolution(ticket, resolution) {
    var t = JSON.parse(JSON.stringify(ticket));
    t.status = 'resolved';
    t.resolution = { text: resolution.text, points: resolution.points, owner: resolution.owner || (t.decision && t.decision.owner) || '', at: DEMO_NOW };
    t.timeline.push({ at: DEMO_NOW, actor: '处置主体', text: '处置完成：' + resolution.text, kind: 'owner' });
    t.timeline.push({ at: DEMO_NOW, actor: '治理人员', text: '人工确认办结并向上报人反馈', kind: 'human' });
    t.timeline.push({ at: DEMO_NOW, actor: '系统反馈', text: '已向上报人反馈处置结果' + (resolution.points ? '，计入积分 ' + resolution.points + ' 分（演示）' : ''), kind: 'feedback' });
    if (resolution.points) {
      t.timeline.push({ at: DEMO_NOW, actor: '激励机制', text: '服务型激励触发：+' + resolution.points + ' 积分（演示数值）', kind: 'incentive' });
    }
    return t;
  }

  /* ------------------------------------------------------------ 指标口径计算 */

  function computeMetrics(tickets) {
    var total = tickets.length;
    if (total === 0) {
      return { total: 0 };
    }
    var resolved = tickets.filter(function (t) { return t.status === 'resolved'; });
    var duplicate = tickets.filter(function (t) { return !!t.duplicateOf; });
    var dispatched = tickets.filter(function (t) { return !!t.decision && t.decision.action === 'dispatch'; });
    var oneShot = dispatched.filter(function (t) { return !t.decision.note || t.decision.note.indexOf('退回') === -1; });
    var withHours = resolved.map(function (t) { return hoursBetween(t.createdAt, t.resolution && t.resolution.at); })
      .filter(function (h) { return h !== null && h > 0; });

    var avgHours = withHours.length
      ? Math.round((withHours.reduce(function (a, b) { return a + b; }, 0) / withHours.length) * 10) / 10
      : null;

    return {
      total: total,
      effectiveReportRate: Math.round(((total - duplicate.length) / total) * 100),
      duplicateOrInvalidRate: Math.round((duplicate.length / total) * 100),
      dispatchAccuracy: dispatched.length ? Math.round((oneShot.length / dispatched.length) * 100) : null,
      avgHandlingHours: avgHours,
      closedCount: resolved.length,
      pendingCount: tickets.filter(function (t) { return ['submitted', 'need_info', 'dispatched', 'processing'].indexOf(t.status) !== -1; }).length,
      emergencyCount: tickets.filter(function (t) { return !!t.emergency; }).length,
      scope: '演示口径：仅基于本原型内置的示例工单，不代表真实治理统计'
    };
  }

  function placeholder(value) {
    return PLACEHOLDER_PREFIX + '::' + value;
  }

  return {
    DEMO_NOW: DEMO_NOW,
    PLACEHOLDER_PREFIX: PLACEHOLDER_PREFIX,
    desensitize: desensitize,
    structure: structure,
    classify: classify,
    detectDuplicate: detectDuplicate,
    assessRisk: assessRisk,
    suggestDispatch: suggestDispatch,
    runPipeline: runPipeline,
    buildTicket: buildTicket,
    applyDecision: applyDecision,
    applyResolution: applyResolution,
    computeMetrics: computeMetrics,
    gridDistance: gridDistance,
    hoursBetween: hoursBetween,
    channelLabel: channelLabel,
    placeholder: placeholder,
    shorten: shorten,
    LEVEL_LABEL: LEVEL_LABEL
  };
})();
