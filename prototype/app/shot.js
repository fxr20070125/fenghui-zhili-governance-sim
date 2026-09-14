/* =============================================================================
 * 蜂汇智理 原型 v0.1 — 截图脚本（shot.js）
 * -----------------------------------------------------------------------------
 * 用途：用无头浏览器渲染【真实页面】并生成 prototype/screenshots/*.png。
 *       不使用手工绘制的示意图，保证截图与原型一致。
 * 运行：node prototype/app/shot.js        （需要本机安装 Microsoft Edge 或 Chrome）
 * 负责人：AI 3
 * ========================================================================== */

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_DIR = __dirname;
const OUT_DIR = path.resolve(APP_DIR, '..', 'screenshots');
const INDEX = path.join(APP_DIR, 'index.html');

const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];

const SHOTS = [
  { file: '01-rider-home.png', route: '#/rider/home', wait: 1500 },
  { file: '02-rider-report-voice.png', route: '#/rider/report?shot=normal', wait: 2200 },
  { file: '03-rider-ai-review-ok.png', route: '#/rider/ai-review?input=normal', wait: 2200 },
  { file: '04-rider-ai-review-emergency.png', route: '#/rider/ai-review?input=emergency', wait: 2200 },
  { file: '05-rider-progress.png', route: '#/rider/progress?ticket=T-20260311-18', wait: 1800 },
  { file: '06-rider-services.png', route: '#/rider/services', wait: 1500 },
  { file: '07-gov-events.png', route: '#/gov/events', wait: 2200 },
  { file: '08-gov-event-detail.png', route: '#/gov/events/T-20260312-07', wait: 2200 },
  { file: '09-gov-map.png', route: '#/gov/map', wait: 2200 },
  { file: '10-gov-metrics.png', route: '#/gov/metrics', wait: 2200 },
  { file: '11-sim-compare.png', route: '#/sim/compare', wait: 2200 },
  { file: '12-sim-config.png', route: '#/sim/config', wait: 1800 },
  { file: '13-sim-limits.png', route: '#/sim/limits', wait: 1800 }
];

function findBrowser() {
  for (const b of BROWSERS) if (fs.existsSync(b)) return b;
  return null;
}

function fileUrl(hash) {
  let url = 'file:///' + INDEX.replace(/\\/g, '/');
  url = url.split('/').map((seg, i) => (i === 0 ? seg : encodeURIComponent(seg))).join('/');
  return url + hash;
}

function capture(browser, shot, size) {
  const out = path.join(OUT_DIR, shot.file);
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--force-device-scale-factor=2',
    '--window-size=' + size,
    '--virtual-time-budget=' + shot.wait,
    '--screenshot=' + out,
    fileUrl(shot.route)
  ];
  const res = spawnSync(browser, args, { stdio: 'inherit', timeout: 90000 });
  const ok = fs.existsSync(out);
  return { ok: ok, status: res.status, file: shot.file, route: shot.route };
}

function main() {
  const browser = findBrowser();
  if (!browser) {
    console.error('未找到 Edge 或 Chrome。请安装其中之一，或手动打开 app/index.html 截图。');
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const size = process.argv[3] || '1440,1000';
  const results = [];
  for (const shot of SHOTS) {
    console.log('→ 渲染 ' + shot.file + '  ' + shot.route);
    results.push(capture(browser, shot, size));
  }

  console.log('\n截图结果：');
  let fail = 0;
  for (const r of results) {
    console.log((r.ok ? '  [OK]   ' : '  [FAIL] ') + r.file + '   ' + r.route);
    if (!r.ok) fail++;
  }
  console.log('\n输出目录：' + OUT_DIR);
  process.exit(fail === 0 ? 0 : 2);
}

main();
