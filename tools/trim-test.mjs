// Обрезка трека (основной путь героя — дни путешествия, дубль дня не появляется): ползунки укорачивают маршрут и ролик пересобирается: node tools/trim-test.mjs
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', (e) => { console.log('pageerror:', e.message); process.exitCode = 1; });
await p.goto('http://localhost:4180/'); await p.waitForFunction(() => window.__app && window.__app.scene && window.__app.state.demoDay, null, { timeout: 60000 });
await p.setInputFiles('#file', 'samples/own-day1.gpx'); await p.waitForTimeout(5000);
const km = () => p.evaluate(() => +(window.__app.state.route.total / 1000).toFixed(2));
const days = () => p.evaluate(() => window.__app.state.seriesBase.days.length); const n0 = await days(); const k0 = await km(); const shown = await p.evaluate(() => !document.getElementById('trimBox').hidden);
await p.evaluate(() => { const a = document.getElementById('trimA'); a.value = 20; a.dispatchEvent(new Event('input', { bubbles: true })); const e = document.getElementById('trimB'); e.value = 10; e.dispatchEvent(new Event('input', { bubbles: true })); });
await p.waitForTimeout(4500); const k1 = await km(); const lbl = await p.evaluate(() => document.getElementById('trimAo').textContent + ' / ' + document.getElementById('trimBo').textContent);
const n1 = await days(); console.log('дней до/после:', n0, n1);
console.log('до', k0, 'после', k1, lbl, 'панель', shown); const ratio = k1 / k0;
await p.setInputFiles('#file', 'samples/own-day1.gpx'); await p.waitForTimeout(4500); const k2 = await km(); const a2 = await p.evaluate(() => document.getElementById('trimA').value);
console.log('новый файл сбросил обрезку:', k2, a2);
await p.setInputFiles('#file', 'samples/own-day1.gpx'); await p.waitForTimeout(4500);
await p.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; set('trimC', 30); set('trimD', 50); });
await p.waitForTimeout(4500); const k3 = await km(), brk = await p.evaluate(() => !!(window.__app.state.route.brk && [...window.__app.state.route.brk].some(Boolean)));
console.log('вырезано 30–50%:', k3, 'разрыв на карте:', brk, await p.evaluate(() => document.getElementById('trimDo').textContent));
const okCut = brk && k3 / k0 > 0.7 && k3 / k0 < 0.9;
// несколько файлов = один день
await p.evaluate(() => { document.getElementById('mergeDay').checked = false; });
await p.setInputFiles('#file', ['samples/own-day1.gpx', 'samples/own-day2.gpx']); await p.waitForTimeout(6000);
const dSep = await days(), kSep = await km();
await p.evaluate(() => { const c = document.getElementById('mergeDay'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(6000);
const dMer = await days(), kMer = await km(); console.log('два файла: раздельно дней', dSep, ' склеено дней', dMer, 'км', kMer);
const okMerge = kMer > 295 && kMer < 308;   // 158,6 + 142,8 км в одном дне
const ok = okMerge && okCut && n0 === n1 && shown && ratio > 0.62 && ratio < 0.78 && Math.abs(k2 - k0) < 0.05 && a2 === '0';
await b.close(); console.log(ok ? 'OK' : 'ПАДЕНИЕ'); if (!ok) process.exit(1);
