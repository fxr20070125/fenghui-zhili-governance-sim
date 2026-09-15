/* =============================================================================
 * 蜂汇智理 原型 v0.1 — 界面与交互（app.js）
 * -----------------------------------------------------------------------------
 * 免责声明：本原型的全部产品数据为虚构或脱敏的演示数据；
 *           仿真数值为 AI 2 第一轮合成仿真结果（每情景 20 次重复），在当前项目假设下得出，
 *           不是现实统计或政策效果证明；敏感性分析与玉兰万象复跑尚未产出，界面以 SIM_RESULT_NEEDED 标注；
 *           AI 输出仅为建议，必须由治理人员人工确认；
 *           严重事故、火灾或治安事件必须提示联系 110 / 119 / 120 / 122。
 * 负责人：AI 3
 * ========================================================================== */

(function () {
  'use strict';

  var D = window.FHZ_DATA;
  var E = window.FHZ_ENGINE;
  var STORAGE_KEY = 'fhz.demo.state.v1';

  /* ==================================================================== 状态 */

  var state = {
    tickets: [],
    route: { name: 'rider-home', params: {} },
    query: {},
    scenario: 'S3',
    report: {
      inputKind: 'normal',
      transcript: '',
      rawText: '',
      hasPhoto: false,
      photoLabel: '',
      location: 'G-03',
      recording: false
    },
    review: null,
    reviewInput: null,
    activeTicketId: null,
    filters: { risk: 'all', status: 'all' },
    simParams: { repeats: 5, incentive: 60 },
    demoMode: false,
    consent: false,
    consentModal: false,
    consentDraft: { a: false, b: false, c: false },
    editingDesc: false
  };

  /* ---------------------------------------------------------------- 工具函数 */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function ph(v) { return '<span class="ph-inline">' + E.PLACEHOLDER_PREFIX + '</span>' + esc(v); }

  // ---- 仿真结果渲染辅助（第二轮：真实结果 + 95% 区间）----
  var SIM_KEYS = ['S0', 'S1', 'S2', 'S3'];

  function num(v) {
    if (typeof v !== 'number') return String(v);
    return (Math.abs(v % 1) > 0.0001) ? v.toFixed(2) : String(v);
  }

  function valCell(mt, k) {
    var ci = mt.ci && mt.ci[k];
    var main = num(mt.values[k]) + (mt.unit === '%' ? '%' : '');
    var unitLine = (mt.unit && mt.unit !== '%') ? '<div class="note small">' + esc(mt.unit) + '</div>' : '';
    var ciLine = ci ? '<div class="ci">95% [' + num(ci[0]) + ', ' + num(ci[1]) + ']</div>' : '';
    return main + unitLine + ciLine;
  }

  function simLegend(sim) {
    return '<div class="note small sim-legend">' +
      '数据来源：<span class="mono">' + esc(sim.dataSource) + '</span> · ' + esc(sim.round) + '合成仿真 · 每情景 ' + sim.repeats + ' 次重复 · ' +
      sim.populationPerRun + ' 名合成从业者 × ' + sim.daysPerRun + ' 个模拟日 · 随机种子 ' + sim.baseSeed +
      ' · 配对共同随机数。每格数值下方的 95% 区间为正态近似。' +
      '<br><b>限定语：</b>' + esc(sim.limiter) + '在当前项目假设下得出，不是现实统计或政策效果证明。' +
      '</div>';
  }

  function simPendingCard(sim) {
    var pending = sim.pendingItems || [];
    var list = pending.filter(function (p) { return p.key !== 'SIM_RESULT_NEEDED_FINAL_SUMMARY'; });
    return '<div class="card placeholder-card"><div class="card-head"><h3>尚未产出的仿真材料</h3><span class="spacer"></span>' +
      '<span class="badge ph">' + pending.length + ' 项待补</span></div>' +
      '<div class="ph-banner"><span class="mono">' + E.PLACEHOLDER_PREFIX + '</span>' +
      '<span>以下条目在仿真侧尚未产出，本页不使用估计值代替，也未自行编造数字。</span></div>' +
      '<ul class="small" style="margin:0">' + list.map(function (p) {
        return '<li><b class="mono">' + esc(p.key) + '</b>：' + esc(p.desc) + '</li>';
      }).join('') + '</ul></div>';
  }

  function simMetricTable(sim, caption) {
    var rows = sim.metrics.map(function (mt) {
      var arr = SIM_KEYS.map(function (k) { return mt.values[k]; });
      var best = mt.direction === 'up' ? Math.max.apply(null, arr) : Math.min.apply(null, arr);
      var worst = mt.direction === 'up' ? Math.min.apply(null, arr) : Math.max.apply(null, arr);
      return '<tr><td><b>' + esc(mt.name) + '</b>' +
        '<div class="note small">' + esc(mt.note) + '</div>' +
        '<div class="note small">单位：' + esc(mt.unit) + ' · ' + (mt.direction === 'up' ? '越高越好' : '越低越好') + '</div></td>' +
        SIM_KEYS.map(function (k) {
          var cls = mt.values[k] === best ? 'best' : (mt.values[k] === worst ? 'worst' : '');
          return '<td class="num ' + cls + '">' + valCell(mt, k) + '</td>';
        }).join('') + '</tr>';
    }).join('');
    return '<table class="tbl sim-tbl"><caption>' + esc(caption) + '</caption>' +
      '<thead><tr><th>指标</th>' +
      '<th class="num">S0 现状基准</th><th class="num">S1 AI 上报</th>' +
      '<th class="num">S2 +透明反馈</th><th class="num">S3 +差异化激励</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>';
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  function isPlaceholder(v) { return String(v).indexOf(E.PLACEHOLDER_PREFIX) !== -1; }

  /* ------------------------------------------------------- 种子工单初始化 */

  function buildSeedTickets() {
    return D.SEED_TICKETS.map(function (seed) {
      var cls = E.classify(seed.rawText);
      var risk = E.assessRisk(seed.rawText, cls);
      var des = E.desensitize(seed.rawText);
      var structured = E.structure(des.text, {
        location: seed.location, time: seed.createdAt, reporter: seed.reporter, hasPhoto: !!seed.photoLabel
      });
      var dispatch = E.suggestDispatch(cls, risk);

      var t = {
        id: seed.id,
        createdAt: seed.createdAt,
        channel: seed.channel,
        rawText: seed.rawText,
        desensitized: des,
        structured: structured,
        categoryKey: cls.key,
        categoryName: cls.name,
        categoryConfidence: cls.confidence,
        categoryReason: cls.reason,
        secondaryCategories: cls.secondary,
        riskLevel: risk.level,
        riskLabel: risk.label,
        riskReason: risk.reason,
        location: seed.location,
        photoLabel: seed.photoLabel || '',
        reporter: seed.reporter,
        modifiedByReporter: !!seed.modifiedByReporter,
        duplicateOf: seed.duplicateOf || null,
        duplicateNote: seed.duplicateOf ? '与 ' + seed.duplicateOf + ' 位于同一网格，类别相同，建议合并查看' : '未发现 48 小时内的同类近邻上报',
        suggestedDispatch: dispatch,
        emergency: risk.level === 'emergency',
        status: seed.status,
        decision: seed.decision || null,
        resolution: seed.resolution || null,
        timeline: []
      };

      var tl = [
        { at: seed.createdAt, actor: '上报人', text: '提交上报（' + E.channelLabel(seed.channel) + '）', kind: 'user' },
        { at: seed.createdAt, actor: 'AI 处理', text: '完成脱敏、结构化、分类、风险分级与建议分派', kind: 'ai' },
        { at: seed.createdAt, actor: '上报人', text: '确认 AI 识别结果并提交工单 ' + seed.id, kind: 'user' }
      ];
      if (seed.decision) {
        var act = seed.decision.action;
        var label = act === 'dispatch' ? '人工确认并分派给「' + seed.decision.owner + '」'
          : act === 'need_info' ? '人工退回补充：' + seed.decision.note
            : '人工转交给「' + seed.decision.owner + '」';
        tl.push({ at: seed.decision.decidedAt, actor: '治理人员', text: label, kind: 'human' });
        if (act === 'dispatch') {
          // 状态机：人工确认分派（dispatched）→ 处置主体接单（processing）。
          // 种子工单按最终状态补全节点，避免出现「状态已分派但时间轴没有分派记录」的矛盾。
          tl.push({ at: seed.decision.decidedAt, actor: '系统反馈', text: '已向上报人推送责任主体与处理进度', kind: 'feedback' });
          if (seed.status !== 'dispatched') {
            tl.push({ at: seed.decision.decidedAt, actor: '处置主体', text: '已接收工单，进入处置', kind: 'owner' });
          }
        } else if (act === 'need_info') {
          tl.push({ at: seed.decision.decidedAt, actor: '系统反馈', text: '已向上报人推送待补充事项', kind: 'feedback' });
        } else if (act === 'transfer') {
          tl.push({ at: seed.decision.decidedAt, actor: '系统反馈', text: '已向上报人推送转交信息', kind: 'feedback' });
        }
      }
      if (seed.resolution) {
        tl.push({ at: seed.resolution.at, actor: '处置主体', text: '处置完成：' + seed.resolution.text, kind: 'owner' });
        tl.push({ at: seed.resolution.at, actor: '治理人员', text: '人工确认办结并向上报人反馈', kind: 'human' });
        tl.push({ at: seed.resolution.at, actor: '系统反馈', text: '已向上报人反馈处置结果，计入积分 ' + seed.resolution.points + ' 分（演示）', kind: 'feedback' });
        tl.push({ at: seed.resolution.at, actor: '激励机制', text: '服务型激励触发：+' + seed.resolution.points + ' 积分（演示数值）', kind: 'incentive' });
      }
      t.timeline = tl;
      return t;
    });
  }

  function loadState() {
    var saved = null;
    try { saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { saved = null; }
    if (saved && saved.tickets && saved.tickets.length) {
      state.tickets = saved.tickets;
      state.scenario = saved.scenario || 'S3';
    } else {
      state.tickets = buildSeedTickets();
      state.scenario = 'S3';
    }
    state.activeTicketId = state.tickets.length ? state.tickets[0].id : null;
  }

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tickets: state.tickets, scenario: state.scenario }));
    } catch (e) { /* 演示环境忽略存储异常 */ }
  }

  function resetDemo() {
    state.tickets = buildSeedTickets();
    state.scenario = 'S3';
    state.activeTicketId = state.tickets[0].id;
    state.report = { inputKind: 'normal', transcript: '', rawText: '', hasPhoto: false, photoLabel: '', location: 'G-03', recording: false };
    state.review = null;
    state.reviewInput = null;
    state.filters = { risk: 'all', status: 'all' };
    persist();
    toast('演示数据已重置为初始虚构数据');
    render();
  }

  function ticketById(id) {
    for (var i = 0; i < state.tickets.length; i++) if (state.tickets[i].id === id) return state.tickets[i];
    return null;
  }

  /* ==================================================================== 路由 */

  function parseRoute() {
    var raw = (window.location.hash || '#/rider/home').replace(/^#/, '');
    var parts = raw.split('?');
    var segs = parts[0].split('/').filter(function (s) { return s.length > 0; });
    var query = {};
    if (parts[1]) {
      parts[1].split('&').forEach(function (kv) {
        var i = kv.indexOf('=');
        if (i === -1) return;
        query[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
      });
    }
    state.query = query;
    var section = segs[0] || 'rider';
    var sub = segs[1] || 'home';
    var id = segs[2] || null;
    var name = section + '-' + sub;
    if (section === 'gov' && sub === 'events' && id) name = 'gov-events';
    state.route = { name: name, params: { section: section, sub: sub, id: id } };
  }

  function go(hash) {
    if (window.location.hash === hash) { render(); return; }
    window.location.hash = hash;
  }

  window.addEventListener('hashchange', function () {
    parseRoute();
    applyQueryDrivers();
    render();
  });

  /* ------------------------------------------------- 通过 URL 参数驱动演示状态 */

  function applyQueryDrivers() {
    var q = state.query;
    if (state.route.name === 'rider-report' && q.shot) {
      var preset = D.DEMO_INPUTS[q.shot] || D.DEMO_INPUTS.normal;
      state.report = {
        inputKind: preset.id,
        transcript: preset.transcript,
        rawText: preset.rawText,
        hasPhoto: true,
        photoLabel: preset.photoLabel,
        location: preset.location,
        recording: false
      };
    }
    if (state.route.name === 'rider-ai-review' && q.input) {
      var p = D.DEMO_INPUTS[q.input] || D.DEMO_INPUTS.normal;
      if (!state.review || state.reviewInput !== p.id) {
        state.reviewInput = p.id;
        state.review = E.runPipeline({
          rawText: p.rawText, location: p.location, hasPhoto: true, channel: p.channel
        }, state.tickets);
        state.report = {
          inputKind: p.id, transcript: p.transcript, rawText: p.rawText,
          hasPhoto: true, photoLabel: p.photoLabel, location: p.location, recording: false
        };
      }
    }
    if (state.route.name === 'rider-emergency-confirm' && q.input === 'emergency') {
      // 演示用：直接载入一条紧急线索，便于录屏与截图展示完整留存页
      var exists = state.tickets.some(function (t) { return t.emergency; });
      if (!exists) {
        var ep = D.DEMO_INPUTS.emergency;
        var pipe = E.runPipeline({
          rawText: ep.rawText, location: ep.location, hasPhoto: true, channel: ep.channel
        }, state.tickets);
        var et = E.buildTicket(pipe, {
          channel: ep.channel, location: ep.location, photoLabel: ep.photoLabel
        }, state.tickets.map(function (t) { return t.id; }), 0);
        state.tickets.unshift(et);
        state.activeTicketId = et.id;
      }
    }
    if (state.route.name === 'gov-events' && state.route.params.id) {
      state.activeTicketId = state.route.params.id;
    }
  }

  /* ================================================================ 渲染入口 */

  function render() {
    document.body.classList.toggle('demo-mode', state.demoMode);
    renderTopbar();
    var main = $('#main');
    var name = state.route.name;
    if (name === 'rider-home') main.innerHTML = viewRiderHome();
    else if (name === 'rider-report') main.innerHTML = viewRiderReport();
    else if (name === 'rider-ai-review') main.innerHTML = viewRiderReview();
    else if (name === 'rider-emergency-confirm') main.innerHTML = viewRiderEmergencyConfirm();
    else if (name === 'rider-progress') main.innerHTML = viewRiderProgress();
    else if (name === 'rider-services') main.innerHTML = viewRiderServices();
    else if (name === 'gov-events') main.innerHTML = viewGovEvents();
    else if (name === 'gov-map') main.innerHTML = viewGovMap();
    else if (name === 'gov-metrics') main.innerHTML = viewGovMetrics();
    else if (name === 'sim-compare') main.innerHTML = viewSimCompare();
    else if (name === 'sim-config') main.innerHTML = viewSimConfig();
    else if (name === 'sim-limits') main.innerHTML = viewSimLimits();
    else main.innerHTML = viewRiderHome();
    document.title = '蜂汇智理 原型 · ' + titleOf(name);

    var paramReset = $('#simParamReset');
    if (paramReset) paramReset.addEventListener('click', function () {
      state.simParams = { repeats: 5, incentive: 60 };
      render();
      toast('演示参数已恢复默认（不影响任何数值）');
    });

    var status = $('#demoStatus');
    if (status) {
      status.textContent = '演示状态 · 路由 ' + (window.location.hash || '#/rider/home') +
        ' · 当前工单 ' + (state.activeTicketId || '—') +
        ' · 工单数 ' + state.tickets.length +
        ' · 情景 ' + state.scenario +
        ' · 仿真数据 第一轮 20 次重复（AI2-simulation）' +
        ' · 产品数据 虚构/脱敏演示数据';
    }
  }

  function titleOf(name) {
    return ({
      'rider-home': '骑手端 · 首页', 'rider-report': '骑手端 · 一键上报',
      'rider-ai-review': '骑手端 · AI 识别与确认',
      'rider-emergency-confirm': '骑手端 · 紧急事件已留存线索',
      'rider-progress': '骑手端 · 处理进度与结果',
      'rider-services': '骑手端 · 服务查询', 'gov-events': '治理端 · 事件列表',
      'gov-map': '治理端 · 事件地图', 'gov-metrics': '治理端 · 核心指标概览',
      'sim-compare': '仿真端 · S0–S3 情景对比', 'sim-config': '仿真端 · 参数与假设',
      'sim-limits': '仿真端 · 结果局限'
    })[name] || '原型';
  }

  /* ------------------------------------------------------------------ 顶部栏 */

  function navLink(hash, label, section) {
    var active = state.route.params.section === section ? ' class="active"' : '';
    return '<a href="' + hash + '"' + active + '>' + label + '</a>';
  }

  function renderTopbar() {
    var scenOpts = D.SCENARIOS.map(function (s) {
      return '<option value="' + s.id + '"' + (state.scenario === s.id ? ' selected' : '') + '>' + s.id + ' ' + esc(s.name) + '</option>';
    }).join('');
    $('#topbar').innerHTML =
      '<div class="notice-bar"><span class="dot"></span><span>' + esc(D.NOTICES.demo) + '</span></div>' +
      '<div class="topbar-inner">' +
      '<div class="logo"><span class="mark">蜂</span><span>蜂汇智理<br><span class="sub">产品原型 v0.1 · AI 3 交付</span></span></div>' +
      '<nav class="nav">' +
      navLink('#/rider/home', '骑手端', 'rider') +
      navLink('#/gov/events', '治理端', 'gov') +
      navLink('#/sim/compare', '仿真端', 'sim') +
      '</nav>' +
      '<div class="console">' +
      '<label>情景</label><select id="scenarioSelect">' + scenOpts + '</select>' +
      '<label>载入场景</label><select id="loadScene">' +
      '<option value="">—</option>' +
      '<option value="normal">普通事件 → 上报页</option>' +
      '<option value="duplicate">重复事件 → AI 确认页</option>' +
      '<option value="emergency">紧急事件 → AI 确认页</option>' +
      '</select>' +
      '<button id="btnReset">重置演示数据</button>' +
      '<button id="btnDemo" class="primary">' + (state.demoMode ? '退出演示模式' : '演示模式') + '</button>' +
      '</div></div>';

    $('#scenarioSelect').addEventListener('change', function () {
      state.scenario = this.value; persist(); toast('已切换到 ' + this.value); render();
    });
    $('#loadScene').addEventListener('change', function () {
      var v = this.value;
      this.value = '';
      if (v === 'normal') go('#/rider/report');
      else if (v === 'duplicate') go('#/rider/ai-review?input=duplicate');
      else if (v === 'emergency') go('#/rider/ai-review?input=emergency');
    });
    $('#btnReset').addEventListener('click', resetDemo);
    $('#btnDemo').addEventListener('click', function () {
      state.demoMode = !state.demoMode; render();
      toast(state.demoMode ? '已进入演示模式（顶部控制台已隐藏，按 Esc 可退出）' : '已退出演示模式');
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.demoMode) { state.demoMode = false; render(); }
  });

  /* ============================================================== 骑手端视图 */

  function phoneShell(appbar, body, activeTab) {
    var tabs = [
      { key: 'home', ic: '🏠', label: '首页', href: '#/rider/home' },
      { key: 'report', ic: '➕', label: '上报', href: '#/rider/report' },
      { key: 'progress', ic: '📋', label: '进度', href: '#/rider/progress' },
      { key: 'services', ic: '🧭', label: '服务', href: '#/rider/services' }
    ];
    return '<div class="phone">' +
      '<div class="phone-appbar">' + appbar + '</div>' +
      '<div class="phone-body">' + body + '</div>' +
      '<div class="phone-tabbar">' + tabs.map(function (t) {
        return '<button data-nav="' + t.href + '"' + (t.key === activeTab ? ' class="active"' : '') + '>' +
          '<span class="ic">' + t.ic + '</span><span>' + t.label + '</span></button>';
      }).join('') + '</div></div>';
  }

  function viewRiderHome() {
    var p = D.RIDER_PROFILE;
    var mine = state.tickets.filter(function (t) { return t.reporter.indexOf(p.id) === 0; });
    var open = mine.filter(function (t) { return t.status !== 'resolved'; });
    var body =
      '<div class="hero-card">' +
      '<div class="avatar">骑</div>' +
      '<div><div class="who">' + esc(p.name) + ' <span class="badge ghost">虚构角色</span></div>' +
      '<div class="meta">' + esc(p.role) + ' · ' + esc(p.group) + '</div></div>' +
      '<div class="points"><div class="num">' + p.points + '</div><div class="lbl">演示积分</div></div>' +
      '</div>' +

      '<div class="entry-grid">' +
      entry('voice', '🎙️', '语音上报', '按住说话，一句话描述') +
      entry('photo', '📷', '照片上报', '拍照 + 位置，最快') +
      entry('text', '✍️', '文字上报', '打字描述更精确') +
      entry('location', '📍', '位置上报', '只报位置，稍后补充') +
      '</div>' +

      '<div class="sec-title">我的上报 <span class="spacer"></span>' +
      '<a class="more" href="#/rider/progress">全部 ' + mine.length + ' 条 ›</a></div>' +
      (mine.slice(0, 3).map(miniTicket).join('') || '<div class="note">暂无演示上报记录</div>') +

      '<div class="sec-title">附近服务（演示数据） <span class="spacer"></span>' +
      '<a class="more" href="#/rider/services">查看全部 ›</a></div>' +
      D.SERVICE_POINTS.slice(0, 2).map(function (sp) {
        return '<div class="list-item"><div class="grow"><div class="row1"><span class="title">' + esc(sp.name) + '</span>' +
          '<span class="badge ghost">' + esc(sp.type) + '</span></div>' +
          '<div class="sub">' + esc(sp.services.slice(0, 3).join(' · ')) + ' · ' + esc(sp.distance) + '</div></div>' +
          '<div class="right">' + esc(sp.openHours.split('（')[0]) + '</div></div>';
      }).join('') +

      '<div class="note info small" style="margin-top:10px">' +
      '本页所有数据为虚构或脱敏的演示数据，积分为演示数值；平台未接入任何生产系统。</div>';

    return '<div class="shell rider-shell">' + phoneShell(
      '<div><div class="title">蜂汇智理 · 骑手端</div><div class="sub">上报城市问题，30 秒完成</div></div>' +
      '<span class="spacer"></span><span class="badge ghost">演示</span>',
      body, 'home') + '</div>';
  }

  function entry(kind, ic, t, s) {
    return '<button class="entry" data-report="' + kind + '">' +
      '<span class="ic">' + ic + '</span><span><span class="t">' + t + '</span><br><span class="s">' + s + '</span></span></button>';
  }

  function miniTicket(t) {
    return '<div class="list-item"><div class="grow">' +
      '<div class="row1"><span class="title">' + esc(t.categoryName || '待分类') + '</span>' + riskBadge(t) + statusBadge(t) + '</div>' +
      '<div class="sub">' + esc(E.shorten(t.desensitized ? t.desensitized.text : t.rawText, 30)) + '</div>' +
      '<div class="sub mono">' + esc(t.id) + ' · ' + esc(t.createdAt) + '</div>' +
      '</div><div class="right">' + (t.resolution ? '+' + t.resolution.points + '<br>积分' : '—') + '</div></div>';
  }

  function riskBadge(t) {
    return '<span class="badge risk-' + t.riskLevel + '">风险 ' + esc(t.riskLabel || '') + '</span>';
  }

  var STATUS_META = {
    ai_processing: { label: '待确认', cls: 'wait' },
    submitted: { label: '已受理', cls: '' },
    need_info: { label: '需补充信息', cls: 'wait' },
    dispatched: { label: '已分派（待处置主体接单）', cls: '' },
    processing: { label: '处置中', cls: '' },
    resolved: { label: '已办结', cls: 'done' },
    transferred: { label: '已转交', cls: '' },
    emergency: { label: '紧急 · 已提示应急渠道', cls: 'wait' }
  };

  function statusBadge(t) {
    var m = STATUS_META[t.status] || { label: t.status, cls: '' };
    return '<span class="badge status ' + m.cls + '">' + esc(m.label) + '</span>';
  }

  /* ------------------------------------------------------------- 上报页 */

  function viewRiderReport() {
    var r = state.report;
    var canAnalyze = !!(r.rawText.trim() || r.transcript.trim() || r.hasPhoto);
    var preset = D.DEMO_INPUTS[r.inputKind] || D.DEMO_INPUTS.normal;
    var preset2 = D.LOCATION_PRESETS.filter(function (x) { return x.id === r.location; })[0] || D.LOCATION_PRESETS[0];

    var body =
      '<div class="note info small" style="margin-bottom:10px">演示控制台：可一键载入三种演示场景。语音转写为预置演示文本，不会真实录音或上传。</div>' +

      '<div class="input-card' + (r.transcript ? ' active' : '') + '">' +
      '<button class="mic-btn' + (r.recording ? ' rec' : '') + '" id="btnMic">🎙️</button>' +
      '<div class="body"><div class="t">语音描述</div>' +
      '<div class="s">' + (r.recording ? '正在识别…（演示）' : (r.transcript ? '已完成演示转写' : '按住或点击开始说话')) + '</div></div>' +
      '<div class="action">' + (r.transcript ? '<button class="btn small ghost" id="btnClearVoice">清除</button>' : '') + '</div>' +
      '</div>' +

      '<div class="transcript' + (r.transcript ? '' : ' empty') + '">' +
      (r.transcript ? '<div class="lbl">演示转写文本（非真实语音识别）</div>' + esc(r.transcript)
        : '<div class="lbl">转写结果</div>点击上方麦克风，载入演示转写文本') +
      '</div>' +

      '<div class="input-card' + (r.hasPhoto ? ' active' : '') + '">' +
      '<span class="ic">📷</span>' +
      '<div class="body"><div class="t">现场照片</div><div class="s">' +
      (r.hasPhoto ? esc(r.photoLabel || '演示图片') + ' · 已生成 AI 图像标签' : '可选，帮助治理人员判断') +
      '</div></div>' +
      '<div class="action"><button class="btn small" id="btnPhoto">' + (r.hasPhoto ? '更换' : '添加照片') + '</button></div>' +
      '</div>' +
      (r.hasPhoto ? '<div class="thumb" id="thumb">' + photoSvg(r.photoLabel) + '</div>' +
        '<div class="note small" style="margin:6px 0 10px">AI 图像标签（演示）：破损设施 · 占道物体 · 白天户外。图片为本机生成的演示图，不是真实拍摄。</div>' : '') +

      '<div class="input-card active">' +
      '<span class="ic">📍</span>' +
      '<div class="body"><div class="t">位置</div><div class="s">' + esc(preset2.label) + '</div></div>' +
      '<div class="action"><button class="btn small" id="btnLoc">切换</button></div>' +
      '</div>' +
      '<div class="loc-chip">定位备注：' + esc(preset2.note) + ' · 精度：网格级（演示，不调用真实定位）</div>' +

      '<div class="sec-title">补充文字（可选）</div>' +
      '<textarea class="field" id="rawText" rows="3" placeholder="例如：位置、时间、影响范围、是否有人受伤…">' + esc(r.rawText) + '</textarea>' +

      '<div class="divider"></div>' +
      consentSummaryCard() +
      (state.consentModal ? consentModal() : '') +
      '<div class="btn-row">' +
      '<button class="btn small ghost" data-quick="normal">快速示例：普通事件</button>' +
      '<button class="btn small ghost" data-quick="emergency">快速示例：紧急事件</button>' +
      '</div>' +
      '<div style="height:12px"></div>' +
      '<button class="btn primary wide" id="btnAnalyze"' + (canAnalyze ? '' : ' disabled') + '>AI 识别并生成确认页 ›</button>' +
      '<div class="note small" style="margin-top:8px">提交前必须经过 AI 识别与你的确认。AI 只提供建议，你可以修改类别与描述。</div>' +
      appealBox();

    var html = '<div class="shell rider-shell">' + phoneShell(
      '<div><div class="title">一键上报</div><div class="sub">语音 / 照片 / 位置 / 文字</div></div>' +
      '<span class="spacer"></span><span class="badge ghost">第 1 步 / 共 3 步</span>',
      body, 'report') + '</div>';

    setTimeout(bindReportEvents, 0);
    return html;
  }

  /* --------------------------------------------- 数据用途告知与单独同意（T-14）
   * 依据 AI 1 的法律分析：位置属行踪轨迹（个保法第 28 条敏感个人信息），
   * 处理需单独同意（第 29 条）并履行告知义务（第 17 条）。
   * 原型不采集真实录音、不调用真实定位、不涉及本地文件选择，
   * 因此此处的同意流程是设计演示，不是真实数据授权。
   */
  function consentSummaryCard() {
    return '<div class="card tight" style="margin-bottom:10px">' +
      '<div class="card-head"><h3>数据用途与同意</h3><span class="spacer"></span>' +
      '<span class="badge ' + (state.consent ? 'risk-low' : 'risk-medium') + '">' +
      (state.consent ? '本次会话已确认' : '未确认') + '</span></div>' +
      '<div class="note small">本原型不采集真实录音、不调用真实定位、不涉及本地文件选择，' +
      '位置只到网格级，因此<b>不产生真实的个人信息处理</b>。</div>' +
      '<div class="note small" style="margin-top:4px">以下是部署阶段的告知与单独同意设计。' +
      '真实上线时，位置（行踪轨迹）属敏感个人信息，需单独同意与明示告知。</div>' +
      '<div style="height:8px"></div>' +
      '<button class="btn small" id="btnConsentOpen">查看数据用途与单独同意</button>' +
      '</div>';
  }

  function consentModal() {
    var c = state.consentDraft || { a: false, b: false, c: false };
    return '<div class="modal-mask" id="consentMask"><div class="modal">' +
      '<h3>数据用途与单独同意</h3>' +
      '<div class="note small" style="margin:6px 0 12px">请逐项确认。第三项为位置信息（行踪轨迹）的单独同意。</div>' +
      consentItem('ckA', 'a', c.a, '处理目的与范围', '仅用于生成治理线索与反馈处理进度，不用于任何商业用途，不用于考核个人。', false) +
      consentItem('ckB', 'b', c.b, '最小必要与留存', '只采集问题点位所在的网格级位置；不持续追踪轨迹；语音即转即弃、不保存原始音频。', false) +
      consentItem('ckC', 'c', c.c, '位置信息的单独同意（敏感个人信息）', '位置信息属行踪轨迹。我单独同意在本次上报中使用网格级位置；我可随时撤回，撤回不影响此前已完成的处理。', true) +
      '<div class="note small">撤回方式与人工复核：可在「我的上报」中删除线索或联系治理人员复核；AI 输出仅作为建议，最终分派由人工决定。</div>' +
      '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn ghost" id="btnConsentCancel">取消</button>' +
      '<button class="btn primary" id="btnConsentOk"' + (c.a && c.b && c.c ? '' : ' disabled') + '>确认并继续</button>' +
      '</div></div></div>';
  }

  function consentItem(id, key, checked, title, desc, required) {
    return '<label class="consent-item' + (required ? ' required' : '') + '">' +
      '<input type="checkbox" id="' + id + '" data-consent="' + key + '"' + (checked ? ' checked' : '') + '>' +
      '<span><span class="t">' + esc(title) + (required ? '（单独同意）' : '') + '</span>' +
      '<span class="s" style="display:block">' + esc(desc) + '</span></span></label>';
  }

  function appealBox() {
    return '<div class="appeal-box" style="margin-top:12px">' +
      '<b>申诉与举报入口（设计占位）</b>' +
      '<div class="note small">对 AI 识别结果、分派决定或激励计分有异议时，可提交申诉；' +
      '平台需公布处理流程与反馈时限。本原型不提供真实提交通道，仅展示入口设计。</div>' +
      '<div class="btn-row" style="margin-top:8px"><button class="btn small ghost" id="btnAppeal">提交申诉（演示）</button>' +
      '<span class="note small">正式上线时需给出受理主体与时限</span></div></div>';
  }

  function photoSvg(label) {    return '<svg viewBox="0 0 320 180" width="100%" height="100%" role="img" aria-label="演示图片">' +
      '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#dfe8f2"/><stop offset="1" stop-color="#f2f4f7"/></linearGradient></defs>' +
      '<rect width="320" height="180" fill="url(#sky)"/>' +
      '<rect x="0" y="118" width="320" height="62" fill="#c9cdd4"/>' +
      '<rect x="0" y="112" width="320" height="8" fill="#b6bbc3"/>' +
      '<rect x="16" y="34" width="66" height="84" fill="#e6e9ee" stroke="#c3c8d0"/>' +
      '<rect x="238" y="46" width="66" height="72" fill="#e6e9ee" stroke="#c3c8d0"/>' +
      '<rect x="96" y="126" width="120" height="30" rx="6" fill="#8d939c"/>' +
      '<circle cx="156" cy="141" r="15" fill="#5d646e"/>' +
      '<rect x="176" y="128" width="42" height="12" rx="3" fill="#f5b323"/>' +
      '<rect x="60" y="150" width="200" height="6" rx="3" fill="#f2d47a"/>' +
      '<text x="12" y="26" font-size="12" fill="#3c4149" font-family="sans-serif">演示图片 · ' + esc(label || '现场') + '</text>' +
      '<text x="12" y="172" font-size="10" fill="#6c737d" font-family="sans-serif">本图为程序生成的示意图片，非真实照片</text>' +
      '</svg>';
  }

  function bindReportEvents() {
    var mic = $('#btnMic');
    if (mic) mic.addEventListener('click', function () {
      var r = state.report;
      if (r.recording) return;
      r.recording = true;
      render();
      setTimeout(function () {
        var preset = D.DEMO_INPUTS[state.report.inputKind] || D.DEMO_INPUTS.normal;
        state.report.recording = false;
        state.report.transcript = preset.transcript || '（演示转写）玉兰路望春街路口的井盖破了，差点摔车。';
        render();
        toast('演示转写完成（非真实语音识别）');
      }, 850);
    });

    var clear = $('#btnClearVoice');
    if (clear) clear.addEventListener('click', function () { state.report.transcript = ''; render(); });

    var photo = $('#btnPhoto');
    if (photo) photo.addEventListener('click', function () {
      state.report.hasPhoto = true;
      state.report.photoLabel = (D.DEMO_INPUTS[state.report.inputKind] || D.DEMO_INPUTS.normal).photoLabel;
      render();
      toast('已添加演示图片（本机生成，未上传）');
    });

    var loc = $('#btnLoc');
    if (loc) loc.addEventListener('click', function () {
      var ids = D.LOCATION_PRESETS.map(function (p) { return p.id; });
      var i = ids.indexOf(state.report.location);
      state.report.location = ids[(i + 1) % ids.length];
      render();
    });

    var ta = $('#rawText');
    if (ta) ta.addEventListener('input', function () {
      state.report.rawText = this.value;
      var btn = $('#btnAnalyze');
      var can = !!(state.report.rawText.trim() || state.report.transcript.trim() || state.report.hasPhoto);
      btn.disabled = !can;
    });

    $$('[data-quick]').forEach(function (b) {
      b.addEventListener('click', function () {
        var preset = D.DEMO_INPUTS[this.getAttribute('data-quick')];
        state.report.inputKind = preset.id;
        state.report.rawText = preset.rawText;
        state.report.transcript = preset.transcript;
        state.report.hasPhoto = true;
        state.report.photoLabel = preset.photoLabel;
        state.report.location = preset.location;
        render();
      });
    });

    var btn = $('#btnAnalyze');
    if (btn) btn.addEventListener('click', function () {
      var r = state.report;
      var raw = (r.rawText && r.rawText.trim()) ? r.rawText : (r.transcript || '（仅位置上报，待补充描述）');
      var kind = r.inputKind;
      if (r.transcript && r.rawText.indexOf(r.transcript.slice(0, 8)) === -1 && r.rawText.trim()) {
        raw = r.transcript + ' ' + r.rawText;
      }
      state.reviewInput = kind;
      state.review = E.runPipeline({
        rawText: raw, location: r.location, hasPhoto: r.hasPhoto, channel: r.transcript ? 'mixed' : (r.hasPhoto ? 'mixed' : 'text')
      }, state.tickets);
      go('#/rider/ai-review');
    });

    /* ---- 数据用途告知与单独同意（设计演示，不阻断演示流程）---- */
    var open = $('#btnConsentOpen');
    if (open) open.addEventListener('click', function () {
      state.consentModal = true;
      state.consentDraft = { a: false, b: false, c: false };
      render();
    });
    var cancel = $('#btnConsentCancel');
    if (cancel) cancel.addEventListener('click', function () { state.consentModal = false; render(); });
    $$('[data-consent]').forEach(function (el) {
      el.addEventListener('change', function () {
        state.consentDraft[this.getAttribute('data-consent')] = this.checked;
        var d = state.consentDraft;
        var ok = $('#btnConsentOk');
        if (ok) ok.disabled = !(d.a && d.b && d.c);
      });
    });
    var okBtn = $('#btnConsentOk');
    if (okBtn) okBtn.addEventListener('click', function () {
      state.consent = true;
      state.consentModal = false;
      render();
      toast('已确认数据用途与单独同意（演示，不涉及真实数据授权）');
    });
    var mask = $('#consentMask');
    if (mask) mask.addEventListener('click', function (e) {
      if (e.target === mask) { state.consentModal = false; render(); }
    });
    var appeal = $('#btnAppeal');
    if (appeal) appeal.addEventListener('click', function () {
      toast('申诉入口为设计占位，正式上线时需给出受理主体与反馈时限');
    });
  }

  /* -------------------------------------------------- AI 识别与确认页 */

  function viewRiderReview() {
    state.editingDesc = false;
    if (!state.review) {
      state.review = E.runPipeline(D.DEMO_INPUTS.normal, state.tickets);
      state.reviewInput = 'normal';
    }
    var rv = state.review;
    var cat = rv.category, risk = rv.risk, des = rv.desensitized;
    var emergency = risk.level === 'emergency';

    var body =
      (emergency ? emergencyCard(risk) : '') +

      '<div class="note info small" style="margin-bottom:10px">以下全部为 AI 建议，提交前由你确认。你可以修改类别与描述。</div>' +

      '<div class="card tight"><div class="card-head"><h3>① 已脱敏</h3><span class="spacer"></span>' +
      '<span class="badge ai">AI 处理</span></div>' +
      '<div class="diff-text">' + esc(des.text) + '</div>' +
      '<div class="desens">' + (des.removed.length
        ? des.removed.map(function (x) { return '<span class="badge ghost">已脱敏：' + esc(x.label) + '</span>'; }).join('')
        : '<span class="badge ghost">未命中个人敏感信息</span>') + '</div>' +
      '<div class="note small" style="margin-top:6px">' + esc(des.ruleCount > 0
        ? '共命中 ' + des.ruleCount + ' 条脱敏规则：手机号保留前三后二、车牌保留省份简称、精确门牌降到楼栋级'
        : '本段描述未识别出手机号、车牌、身份证、联系方式或精确门牌') + '</div>' +
      '<div class="divider"></div>' +
      (state.editingDesc
        ? '<div class="small" style="font-weight:700;margin-bottom:4px">修改描述</div>' +
        '<textarea class="field" id="descInput" rows="4">' + esc(rv.desensitized.text) + '</textarea>' +
        '<div class="btn-row" style="margin-top:8px"><button class="btn small ghost" id="btnCancelDesc">取消</button>' +
        '<button class="btn small primary" id="btnSaveDesc">保存修改</button></div>' +
        '<div class="note small" style="margin-top:6px">保存后会重新执行脱敏与结构化，并在治理端标记「上报人已修改」。</div>'
        : '<div class="btn-row"><button class="btn small" id="btnEditDesc">修改描述</button>' +
        '<span class="note small">' + (rv.descModified ? '<span class="badge risk-medium">上报人已修改</span>' : 'AI 生成的描述可能有偏差，你可以直接改') + '</span></div>') +
      '</div>' +

      '<div class="card tight"><div class="card-head"><h3>② 结构化要素</h3><span class="spacer"></span>' +
      '<span class="badge ai">AI 处理</span></div>' +
      '<dl class="kv">' +
      '<dt>什么问题</dt><dd>' + esc(rv.structured.what) + '</dd>' +
      '<dt>在哪里</dt><dd>' + esc(rv.structured.where) + '</dd>' +
      '<dt>什么时候</dt><dd>' + esc(rv.structured.when) + '（演示时间）</dd>' +
      '<dt>谁上报</dt><dd>' + esc(rv.structured.who) + '</dd>' +
      '<dt>可能影响</dt><dd>' + rv.structured.impact.map(function (x) { return '<span class="tag">' + esc(x) + '</span>'; }).join(' ') + '</dd>' +
      '<dt>疑似原因</dt><dd>' + rv.structured.suspectedCause.map(function (x) { return '<span class="tag">' + esc(x) + '</span>'; }).join(' ') + '</dd>' +
      '</dl></div>' +

      '<div class="card tight"><div class="card-head"><h3>③ 类别建议</h3><span class="spacer"></span>' +
      '<span class="badge ai">置信度 ' + cat.confidence + '（' + esc(cat.confidenceLabel) + '）</span></div>' +
      '<div class="btn-row">' + D.CATEGORIES.concat([D.FALLBACK_CATEGORY]).map(function (c) {
        return '<button class="chip' + (c.key === cat.key ? ' active' : '') + '" data-cat="' + c.key + '">' + esc(c.name) + '</button>';
      }).join('') + '</div>' +
      '<div class="note small" style="margin-top:6px">依据：' + esc(cat.reason) + '</div>' +
      (cat.secondary && cat.secondary.length
        ? '<div class="note small">次选类别：' + cat.secondary.map(function (s) { return esc(s.name) + '（命中 ' + esc(s.hits.join('、')) + '）'; }).join('；') + '</div>' : '') +
      '</div>' +

      '<div class="card tight"><div class="card-head"><h3>④ 风险等级</h3><span class="spacer"></span>' +
      riskBadge({ riskLevel: risk.level, riskLabel: risk.label }) + '</div>' +
      '<div class="note small">' + esc(risk.reason) + '</div>' +
      (emergency ? '' : '<div class="note small">建议处置时限：' + esc(cat.sla) + '</div>') + '</div>' +

      '<div class="card tight"><div class="card-head"><h3>⑤ 重复检测</h3><span class="spacer"></span>' +
      '<span class="badge ' + (rv.duplicate.hasDuplicate ? 'risk-medium' : 'ghost') + '">' +
      (rv.duplicate.hasDuplicate ? '发现可能重复' : '未发现重复') + '</span></div>' +
      (rv.duplicate.hasDuplicate
        ? '<div class="list-item" style="margin:0"><div class="grow">' +
        '<div class="row1"><span class="title mono">' + esc(rv.duplicate.candidate.id) + '</span>' +
        '<span class="badge ghost">' + esc(rv.duplicate.candidate.createdAt) + '</span>' +
        '<span class="badge ghost">相似度 ' + rv.duplicate.candidate.score + '</span></div>' +
        '<div class="sub">' + esc(rv.duplicate.candidate.summary) + '</div></div></div>'
        : '') +
      '<div class="note small" style="margin-top:6px">' + esc(rv.duplicate.note) + '</div>' +
      '<div class="note small">合并只作为建议：你可以选择合并，也可以继续单独上报，治理端仍会人工判断。</div></div>' +

      '<div class="card tight"><div class="card-head"><h3>⑥ AI 处理管线</h3><span class="spacer"></span>' +
      '<span class="badge ai">规则式演示</span></div>' +
      '<div class="stage-list">' + rv.stages.map(function (s, i) {
        return '<div class="stage"><span class="idx">' + (i + 1) + '</span><span>' + esc(s.name) + '</span>' +
          '<span class="spacer" style="flex:1"></span><span class="detail">' + esc(s.detail) + '</span></div>';
      }).join('') + '</div>' +
      '<div class="note small" style="margin-top:6px">本原型以规则表演示可解释流程，不代表真实模型能力，也未评估准确率。</div></div>' +

      '<div class="card tight"><div class="card-head"><h3>建议分派（AI 建议）</h3></div>' +
      '<dl class="kv"><dt>建议层级</dt><dd>' + esc(rv.dispatch.levelLabel) + '</dd>' +
      '<dt>建议主体</dt><dd>' + esc(rv.dispatch.owner) + '</dd>' +
      '<dt>建议时限</dt><dd>' + esc(rv.dispatch.sla) + '</dd></dl>' +
      '<div class="note small" style="margin-top:6px">' + esc(rv.dispatch.reason) + '</div>' +
      '<div class="note small">最终分派由治理人员人工确认。</div></div>' +

      '<div class="divider"></div>' +
      '<div class="btn-row">' +
      '<button class="btn ghost" data-nav="#/rider/report">返回修改</button>' +
      '<button class="btn ' + (emergency ? 'danger' : 'primary') + '" id="btnSubmit">' +
      (emergency ? '我已联系法定渠道，继续留存线索' : '确认并提交') + '</button>' +
      '</div>' +
      '<div class="note small" style="margin-top:8px">提交即表示你确认以上 AI 识别结果。脱敏在提交前完成，治理人员看到的是脱敏后的描述。</div>' +
      '<div class="note small" style="margin-top:6px">' +
      '<span class="ai-label-badge">AI 生成</span> 本页的上报摘要、类别建议与图像标签由 AI 生成，已在界面显著标注；' +
      '音频转写为预置演示文本、图片为内置演示图，均不涉及真实素材。</div>' +
      appealBox();

    var html = '<div class="shell rider-shell">' + phoneShell(
      '<div><div class="title">AI 识别与确认</div><div class="sub">第 2 步 / 共 3 步 · 请核对后再提交</div></div>' +
      '<span class="spacer"></span>' + (emergency ? '<span class="badge risk-emergency">紧急</span>' : '<span class="badge ghost">AI 建议</span>'),
      body, 'report') + '</div>';

    setTimeout(bindReviewEvents, 0);
    return html;
  }

  function emergencyCard(risk) {
    return '<div class="emergency-card">' +
      '<h3>⚠️ 紧急事件：请立即联系法定应急渠道</h3>' +
      '<div class="note small">判定依据：' + esc(risk.reason) + '</div>' +
      '<div class="warn-line">严重事故、火灾或治安事件请立即拨打下列号码。本平台不替代法定应急渠道，也不会自动处置此类事件。</div>' +
      '<div class="hotline-grid">' +
      hotline('110', '治安、纠纷、可疑人员') +
      hotline('119', '火灾、被困、危险品泄漏') +
      hotline('120', '人员受伤、身体不适') +
      hotline('122', '道路交通事故') +
      '</div>' +
      '<div class="note small">点击下方按钮只是在本平台留存线索，便于后续治理记录，不会自动报警、不会自动拨打、不会自动派单。</div>' +
      '</div>';
  }

  function hotline(num, txt) {
    return '<div class="hotline"><span class="num">' + num + '</span><span class="txt">' + esc(txt) + '</span></div>';
  }

  function bindReviewEvents() {
    $$('[data-cat]').forEach(function (b) {
      b.addEventListener('click', function () {
        var key = this.getAttribute('data-cat');
        var all = D.CATEGORIES.concat([D.FALLBACK_CATEGORY]);
        var c = all.filter(function (x) { return x.key === key; })[0];
        state.review.category = {
          key: c.key, name: c.name, confidence: state.review.category.confidence,
          confidenceLabel: state.review.category.confidenceLabel, level: c.level, sla: c.sla,
          risk: c.risk, reason: '上报人手动修改为「' + c.name + '」', hitKeywords: state.review.category.hitKeywords,
          secondary: state.review.category.secondary
        };
        state.review.risk = E.assessRisk(state.review.desensitized.text, state.review.category);
        state.review.dispatch = E.suggestDispatch(state.review.category, state.review.risk);
        toast('已按上报人选择修改类别（治理端将显示「上报人已修改」）');
        render();
      });
    });

    var submit = $('#btnSubmit');
    if (submit) submit.addEventListener('click', function () {
      var rv = state.review;
      var ids = state.tickets.map(function (t) { return t.id; });
      var input = {
        rawText: rv.rawText,
        channel: state.report.inputKind === 'duplicate' ? 'mixed' : (state.report.hasPhoto ? 'mixed' : 'text'),
        location: state.report.location,
        photoLabel: state.report.photoLabel,
        modifiedByReporter: rv.category.reason.indexOf('上报人手动修改') !== -1 || !!rv.descModified
      };
      var ticket = E.buildTicket(rv, input, ids, 0);
      state.tickets.unshift(ticket);
      state.activeTicketId = ticket.id;
      persist();
      if (ticket.emergency) {
        toast('紧急线索已留存。请确认已联系 110 / 119 / 120 / 122。');
        go('#/rider/emergency-confirm');
      } else {
        toast('已提交工单 ' + ticket.id + '（演示）');
        go('#/rider/progress');
      }
    });

    /* ---- 上报人可修改描述（治理端会显示「上报人已修改」）---- */
    var edit = $('#btnEditDesc');
    if (edit) edit.addEventListener('click', function () {
      state.editingDesc = true; render();
    });
    var cancelEdit = $('#btnCancelDesc');
    if (cancelEdit) cancelEdit.addEventListener('click', function () {
      state.editingDesc = false; render();
    });
    var saveDesc = $('#btnSaveDesc');
    if (saveDesc) saveDesc.addEventListener('click', function () {
      var ta = $('#descInput');
      var v = ta ? ta.value.trim() : '';
      if (!v) { toast('描述不能为空'); return; }
      state.review.rawText = v;
      state.review.desensitized = E.desensitize(v);
      state.review.structured = E.structure(state.review.desensitized.text, {
        location: state.report.location, time: E.DEMO_NOW,
        reporter: D.RIDER_PROFILE.id + ' · ' + D.RIDER_PROFILE.name, hasPhoto: state.report.hasPhoto
      });
      state.review.descModified = true;
      state.editingDesc = false;
      state.report.rawText = v;
      render();
      toast('已保存你修改后的描述（将标记为「上报人已修改」）');
    });
  }

  /* ------------------------------------------------------- 进度与结果页 */

  /* 紧急线索留存确认页（T-15：紧急事件提交后不进入普通工单进度视图） */
  function viewRiderEmergencyConfirm() {
    var t = null;
    for (var i = 0; i < state.tickets.length; i++) {
      if (state.tickets[i].emergency) { t = state.tickets[i]; break; }
    }
    var body =
      '<div class="emergency-card">' +
      '<h3>⚠️ 紧急事件：请以法定应急渠道为准</h3>' +
      '<div class="warn-line">严重事故、火灾或治安事件请立即拨打下列号码。本平台不替代法定应急渠道。</div>' +
      '<div class="hotline-grid">' +
      hotline('110', '治安、纠纷、可疑人员') +
      hotline('119', '火灾、被困、危险品泄漏') +
      hotline('120', '人员受伤、身体不适') +
      hotline('122', '道路交通事故') +
      '</div>' +
      '<div class="note small">平台不会自动报警、不会自动拨打、不会自动派单，也不会对此类事件作出处置决定。</div>' +
      '</div>' +

      '<div class="card tight"><div class="card-head"><h3>平台留存记录</h3><span class="spacer"></span>' +
      (t ? statusBadge(t) : '<span class="badge ghost">无紧急线索</span>') + '</div>' +
      (t
        ? '<dl class="kv">' +
        '<dt>工单号</dt><dd class="mono">' + esc(t.id) + '</dd>' +
        '<dt>类别</dt><dd>' + esc(t.categoryName) + ' <span class="badge ghost">AI 建议</span></dd>' +
        '<dt>风险</dt><dd>' + esc(t.riskLabel) + '</dd>' +
        '<dt>位置</dt><dd>' + esc(locLabel(t.location)) + '</dd>' +
        '<dt>脱敏描述</dt><dd>' + esc(t.desensitized ? t.desensitized.text : t.rawText) + '</dd>' +
        '</dl>' +
        '<div class="note small" style="margin-top:8px">该线索不进入普通分派与办结流程，仅用于治理记录与后续分析；' +
        '如需更正或删除，可在申诉入口提出。</div>'
        : '<div class="note small">当前没有紧急级别的线索。</div>') +
      '</div>' +

      '<div class="note info small">为什么单独一页：紧急事件与普通城市问题事项的处理路径不同。' +
      '普通事项走「AI 建议 → 人工确认 → 处置反馈」，紧急事件只提示法定渠道并留存线索。</div>' +

      '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn ghost" data-nav="#/rider/home">返回首页</button>' +
      '<button class="btn" data-nav="#/rider/progress">查看我的其他上报</button>' +
      '</div>';

    return '<div class="shell rider-shell">' + phoneShell(
      '<div><div class="title">紧急事件 · 已留存线索</div><div class="sub">不进入普通工单流程</div></div>' +
      '<span class="spacer"></span><span class="badge risk-emergency">紧急</span>',
      body, 'report') + '</div>';
  }

  function viewRiderProgress() {
    var mine = state.tickets.filter(function (t) { return t.reporter.indexOf(D.RIDER_PROFILE.id) === 0; });
    var all = state.tickets;
    var list = mine.length ? mine : all;
    var active = state.route.params.id || state.query.ticket ? ticketById(state.route.params.id || state.query.ticket) : null;

    var body =
      '<div class="note info small" style="margin-bottom:10px">S2 透明反馈机制：上报人可以看到责任主体、处理进度和处置结果。</div>' +
      list.map(function (t) {
        return '<button class="list-item' + (active && t.id === active.id ? ' active' : '') + '" data-ticket="' + esc(t.id) + '">' +
          '<div class="grow"><div class="row1">' + riskBadge(t) + statusBadge(t) + '</div>' +
          '<div class="title">' + esc(t.categoryName || '待分类') + '</div>' +
          '<div class="sub">' + esc(E.shorten(t.desensitized ? t.desensitized.text : t.rawText, 26)) + '</div>' +
          '<div class="sub mono">' + esc(t.id) + '</div></div>' +
          '<div class="right">' + esc(t.createdAt.slice(5, 16)) + '</div></button>';
      }).join('') +

      (active ? ticketDetail(active) : '<div class="note">暂无工单</div>');

    var html = '<div class="shell rider-shell">' + phoneShell(
      '<div><div class="title">处理进度与结果</div><div class="sub">第 3 步 / 共 3 步</div></div>' +
      '<span class="spacer"></span><span class="badge ghost">' + list.length + ' 条</span>',
      body, 'progress') + '</div>';

    setTimeout(function () {
      $$('[data-ticket]').forEach(function (b) {
        b.addEventListener('click', function () {
          state.activeTicketId = this.getAttribute('data-ticket');
          render();
        });
      });
    }, 0);
    return html;
  }

  function ticketDetail(t) {
    var owner = t.decision && t.decision.owner ? t.decision.owner : (t.suggestedDispatch ? t.suggestedDispatch.owner + '（AI 建议，待人工确认）' : '待人工确认');
    return '<div class="card tight" style="margin-top:12px">' +
      '<div class="card-head"><h3>工单 ' + esc(t.id) + '</h3><span class="spacer"></span>' + statusBadge(t) + riskBadge(t) + '</div>' +
      (t.emergency ? '<div class="note danger small">紧急事件：请以 110 / 119 / 120 / 122 为准，本平台仅留存线索。</div>' : '') +
      '<dl class="kv">' +
      '<dt>责任主体</dt><dd>' + esc(owner) + '</dd>' +
      '<dt>类别</dt><dd>' + esc(t.categoryName || '待分类') + ' <span class="badge ghost">AI 建议</span>' +
      (t.modifiedByReporter ? ' <span class="badge risk-medium">上报人已修改</span>' : '') + '</dd>' +
      '<dt>位置</dt><dd>' + esc(locLabel(t.location)) + '</dd>' +
      '<dt>描述</dt><dd>' + esc(t.desensitized ? t.desensitized.text : t.rawText) + '</dd>' +
      (t.duplicateOf ? '<dt>重复合并</dt><dd>与 ' + esc(t.duplicateOf) + ' 建议合并（' + esc(t.duplicateNote || '') + '）</dd>' : '') +
      '</dl>' +
      '<div class="divider"></div>' +
      '<div class="sec-title" style="margin:0 0 8px">处理时间轴</div>' +
      '<div class="timeline">' + t.timeline.map(function (x) {
        return '<div class="tl-item k-' + esc(x.kind) + '"><span class="at">' + esc(x.at) + '</span>' +
          '<span class="actor">' + esc(x.actor) + '</span>' +
          '<div class="txt">' + esc(x.text) + '</div></div>';
      }).join('') + '</div>' +
      (t.resolution
        ? '<div class="card human tight" style="margin:10px 0 0"><div class="card-head"><h3>处置结果反馈</h3></div>' +
        '<div class="small">' + esc(t.resolution.text) + '</div>' +
        '<div class="note small" style="margin-top:6px">处置主体：' + esc(t.resolution.owner || '') + ' · 反馈时间：' + esc(t.resolution.at) + '</div>' +
        '<div class="note small">激励机制（S3 · 演示数值）：+' + t.resolution.points + ' 积分 → 可兑换驿站权益与托管优先权</div></div>'
        : '<div class="note small" style="margin-top:10px">尚未办结。办结后你会在这里看到处置结果与积分变化。</div>') +
      '</div>';
  }

  function locLabel(id) {
    var p = D.LOCATION_PRESETS.filter(function (x) { return x.id === id; })[0];
    return p ? p.label : (id || '未提供');
  }

  /* --------------------------------------------------------------- 服务页 */

  function viewRiderServices() {
    var body =
      '<div class="note info small" style="margin-bottom:10px">以下服务点与权益为演示数据，不代表真实驿站或真实权益。</div>' +
      D.SERVICE_POINTS.map(function (sp) {
        return '<div class="card tight"><div class="card-head"><h3>' + esc(sp.name) + '</h3>' +
          '<span class="spacer"></span><span class="badge ghost">' + esc(sp.type) + '</span></div>' +
          '<div class="note small">距离 ' + esc(sp.distance) + ' · ' + esc(sp.openHours) + '</div>' +
          '<div class="btn-row" style="margin-top:6px">' + sp.services.map(function (s) {
            return '<span class="tag">' + esc(s) + '</span>';
          }).join('') + '</div>' +
          '<div class="note small" style="margin-top:6px">' + esc(sp.note) + '</div></div>';
      }).join('') +

      '<div class="card tight"><div class="card-head"><h3>激励机制（演示）</h3><span class="spacer"></span>' +
      '<span class="badge ghost">当前 ' + D.RIDER_PROFILE.points + ' 积分</span></div>' +
      '<table class="tbl"><thead><tr><th>规则</th><th>条件</th><th class="num">积分</th><th>权益</th></tr></thead><tbody>' +
      D.INCENTIVES.map(function (i) {
        return '<tr><td>' + esc(i.name) + '</td><td class="small">' + esc(i.condition) + '</td>' +
          '<td class="num">' + (i.points > 0 ? '+' : '') + i.points + '</td><td class="small">' + esc(i.benefit) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<div class="note small" style="margin-top:8px">激励为服务型权益（驿站服务、托管优先权），不涉及现金，也不影响商业平台派单。</div></div>' +

      '<div class="card tight"><div class="card-head"><h3>服务查询边界</h3></div>' +
      '<div class="note small">本页只展示社区末端服务信息与演示权益，不含真实城市级导航、不提供路线规划，也不代表任何真实驿站或政府服务承诺。</div></div>';

    return '<div class="shell rider-shell">' + phoneShell(
      '<div><div class="title">服务查询</div><div class="sub">社区末端服务与演示激励</div></div>' +
      '<span class="spacer"></span><span class="badge ghost">演示数据</span>',
      body, 'services') + '</div>';
  }

  /* ============================================================== 治理端视图 */

  function govHeader(title, desc, right) {
    return '<div class="page-head"><div><h2>' + esc(title) + '</h2><div class="desc">' + desc + '</div></div>' +
      '<span class="spacer"></span>' + (right || '') + '</div>';
  }

  function viewGovEvents() {
    var f = state.filters;
    var list = state.tickets.filter(function (t) {
      if (f.risk !== 'all' && t.riskLevel !== f.risk) return false;
      if (f.status !== 'all') {
        if (f.status === 'open' && ['resolved', 'transferred'].indexOf(t.status) !== -1) return false;
        if (f.status === 'resolved' && t.status !== 'resolved') return false;
        if (f.status === 'emergency' && !t.emergency) return false;
      }
      return true;
    });
    var active = state.route.params.id ? ticketById(state.route.params.id) : null;
    if (active && list.indexOf(active) === -1) active = null;

    var m = E.computeMetrics(state.tickets);
    var headerRight = '<div class="btn-row">' +
      '<a class="btn small" href="#/gov/map">地图视图</a>' +
      '<a class="btn small" href="#/gov/metrics">核心指标</a>' +
      '<a class="btn small primary" href="#/sim/compare">仿真对比</a></div>';

    var html =
      '<div class="shell">' +
      govHeader('治理端 · 事件列表', 'AI 建议与人工决定分列显示；每一条 AI 输出都必须经治理人员确认。', headerRight) +
      '<div class="note info small" style="margin-bottom:12px">当前为原型演示环境，事件数据全部虚构或脱敏。严重事故、火灾或治安事件在列表中单独提示应急渠道。</div>' +

      '<div class="cols c2">' +
      '<div>' +
      '<div class="filter-bar">' +
      chip('risk', 'all', '全部风险') + chip('risk', 'emergency', '紧急') + chip('risk', 'high', '高风险') +
      chip('risk', 'medium', '中风险') + chip('risk', 'low', '低风险') +
      '<span style="width:10px"></span>' +
      chip('status', 'all', '全部状态') + chip('status', 'open', '未办结') +
      chip('status', 'resolved', '已办结') + chip('status', 'emergency', '紧急事件') +
      '<span class="spacer" style="flex:1"></span>' +
      '<span class="note small">共 ' + list.length + ' 条 / 全部 ' + state.tickets.length + ' 条</span>' +
      '</div>' +

      '<div class="metric-grid" style="margin-bottom:12px">' +
      metricCard('未办结工单', String(m.pendingCount), '条', '演示口径', '') +
      metricCard('已办结', String(m.closedCount), '条', '演示口径', 'up') +
      metricCard('重复或无效率', m.duplicateOrInvalidRate + '%', '', '演示口径 · 基于示例工单', 'down') +
      '</div>' +

      list.map(function (t) {
        var preview = t.desensitized ? t.desensitized.text : t.rawText;
        return '<div class="gov-list-item' + (active && t.id === active.id ? ' active' : '') + '" data-ticket="' + esc(t.id) + '">' +
          '<div><div class="id">' + esc(t.id) + '</div><div class="note small">' + esc(t.createdAt.slice(5, 16)) + '</div></div>' +
          '<div><div class="summary">' + esc(t.categoryName || '待分类') + ' · ' + esc(E.shorten(preview, 26)) + '</div>' +
          '<div class="meta">' + esc(locLabel(t.location)) + ' · 上报人 ' + esc(t.reporter) +
          (t.duplicateOf ? ' · <span class="badge risk-medium">与 ' + esc(t.duplicateOf) + ' 疑似重复</span>' : '') +
          (t.modifiedByReporter ? ' · <span class="badge ghost">上报人已修改类别</span>' : '') + '</div></div>' +
          '<div><span class="badge ai">AI 置信度 ' + esc(t.categoryConfidence || '—') + '</span></div>' +
          '<div class="btn-row">' + riskBadge(t) + statusBadge(t) + '</div>' +
          '</div>';
      }).join('') +
      '</div>' +

      '<div>' + (active ? govDetail(active) : govEmptyState(list.length)) + '</div>' +
      '</div></div>';

    setTimeout(bindGovEvents, 0);
    return html;
  }

  function chip(group, value, label) {
    var active = state.filters[group] === value;
    return '<button class="chip' + (active ? ' active' : '') + '" data-filter="' + group + '" data-value="' + value + '">' + esc(label) + '</button>';
  }

  function metricCard(name, val, unit, note, cls) {
    return '<div class="metric ' + (cls || '') + '"><div class="name">' + esc(name) + '</div>' +
      '<div class="val">' + esc(val) + ' <span class="unit">' + esc(unit) + '</span></div>' +
      '<div class="note">' + esc(note) + '</div></div>';
  }

  function govDetail(t) {
    return '' +
      '<div class="card">' +
      '<div class="card-head"><h3>' + esc(t.categoryName || '待分类') + '</h3>' +
      '<span class="spacer"></span>' + riskBadge(t) + statusBadge(t) + '</div>' +
      '<div class="note small mono">' + esc(t.id) + ' · ' + esc(t.createdAt) + ' · 渠道 ' + esc(channelZh(t.channel)) + ' · 上报人 ' + esc(t.reporter) + '</div>' +
      (t.emergency ? '<div class="note danger small" style="margin-top:8px">⚠️ 紧急事件：本工单不进入普通自动建议流程，请以 110 / 119 / 120 / 122 为准。平台仅留存线索、不做处置。</div>' : '') +
      '<div class="divider"></div>' +
      '<div class="small"><b>脱敏后描述</b><br>' + esc(t.desensitized ? t.desensitized.text : t.rawText) + '</div>' +
      '<div class="note small" style="margin-top:6px">原始描述仅用于演示脱敏效果，含虚构的号码信息，治理端展示的是脱敏版本。</div>' +
      '<div class="divider"></div>' +
      mapSvg(320, [t], { small: true }) +
      '</div>' +

      '<div class="card ai">' +
      '<div class="card-head"><h3>AI 建议</h3><span class="spacer"></span>' +
      '<span class="badge ai">AI 建议，需人工确认</span></div>' +
      '<dl class="kv">' +
      '<dt>摘要</dt><dd>' + esc(t.structured ? t.structured.what : E.shorten(t.rawText, 40)) + '</dd>' +
      '<dt>类别</dt><dd>' + esc(t.categoryName) + '（置信度 ' + esc(t.categoryConfidence) + '，' + esc(t.categoryConfidenceLabel || '') + '）</dd>' +
      '<dt>类别依据</dt><dd>' + esc(t.categoryReason || '—') + '</dd>' +
      '<dt>风险</dt><dd>' + esc(t.riskLabel) + ' · ' + esc(t.riskReason || '') + '</dd>' +
      '<dt>重复提示</dt><dd>' + (t.duplicateOf
        ? '与 <span class="mono">' + esc(t.duplicateOf) + '</span> 疑似重复 · ' + esc(t.duplicateNote || '')
        : esc(t.duplicateNote || '未发现重复')) + '</dd>' +
      '<dt>建议分派</dt><dd>' + esc(t.suggestedDispatch ? t.suggestedDispatch.owner : '—') +
      '（' + esc(t.suggestedDispatch ? t.suggestedDispatch.levelLabel : '') + '，时限 ' + esc(t.suggestedDispatch ? t.suggestedDispatch.sla : '—') + '）</dd>' +
      '<dt>建议依据</dt><dd>' + esc(t.suggestedDispatch ? t.suggestedDispatch.reason : '—') + '</dd>' +
      '</dl>' +
      '<div class="note small" style="margin-top:8px">模型输出不构成行政决定。请在下方的「人工决定」区完成确认。</div>' +
      '</div>' +

      decisionCard(t) +

      (t.resolution ? resolutionCard(t) : '') +

      '<div class="card"><div class="card-head"><h3>处理时间轴</h3><span class="spacer"></span>' +
      '<span class="note small">人工节点与系统反馈节点分色显示</span></div>' +
      '<div class="timeline">' + t.timeline.map(function (x) {
        return '<div class="tl-item k-' + esc(x.kind) + '"><span class="at">' + esc(x.at) + '</span>' +
          '<span class="actor">' + esc(x.actor) + '</span><div class="txt">' + esc(x.text) + '</div></div>';
      }).join('') + '</div></div>';
  }

  function channelZh(ch) { return E.channelLabel(ch); }

  function decisionCard(t) {
    if (t.resolution) {
      return '<div class="card human"><div class="card-head"><h3>人工决定</h3><span class="spacer"></span>' +
        '<span class="badge ghost">已办结</span></div>' +
        '<div class="note small">该工单已人工确认办结，处置结果已反馈上报人。</div></div>';
    }
    var decided = !!t.decision;
    var ownerOpts = function (sel) {
      return '<option value="">请选择处置主体…</option>' + D.OWNERS.map(function (o) {
        return '<option value="' + esc(o.name) + '"' + (sel === o.name ? ' selected' : '') + '>' + esc(o.name) + '</option>';
      }).join('');
    };
    var suggestedOwner = t.suggestedDispatch ? t.suggestedDispatch.owner : '';

    return '<div class="card human">' +
      '<div class="card-head"><h3>人工决定</h3><span class="spacer"></span>' +
      '<span class="badge ghost">必须由治理人员操作</span></div>' +
      (decided ? '<div class="note small">当前决定：' + esc(decisionLabel(t.decision)) + '（' + esc(t.decision.decidedAt) + '）</div><div class="divider"></div>' : '') +
      (t.emergency
        ? '<div class="note danger small" style="margin-bottom:8px">该事件为紧急级别。请先确认已通过 110 / 119 / 120 / 122 处置，再在平台留存记录。</div>'
        : '') +
      '<div class="cols c2-even">' +
      '<div>' +
      '<div class="small" style="font-weight:700;margin-bottom:4px">确认并分派</div>' +
      '<select class="field" id="ownerSelect">' + ownerOpts(decided && t.decision.action === 'dispatch' ? t.decision.owner : suggestedOwner) + '</select>' +
      '<div class="note small" style="margin:4px 0 6px">默认选中 AI 建议的处置主体，可人工更改。AI 建议不会自动生效。</div>' +
      '<input class="field" id="dispatchNote" placeholder="处置要求备注（可选）" value="' + esc(decided && t.decision.action === 'dispatch' ? t.decision.note : '') + '">' +
      '<div style="height:8px"></div>' +
      '<button class="btn ok wide" data-decision="dispatch">确认并分派（人工）</button>' +
      '</div>' +
      '<div>' +
      '<div class="small" style="font-weight:700;margin-bottom:4px">退回上报人补充</div>' +
      '<input class="field" id="needInfoNote" placeholder="需要补充的信息，例如时间段、影响范围" value="' + esc(decided && t.decision.action === 'need_info' ? t.decision.note : '') + '">' +
      '<div style="height:8px"></div>' +
      '<button class="btn wide" data-decision="need_info">退回补充</button>' +
      '<div style="height:10px"></div>' +
      '<div class="small" style="font-weight:700;margin-bottom:4px">转交其他主体</div>' +
      '<select class="field" id="transferSelect">' + ownerOpts(decided && t.decision.action === 'transfer' ? t.decision.owner : '') + '</select>' +
      '<div style="height:8px"></div>' +
      '<button class="btn wide" data-decision="transfer">转交</button>' +
      '</div>' +
      '</div>' +

      '<div class="divider"></div>' +
      '<div class="small" style="font-weight:700;margin-bottom:6px">处置结果录入并反馈上报人（S2 / S3）</div>' +
      '<textarea class="field" id="resolutionText" rows="2" placeholder="例如：现场已规范摆放，盲道恢复通行，已与运营方约定每日巡查。">' + esc(t.resolutionPreview || '') + '</textarea>' +
      '<div class="btn-row" style="margin-top:8px">' +
      '<button class="btn primary" data-decision="resolve">确认办结并反馈</button>' +
      '<span class="note small">办结后系统会向骑手端推送结果，并按演示规则计入积分。</span>' +
      '</div>' +
      '</div>';
  }

  function decisionLabel(d) {
    return ({ dispatch: '确认并分派给 ' + d.owner, need_info: '退回补充：' + d.note, transfer: '转交给 ' + d.owner })[d.action] || d.action;
  }

  function resolutionCard(t) {
    return '<div class="card human"><div class="card-head"><h3>处置结果</h3><span class="spacer"></span>' +
      '<span class="badge status done">已办结</span></div>' +
      '<div class="small">' + esc(t.resolution.text) + '</div>' +
      '<div class="note small" style="margin-top:6px">处置主体：' + esc(t.resolution.owner || '') + ' · 反馈时间：' + esc(t.resolution.at) +
      ' · 计入积分 ' + t.resolution.points + '（演示）</div></div>';
  }

  function govEmptyState(count) {
    return '<div class="card placeholder-card">' +
      '<div class="card-head"><h3>事件详情</h3><span class="spacer"></span>' +
      '<span class="badge ghost">未选中事件</span></div>' +
      '<div class="small">左侧共 ' + count + ' 条演示工单。点击任意一条即可查看该事件的：</div>' +
      '<ul class="small" style="margin:8px 0 0">' +
      '<li>AI 建议卡（摘要、类别、风险、重复提示、建议处置主体）</li>' +
      '<li>人工决定区（确认分派 / 退回补充 / 转交）</li>' +
      '<li>处置结果录入与上报人反馈</li>' +
      '<li>处理时间轴（人工节点与系统反馈节点分色）</li>' +
      '</ul>' +
      '<div class="note small" style="margin-top:10px">AI 输出仅为建议，任何分派都必须由治理人员人工确认。</div>' +
      '<div class="note small">严重事故、火灾或治安事件不进入普通处置流程，系统只提示转接 110 / 119 / 120 / 122。</div>' +
      '</div>';
  }

  function bindGovEvents() {
    $$('[data-filter]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.filters[this.getAttribute('data-filter')] = this.getAttribute('data-value');
        render();
      });
    });
    $$('[data-ticket]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.activeTicketId = this.getAttribute('data-ticket');
        go('#/gov/events/' + state.activeTicketId);
      });
    });
    $$('[data-decision]').forEach(function (b) {
      b.addEventListener('click', function () {
        var action = this.getAttribute('data-decision');
        var t = ticketById(state.activeTicketId);
        if (!t) return;

        if (action === 'dispatch') {
          var owner = ($('#ownerSelect') || {}).value || '';
          if (!owner) { toast('请先选择处置主体：确认分派必须由人工指定'); return; }
          var note = ($('#dispatchNote') || {}).value || '';
          updateTicket(E.applyDecision(t, { action: 'dispatch', owner: owner, note: note }));
          toast('已人工确认并分派给 ' + owner + '（处置中）');
        } else if (action === 'need_info') {
          var n = ($('#needInfoNote') || {}).value || '请补充现场时间段与影响范围';
          updateTicket(E.applyDecision(t, { action: 'need_info', note: n }));
          toast('已退回上报人补充信息');
        } else if (action === 'transfer') {
          var to = ($('#transferSelect') || {}).value || '';
          if (!to) { toast('请先选择转交对象'); return; }
          updateTicket(E.applyDecision(t, { action: 'transfer', owner: to, note: '转交处理' }));
          toast('已转交给 ' + to);
        } else if (action === 'resolve') {
          var text = ($('#resolutionText') || {}).value || '';
          if (!text.trim()) { toast('请填写处置结果后再办结'); return; }
          updateTicket(E.applyResolution(t, { text: text.trim(), points: 10 }));
          toast('已办结并反馈上报人，积分 +10（演示）');
        }
      });
    });
  }

  function updateTicket(updated) {
    for (var i = 0; i < state.tickets.length; i++) {
      if (state.tickets[i].id === updated.id) { state.tickets[i] = updated; break; }
    }
    persist();
    render();
  }

  /* ------------------------------------------------------------- 地图视图 */

  function viewGovMap() {
    var clusters = {};
    state.tickets.forEach(function (t) {
      var k = t.location || 'NA';
      if (!clusters[k]) clusters[k] = [];
      clusters[k].push(t);
    });

    var markers = Object.keys(clusters).map(function (k) {
      var items = clusters[k];
      var preset = D.LOCATION_PRESETS.filter(function (p) { return p.id === k; })[0];
      if (!preset) return '';
      var worst = items.reduce(function (acc, t) {
        var order = { low: 0, medium: 1, high: 2, emergency: 3 };
        return order[t.riskLevel] > order[acc] ? t.riskLevel : acc;
      }, 'low');
      var isCluster = items.length > 1;
      var size = isCluster ? 36 : 28;
      return '<div class="map-pin' + (isCluster ? ' cluster' : ' risk-' + worst) + '" style="left:' + preset.x + '%;top:' + preset.y + '%;width:' + size + 'px;height:' + size + 'px" ' +
        'data-loc="' + esc(k) + '" title="' + esc(preset.label) + '">' + (isCluster ? items.length : '1') + '</div>' +
        '<div class="map-label" style="left:' + preset.x + '%;top:' + preset.y + '%">' + esc(k) + (isCluster ? ' · ' + items.length + ' 条（含重复聚合）' : ' · 1 条') + '</div>';
    }).join('');

    var selected = state.activeTicketId ? ticketById(state.activeTicketId) : null;

    var html = '<div class="shell">' +
      govHeader('治理端 · 事件地图', '示意底图 + 虚构网格，不代表真实行政区划；同一网格的多条事件聚合显示。',
        '<div class="btn-row"><a class="btn small" href="#/gov/events">列表视图</a>' +
        '<a class="btn small" href="#/gov/metrics">核心指标</a></div>') +
      '<div class="note warn small" style="margin-bottom:12px">地图为程序绘制的示意底图，网格编号为虚构编号；本原型不使用未经审核的小区地图，也不提供导航与路径规划。</div>' +
      '<div class="cols c2">' +
      '<div class="map-wrap">' + mapSvg(0, state.tickets, { markers: markers }) +
      '<div class="legend" style="padding:8px 12px;border-top:1px solid var(--border);background:#fff">' +
      legendItem('#1f9d6b', '低风险') + legendItem('var(--warn)', '中风险') + legendItem('#e07b16', '高风险') +
      legendItem('var(--danger)', '紧急') + legendItem('#3b4250', '聚合（同网格多条）') +
      '</div></div>' +
      '<div>' +
      '<div class="card tight"><div class="card-head"><h3>网格聚合明细</h3><span class="spacer"></span>' +
      '<span class="badge ghost">' + Object.keys(clusters).length + ' 个网格</span></div>' +
      Object.keys(clusters).map(function (k) {
        var items = clusters[k];
        return '<div class="note small" style="margin-bottom:6px"><b class="mono">' + esc(k) + '</b> ' + esc(locLabel(k)) +
          '<br>' + items.length + ' 条：' + items.map(function (t) {
            return '<span class="badge ghost">' + esc(t.categoryName) + '</span>';
          }).join(' ') + '</div>';
      }).join('') +
      '<div class="note small">同网格内同类事件在治理端以聚合标记显示，便于识别重复上报；是否合并仍由人工决定。</div>' +
      '</div>' +
      (selected ? '<div class="card tight"><div class="card-head"><h3>选中事件</h3><span class="spacer"></span>' +
        riskBadge(selected) + statusBadge(selected) + '</div>' +
        '<div class="small">' + esc(E.shorten(selected.desensitized ? selected.desensitized.text : selected.rawText, 50)) + '</div>' +
        '<div class="note small mono">' + esc(selected.id) + ' · ' + esc(locLabel(selected.location)) + '</div>' +
        '<div class="btn-row" style="margin-top:8px"><a class="btn small" href="#/gov/events/' + esc(selected.id) + '">打开详情</a></div></div>'
        : '<div class="card tight"><div class="note small">点击地图标记或从事件列表进入详情。</div></div>') +
      '</div></div></div>';

    setTimeout(function () {
      $$('[data-loc]').forEach(function (el) {
        el.addEventListener('click', function () {
          var loc = this.getAttribute('data-loc');
          var t = state.tickets.filter(function (x) { return x.location === loc; })[0];
          if (t) { state.activeTicketId = t.id; render(); }
        });
      });
    }, 0);
    return html;
  }

  function legendItem(color, label) {
    return '<span class="item"><span class="sw" style="background:' + color + '"></span>' + esc(label) + '</span>';
  }

  /* ----------------------------------------------------- 示意底图（程序绘制） */

  function mapSvg(width, tickets, opts) {
    opts = opts || {};
    var w = width || 900;
    var h = Math.round(w * 0.62);
    var bg = '' +
      '<rect width="100%" height="100%" fill="#f4f6f8"/>' +
      '<rect x="0" y="0" width="100%" height="26%" fill="#e9eef3"/>' +
      '<rect x="0" y="26%" width="100%" height="5" fill="#c6cfd8"/>' +
      '<rect x="0" y="66%" width="100%" height="68" rx="6" fill="#dfe4e9"/>' +
      '<rect x="0" y="31%" width="100%" height="6" fill="#cdd3da"/>' +
      '<rect x="6%" y="0" width="5%" height="100%" fill="#dde2e7"/>' +
      '<rect x="38%" y="0" width="7%" height="100%" fill="#dde2e7"/>' +
      '<rect x="72%" y="0" width="5%" height="100%" fill="#dde2e7"/>' +
      '<rect x="14%" y="26%" width="12%" height="18%" fill="#e6ebf0" stroke="#d3d9df"/>' +
      '<rect x="50%" y="26%" width="14%" height="16%" fill="#e6ebf0" stroke="#d3d9df"/>' +
      '<rect x="80%" y="26%" width="12%" height="20%" fill="#e6ebf0" stroke="#d3d9df"/>' +
      '<rect x="18%" y="52%" width="16%" height="14%" fill="#e6ebf0" stroke="#d3d9df"/>' +
      '<rect x="86%" y="52%" width="10%" height="12%" fill="#e6ebf0" stroke="#d3d9df"/>' +
      '<rect x="0" y="66%" width="100%" height="8" fill="#cfd6dc"/>' +
      '<text x="3" y="7" font-size="2.1" fill="#8b939c" font-family="sans-serif">示意底图 · 非真实行政区划</text>' +
      '<text x="55" y="12" font-size="2.1" fill="#8b939c" font-family="sans-serif">玉兰河（示意）</text>';

    var gridLines = '';
    for (var i = 1; i <= 8; i++) {
      if (i % 2 === 0) continue;
      var gx = 4 + (i - 1) * 11.5;
      var gy = 6 + (i - 1) * 10.6;
      gridLines += '<rect x="' + gx + '%" y="' + gy + '%" width="9%" height="8%" rx="1" fill="none" stroke="#b9c0c8" stroke-dasharray="1.2 0.9"/>' +
        '<text x="' + (gx + 0.7) + '%" y="' + (gy + 4.4) + '%" font-size="1.9" fill="#98a0a8" font-family="monospace">G-0' + i + '</text>';
    }

    var markerSvg = '';
    if (opts.small && tickets && tickets.length) {
      tickets.forEach(function (t) {
        var preset = D.LOCATION_PRESETS.filter(function (p) { return p.id === t.location; })[0];
        if (!preset) return;
        var color = { low: '#1f9d6b', medium: '#d98a1f', high: '#e07b16', emergency: '#d3453f' }[t.riskLevel];
        markerSvg += '<circle cx="' + preset.x + '%" cy="' + preset.y + '%" r="3.4" fill="' + color + '" stroke="#fff" stroke-width="0.7"/>' +
          '<text x="' + preset.x + '%" y="' + (preset.y + 1.1) + '%" font-size="2.4" fill="#fff" text-anchor="middle" font-family="monospace">' + esc(t.location) + '</text>';
      });
    }

    var htmlMarkers = opts.markers || '';

    if (opts.small) {
      return '<div class="map-wrap" style="margin-top:6px;position:relative;padding-bottom:62%">' +
        '<svg class="map-base" viewBox="0 0 100 62" preserveAspectRatio="xMidYMid meet" style="position:absolute;left:0;top:0;width:100%;height:100%;display:block">' +
        bg + gridLines + markerSvg + '</svg>' + htmlMarkers + '</div>';
    }

    return '<div class="map-wrap" style="position:relative;padding-bottom:62%">' +
      '<svg class="map-base" viewBox="0 0 100 62" preserveAspectRatio="xMidYMid meet" style="position:absolute;left:0;top:0;width:100%;height:100%;display:block">' +
      bg + gridLines + '</svg>' + htmlMarkers + '</div>';
  }

  /* --------------------------------------------------------- 指标概览视图 */

  function viewGovMetrics() {
    var m = E.computeMetrics(state.tickets);
    var sim = D.SIM_RESULTS;

    var demoMetrics =
      metricCard('有效上报率', m.effectiveReportRate + '%', '', '演示口径：(总上报 − 疑似重复) / 总上报，基于 ' + m.total + ' 条示例工单', 'up') +
      metricCard('重复或无效上报率', m.duplicateOrInvalidRate + '%', '', '演示口径：疑似重复工单占比（本口径未含无效上报）', 'down') +
      metricCard('工单分派准确率', (m.dispatchAccuracy === null ? '—' : m.dispatchAccuracy + '%'), '', '演示口径：已分派工单中未被退回的比例；样本仅 ' + m.total + ' 条，不具统计意义', 'up') +
      metricCard('平均处置时间', (m.avgHandlingHours === null ? '—' : m.avgHandlingHours), '小时', '演示口径：示例工单上报到办结的平均时长', 'down') +
      metricCard('平均上报耗时', '—', '分钟', '不在此处计算：由仿真侧给出，见右栏与仿真端（第一轮为 3.00 分钟）', '') +
      metricCard('群体参与差距', '—', '百分点', '不在此处计算：由仿真侧按骑手与司机两类给出', '');

    var groups = sim.groups.map(function (g) {
      return '<tr><td>' + esc(g.name) + '</td>' +
        SIM_KEYS.map(function (k) { return '<td class="num">' + num(g.values[k]) + '%</td>'; }).join('') + '</tr>';
    }).join('');

    return '<div class="shell">' +
      govHeader('治理端 · 核心指标概览', '区分「原型演示口径」与「仿真实验口径」两类指标：前者用于演示指标如何计算，后者才是实验证据。',
        '<div class="btn-row"><a class="btn small" href="#/gov/events">事件列表</a>' +
        '<a class="btn small" href="#/gov/map">地图视图</a>' +
        '<a class="btn small primary" href="#/sim/compare">仿真对比</a></div>') +

      '<div class="card"><div class="card-head"><h3>① 原型演示口径</h3><span class="spacer"></span>' +
      '<span class="badge ghost">基于原型内置示例工单</span></div>' +
      '<div class="note small" style="margin-bottom:10px">' + esc(m.scope) + '。这些数字随你在原型中的操作实时变化，用于说明指标如何被计算，<b>不代表真实城市治理统计，也不代表仿真结果</b>。</div>' +
      '<div class="metric-grid">' + demoMetrics + '</div>' +
      '<div class="note small" style="margin-top:8px">说明：原型的示例工单只有 ' + m.total + ' 条，分派准确率等比例指标容易得到失真的极端值，因此报告与视频不引用这些数值，只引用其口径。</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-head"><h3>② 仿真实验口径（第一轮结果）</h3><span class="spacer"></span>' +
      '<span class="badge ghost">' + esc(sim.dataSource) + '</span></div>' +
      '<div class="result-banner"><span class="mono">' + esc(sim.round) + '</span>' +
      '<span>以下为第一轮合成仿真结果（每情景 20 次重复）。在当前项目假设下得出，不是现实统计或政策效果证明。</span></div>' +
      simMetricTable(sim, '六项固定指标 · 情景对比（含 95% 区间）') +
      simLegend(sim) +
      '<div class="divider"></div>' +
      '<div class="small" style="font-weight:700;margin-bottom:6px">分群体参与率</div>' +
      '<table class="tbl"><thead><tr><th>群体</th><th class="num">S0</th><th class="num">S1</th><th class="num">S2</th><th class="num">S3</th></tr></thead>' +
      '<tbody>' + groups + '</tbody></table>' +
      '<div class="note small" style="margin-top:6px">' + esc(sim.groupNote) + '</div>' +
      '<div class="note warn small" style="margin-top:6px">' + esc(sim.groupCaveat) + '</div>' +
      '<div class="btn-row" style="margin-top:10px"><a class="btn small" href="#/sim/compare">查看完整仿真对比页 ›</a></div>' +
      '</div>' +

      '<div class="card"><div class="card-head"><h3>指标口径说明</h3></div>' +
      '<table class="tbl"><thead><tr><th>指标</th><th>单位</th><th>方向</th><th>口径</th></tr></thead><tbody>' +
      sim.metrics.map(function (mt) {
        return '<tr><td>' + esc(mt.name) + '</td><td>' + esc(mt.unit) + '</td>' +
          '<td>' + (mt.direction === 'up' ? '越高越好' : '越低越好') + '</td>' +
          '<td class="small">' + esc(mt.note) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<div class="note small" style="margin-top:8px">六项固定指标与冻结底稿一致。' +
      '注：框架原指标名「参与者时间成本」在本轮实测中只覆盖上报环节，故报告与界面统一表述为「平均上报耗时」；' +
      '框架原指标名「不同新就业群体参与差距」在本轮只有骑手与司机两类群体，故表述为两类之差而非多群体极差。</div>' +
      simPendingCard(sim) +
      '</div></div>';
  }

  /* ============================================================== 仿真端视图 */

  function fmtVal(v, unit) {
    if (typeof v !== 'number') return String(v);
    return v + ' ' + unit;
  }

  function viewSimCompare() {
    var sim = D.SIM_RESULTS;
    var active = state.scenario;
    var sc = D.SCENARIOS.filter(function (s) { return s.id === active; })[0] || D.SCENARIOS[3];

    var cards = D.SCENARIOS.map(function (s) {
      return '<button class="scenario-card' + (s.id === active ? ' active' : '') + '" data-scenario="' + s.id + '">' +
        '<div class="tagline">' + s.id + '</div>' +
        '<div class="name">' + esc(s.name) + '</div>' +
        '<div class="added">唯一新增：' + esc(s.added) + '</div>' +
        '<ul>' + s.mechanics.slice(0, 3).map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' +
        '</button>';
    }).join('');

    var supRows = sim.supplementary.map(function (mt) {
      return '<tr><td>' + esc(mt.name) + '<div class="note small">' + esc(mt.note) + '</div></td>' +
        SIM_KEYS.map(function (k) { return '<td class="num">' + num(mt.values[k]) + '%</td>'; }).join('') + '</tr>';
    }).join('');

    var groupMax = sim.groupMax || 60;
    var groupBlock = sim.groups.map(function (g) {
      return '<div style="margin-bottom:10px"><div style="display:flex;gap:6px;align-items:center">' +
        '<b class="small">' + esc(g.name) + '</b><span style="flex:1"></span>' +
        '<span class="note small">S0 ' + num(g.values.S0) + '% → S3 ' + num(g.values.S3) + '%</span></div>' +
        SIM_KEYS.map(function (k) {
          return '<div class="bar" style="margin-top:3px" title="' + k + ' ' + num(g.values[k]) + '%">' +
            '<i style="width:' + Math.min(100, Math.round((g.values[k] / groupMax) * 100)) + '%;background:' +
            ({ S0: '#98a0a8', S1: '#8fb8e0', S2: '#f5b323', S3: '#1f9d6b' })[k] + '"></i></div>';
        }).join('') +
        '</div>';
    }).join('');

    var pairedRows = sim.pairedEffects.map(function (p) {
      return '<tr><td class="mono">' + esc(p.transition) + '</td><td>' + esc(p.metric) + '</td>' +
        '<td class="num">' + esc(p.diff) + '</td><td class="num">' + esc(p.ci) + '</td>' +
        '<td class="small">' + (p.crossesZero
          ? '<span class="badge risk-medium">区间跨 0</span> ' + esc(p.caveat)
          : '区间不含 0' + (p.caveat ? '；' + esc(p.caveat) : '')) + '</td></tr>';
    }).join('');

    return '<div class="shell">' +
      govHeader('仿真端 · S0–S3 情景对比', '比较四组治理机制；情景之间只改变约定的治理机制，其余参数保持一致（S1→S2 例外，见下）。',
        '<div class="btn-row"><a class="btn small" href="#/sim/config">参数与假设</a>' +
        '<a class="btn small" href="#/sim/limits">结果局限</a></div>') +

      '<div class="result-banner"><span class="mono">' + esc(sim.dataSource) + ' · ' + esc(sim.round) + '</span>' +
      '<span>本页数值为第一轮合成仿真结果（每情景 20 次重复、240 名合成从业者、56 个模拟日）。' +
      '在当前项目假设下得出，<b>不是现实统计或政策效果证明</b>，不得作为因果结论引用。</span></div>' +

      '<div class="scenario-grid" style="margin-bottom:14px">' + cards + '</div>' +

      '<div class="card"><div class="card-head"><h3>当前情景：' + active + ' ' + esc(sc.name) + '</h3>' +
      '<span class="spacer"></span><span class="badge ghost">' + esc(sc.mechanic) + '</span></div>' +
      '<div class="small">' + esc(sc.summary) + '</div>' +
      '<div class="btn-row" style="margin-top:8px">' + sc.mechanics.map(function (m) {
        return '<span class="tag">' + esc(m) + '</span>';
      }).join('') + '</div></div>' +

      '<div class="card"><div class="card-head"><h3>六项固定指标对比</h3><span class="spacer"></span>' +
      '<span class="badge ghost">第一轮结果 · 含 95% 区间</span></div>' +
      simMetricTable(sim, '绿色为该行方向上的最优值，红色为最差值；颜色仅用于阅读辅助，不构成结论。') +
      simLegend(sim) +
      '<div class="note small" style="margin-top:8px">' +
      '<b>两点必须同时说明：</b>① 平均上报耗时在 S1–S3 的原值分别为 2.9973、2.9962、3.0027 分钟，显示为两位小数后都变成 3.00，' +
      '因此不能据此说「激励进一步降低时间成本」或「透明反馈增加了时间成本」；' +
      '② 群体参与差距在 S0 至 S2 由 1.19 扩大到 2.81 个百分点，S2→S3 的变化为 −0.03 个百分点且 95% 区间跨越 0，' +
      '不能宣称差异化激励缩小了参与差距。</div></div>' +

      '<div class="cols c2">' +
      '<div class="card"><div class="card-head"><h3>分群体参与率（仅两类群体）</h3></div>' +
      groupBlock +
      '<div class="note small">' + esc(sim.groupNote) + '</div>' +
      '<div class="note warn small" style="margin-top:6px">' + esc(sim.groupCaveat) + '</div></div>' +
      '<div class="card"><div class="card-head"><h3>结论（当前假设下）</h3><span class="spacer"></span>' +
      '<span class="badge ghost">模型显示</span></div>' +
      '<div class="small">' + esc(sim.conclusion) + '</div>' +
      '<div class="divider"></div>' +
      '<div class="note small"><b>解释边界：</b>结论只写成「模型显示」或「在当前项目假设下」，不得写成现实证明；' +
      '需同时给出重复运行次数与波动范围；不得使用「显著」等统计显著表述（本轮未做显著性检验）。</div>' +
      '</div></div>' +

      '<div class="card"><div class="card-head"><h3>递进机制的配对效应</h3><span class="spacer"></span>' +
      '<span class="badge ghost">配对共同随机数 · 20 次配对</span></div>' +
      '<table class="tbl"><thead><tr><th>机制变化</th><th>指标</th><th class="num">平均差</th><th class="num">95% 区间</th><th>解释</th></tr></thead>' +
      '<tbody>' + pairedRows + '</tbody></table>' +
      '<div class="note small" style="margin-top:8px">区间跨越 0 的项不得表述为「有效应」或「缩小了差距」。' +
      'S1→S2 的处置时间改善还包含基础处置时长参数的调整，不应全部归因于透明反馈。</div></div>' +

      '<div class="card"><div class="card-head"><h3>辅助指标</h3><span class="spacer"></span>' +
      '<span class="badge ghost">不计入六项固定指标</span></div>' +
      '<table class="tbl"><thead><tr><th>指标</th><th class="num">S0</th><th class="num">S1</th><th class="num">S2</th><th class="num">S3</th></tr></thead>' +
      '<tbody>' + supRows + '</tbody></table>' +
      '<div class="note small" style="margin-top:6px">独立问题覆盖率与最后两周参与率是解释 S3「覆盖扩大、单条有效率略降」的关键证据；' +
      '工单解决率在 S3 相对 S2 轻微下降且 95% 区间跨越 0。</div></div>' +

      simPendingCard(sim) +
      '</div>';
  }

  function viewSimConfig() {
    var sim = D.SIM_RESULTS;
    var srcCls = function (s) {
      if (s === '项目假设' || s === '待补') return 'risk-medium';
      if (s.indexOf('机制') === 0 || s.indexOf('实验') === 0) return 'ghost';
      return 'risk-low';
    };
    return '<div class="shell">' +
      govHeader('仿真端 · 参数与假设', '每个参数标注来源：来自材料 / 机制设定 / 项目假设 / 实验记录 / 待补。',
        '<div class="btn-row"><a class="btn small" href="#/sim/compare">返回对比</a>' +
        '<a class="btn small" href="#/sim/limits">结果局限</a></div>') +

      '<div class="result-banner"><span class="mono">config.json</span>' +
      '<span>以下参数取自 AI 2 的仿真配置与参数登记表。全部数值参数均登记为项目假设或机制设定，未经总体数据校准。</span></div>' +

      '<div class="cols c2">' +
      '<div class="card"><div class="card-head"><h3>参数与假设</h3><span class="spacer"></span>' +
      '<span class="badge ghost">' + D.SIM_PARAMS.length + ' 项</span></div>' +
      '<table class="tbl"><thead><tr><th>参数</th><th>取值</th><th>来源</th><th>影响情景</th><th>说明</th></tr></thead><tbody>' +
      D.SIM_PARAMS.map(function (p) {
        return '<tr><td>' + esc(p.name) + '<div class="note small mono">' + esc(p.key) + '</div></td>' +
          '<td>' + esc(p.value) + '</td>' +
          '<td><span class="badge ' + srcCls(p.source) + '">' + esc(p.source) + '</span></td>' +
          '<td class="small">' + esc(p.affects) + '</td>' +
          '<td class="small">' + esc(p.note) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<div class="note small" style="margin-top:8px">来源标注规则：<b>来自材料</b>（有公开来源或已有调研材料支持，须由 AI 1 核对）、' +
      '<b>机制设定</b>（由情景定义直接决定）、<b>项目假设</b>（缺少可靠数据，须做敏感性分析）、<b>待补</b>（尚未产出，不得以估计值代替）。</div>' +
      '<div class="note small">' + esc(sim.assumptionRefs) + '</div></div>' +

      '<div>' +
      '<div class="card"><div class="card-head"><h3>情景新增机制</h3></div>' +
      '<table class="tbl"><thead><tr><th>情景</th><th>唯一新增机制</th><th>保持不变的参数</th></tr></thead><tbody>' +
      D.SCENARIOS.map(function (s) {
        return '<tr><td><b>' + s.id + '</b><div class="note small">' + esc(s.name) + '</div></td>' +
          '<td class="small">' + esc(s.added) + '</td>' +
          '<td class="small">' + (s.id === 'S0' ? '基准组'
            : (s.id === 'S2' ? '除反馈机制外，基础处置时长参数同时由 36 小时调整为 30 小时' : '除上表机制外，其余参数与 S0 保持一致')) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<div class="note warn small" style="margin-top:8px">单变量限制：S1→S2 同时改变了反馈机制与基础处置时长，因此该步的处置时间改善不能被解释为透明反馈的净效应。该限制已写入报告第 5 章与视频旁白。</div>' +
      '</div>' +

      '<div class="card"><div class="card-head"><h3>敏感性分析（尚未执行）</h3><span class="spacer"></span>' +
      '<span class="badge ph">SIM_RESULT_NEEDED_SENSITIVITY</span></div>' +
      '<table class="tbl"><thead><tr><th>参数</th><th>低</th><th>中（当前）</th><th>高</th></tr></thead><tbody>' +
      '<tr><td>每日问题遇见概率</td><td class="num">0.10</td><td class="num">0.18</td><td class="num">0.28</td></tr>' +
      '<tr><td>基线信任整体平移</td><td class="num">−0.15</td><td class="num">0</td><td class="num">+0.15</td></tr>' +
      '<tr><td>AI 结构化能力</td><td class="num">0.70</td><td class="num">0.88</td><td class="num">0.95</td></tr>' +
      '<tr><td>反馈送达概率</td><td class="num">0.60</td><td class="num">0.80</td><td class="num">0.92</td></tr>' +
      '<tr><td>差异化激励强度</td><td class="num">0.20</td><td class="num">0.55</td><td class="num">0.85</td></tr>' +
      '<tr><td>骑手与司机画像差异</td><td class="num">无差异</td><td class="num">当前假设</td><td class="num">双倍差异</td></tr>' +
      '</tbody></table>' +
      '<div class="note warn small" style="margin-top:8px">上述 6 组档位已在实验计划中设计，但<b>尚未执行任何敏感性运行</b>，因此本页不给出敏感性结论。' +
      '在敏感性分析完成前，不能判断哪些结论对参数取值稳健。</div></div>' +

      '<div class="card"><div class="card-head"><h3>机制风险与处理</h3></div>' +
      D.SCENARIO_TRADEOFFS.map(function (x) {
        return '<div style="margin-bottom:8px"><b class="small">风险：' + esc(x.risk) + '</b>' +
          '<div class="note small">当前处理：' + esc(x.handling) + '</div></div>';
      }).join('') +
      '<div class="note small">上述风险为设计层面的说明；其中「激励可能扩大群体参与差距」已由第一轮结果部分印证，须在落地阶段单列指标跟踪。</div></div>' +
      '</div></div></div>';
  }

  function viewSimLimits() {
    var sim = D.SIM_RESULTS;
    var pending = sim.pendingItems || [];
    return '<div class="shell">' +
      govHeader('仿真端 · 结果局限说明', '本页列出第一轮结果的适用边界与尚未完成的验证。',
        '<div class="btn-row"><a class="btn small" href="#/sim/compare">返回对比</a>' +
        '<a class="btn small" href="#/sim/config">参数与假设</a></div>') +

      '<div class="result-banner"><span class="mono">' + esc(sim.dataSource) + '</span>' +
      '<span>结果已就位，可以使用；但下列边界必须与数值同时出现，否则不得引用。</span></div>' +

      '<div class="cols c2">' +
      '<div class="card"><div class="card-head"><h3>已完成与未完成</h3></div>' +
      '<div class="checkline on"><span class="bx">✓</span><span>六项固定指标口径已固定，S0–S3 四组情景已跑完</span></div>' +
      '<div class="checkline on"><span class="bx">✓</span><span>每情景 20 次重复（计划为至少 5 次），保留逐次指标与逐条原始事件</span></div>' +
      '<div class="checkline on"><span class="bx">✓</span><span>使用配对共同随机数，可做情景间配对比较</span></div>' +
      '<div class="checkline on"><span class="bx">✓</span><span>已提供均值的 95% 区间（20 次重复的正态近似）</span></div>' +
      '<div class="checkline"><span class="bx"></span><span>参数敏感性分析尚未执行（已设计 6 组档位）</span></div>' +
      '<div class="checkline"><span class="bx"></span><span>玉兰万象平台复跑或导出交叉核对尚未完成</span></div>' +
      '<div class="checkline"><span class="bx"></span><span>未做任何统计显著性检验</span></div>' +
      '<div class="checkline"><span class="bx"></span><span>运行清单未记录 Python 版本、操作系统与运行时间戳</span></div>' +
      '<div class="divider"></div>' +
      '<div class="note small">数据来源：<span class="mono">' + esc(sim.dataSource) + '</span> · 情景：S0–S3 · 重复次数：<span class="mono">' + sim.repeats +
      '</span> · 种子：<span class="mono">' + sim.baseSeed + '</span> · 运行日期：<span class="mono">' + esc(sim.runDate) + '</span>' +
      '（' + esc(sim.runDateNote) + '）</div></div>' +

      '<div class="card placeholder-card"><div class="card-head"><h3>待补材料（不使用估计值代替）</h3><span class="spacer"></span>' +
      '<span class="badge ph">' + pending.length + ' 项</span></div>' +
      '<ul class="small" style="margin:0">' + pending.map(function (p) {
        return '<li><b class="mono">' + esc(p.key) + '</b><div class="note small">' + esc(p.desc) + '</div></li>';
      }).join('') + '</ul></div>' +

      '<div class="card"><div class="card-head"><h3>结果局限</h3></div>' +
      '<ul class="small">' + sim.limitations.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +

      '<div class="card"><div class="card-head"><h3>通用的解释边界</h3></div>' +
      '<ul class="small">' +
      '<li>仿真结果是合成智能体在特定假设下的产物，不能冒充真实调查，也不能作为现实证明。</li>' +
      '<li>结论必须写成「模型显示」或「在当前假设下」。</li>' +
      '<li>必须报告重复运行次数、均值、波动与异常，而不是只展示最好的一次。</li>' +
      '<li>缺少可靠数据的参数必须标注为项目假设并做敏感性分析；本轮敏感性分析未执行。</li>' +
      '<li>未做显著性检验，因此不使用「显著」表述，只描述差值与区间。</li>' +
      '<li>30 人定性访谈只能支持定性发现，不得表述为总体比例；本轮报告未引用该材料。</li>' +
      '</ul></div>' +

      '<div class="card"><div class="card-head"><h3>本产品原型的局限</h3></div>' +
      '<ul class="small">' +
      '<li>AI 处理为规则表演示，不是真实模型推理，也未评估准确率。</li>' +
      '<li>地图为程序绘制的示意底图，网格为虚构编号，不含真实行政区划与小区地图。</li>' +
      '<li>语音为预置演示转写，不录音、不上传；照片使用内置演示图，不涉及本地文件选择。</li>' +
      '<li>积分与驿站权益为虚构示例，不存在真实兑换关系；办结产生的积分不累计到账户余额。</li>' +
      '<li>未接入任何政府、物业、外卖或网约车平台生产系统。</li>' +
      '<li>「退回补充」的回填表单未实现，上报人侧只能查看待补充事项。</li>' +
      '<li>品牌与合规界面（AI 生成内容标识、申诉举报入口）为通用示例，非最终品牌设计。</li>' +
      '<li>脱敏规则使用后行断言，需 Chrome 62+ / Edge 79+ 等现代浏览器。</li>' +
      '</ul></div>' +

      '<div class="card"><div class="card-head"><h3>与报告、视频的对接要求</h3></div>' +
      '<ul class="small">' +
      '<li>引用本页数值时，必须同时保留「第一轮合成仿真、在当前项目假设下、20 次重复」三项限定语。</li>' +
      '<li>视频旁白不得使用「显著」「证明有效」等表述。</li>' +
      '<li>群体参与差距不得表述为机制有效或差距缩小。</li>' +
      '<li>敏感性分析与平台复跑完成后，须重新生成截图并更新本文档与 demo-script.md。</li>' +
      '</ul></div>' +
      '</div></div>';
  }

  /* =============================================================== 全局导航绑定 */

  document.addEventListener('click', function (e) {
    var nav = e.target.closest ? e.target.closest('[data-nav]') : null;
    if (nav) {
      e.preventDefault();
      go(nav.getAttribute('data-nav'));
      return;
    }
    var rep = e.target.closest ? e.target.closest('[data-report]') : null;
    if (rep) {
      var kind = rep.getAttribute('data-report');
      state.report.inputKind = kind;
      state.report.rawText = '';
      state.report.transcript = '';
      state.report.hasPhoto = false;
      go('#/rider/report');
      return;
    }
    var scn = e.target.closest ? e.target.closest('[data-scenario]') : null;
    if (scn) {
      state.scenario = scn.getAttribute('data-scenario');
      persist();
      render();
      return;
    }
  });

  /* ==================================================================== 启动 */

  function boot() {
    loadState();
    parseRoute();
    applyQueryDrivers();
    render();
    if (state.query && state.query.shot) {
      toast('已载入演示场景：' + state.query.shot + '（演示数据）');
    }
    window.__FHZ_READY__ = true;
    window.__FHZ_ENGINE_OK__ = typeof E.runPipeline === 'function';
  }

  // 自检钩子：任何渲染期异常都会在页面上显示，避免静默失败影响录屏与截图核对
  window.addEventListener('error', function (ev) {
    var main = document.getElementById('main');
    if (!main) return;
    var box = document.getElementById('fatal');
    if (!box) {
      box = document.createElement('div');
      box.id = 'fatal';
      box.style.cssText = 'margin:16px;padding:12px 16px;border:1px solid #d3453f;background:#fdecea;color:#a92c27;border-radius:10px;font-family:monospace;white-space:pre-wrap';
      document.body.insertBefore(box, main);
    }
    box.textContent = '[原型运行时错误] ' + ev.message + '\n位置：' + (ev.filename || '') + ':' + (ev.lineno || 0);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
