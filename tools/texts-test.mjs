// Тексты ролика: «Откуда выехали» и «Куда приехали» доходят до плана: node tools/texts-test.mjs
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', (e) => { console.log('pageerror:', e.message); process.exitCode = 1; });
await p.goto('http://localhost:4180/'); await p.waitForFunction(() => window.__app && window.__app.scene && window.__app.state.demoDay, null, { timeout: 60000 });
await p.click('#day47'); await p.waitForTimeout(2500);
await p.evaluate(() => { document.querySelector('#file').closest('.tab'); });
// свой трек: нужен не демо-режим
await p.setInputFiles('#file', 'samples/day47.gpx'); await p.waitForTimeout(5000);
await p.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; set('startName', 'Дом'); set('endName', 'Дача'); });
await p.waitForTimeout(3000);
const r = await p.evaluate(() => { const d = window.__app.state.lastEp.J.days; const l = d[d.length - 1]; return { from: l.from, to: l.to }; });
console.log(JSON.stringify(r)); let ok = r.from === 'Дом' && r.to === 'Дача';
await p.evaluate(() => [...document.querySelectorAll('#routeW button')].find((x) => x.dataset.v === '1.4').click()); await p.waitForTimeout(800);
const w = await p.evaluate(() => [window.__app.state.appearance.routeW, JSON.parse(localStorage.getItem('rs-appearance-v1')).routeW]); console.log('толщина линии:', w.join(','));
ok = ok && w[0] === 1.4 && w[1] === 1.4;
await b.close(); console.log(ok ? 'OK' : 'ПАДЕНИЕ'); if (!ok) process.exit(1);
