// Обрезка трека: ползунки укорачивают маршрут и ролик пересобирается: node tools/trim-test.mjs
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', (e) => { console.log('pageerror:', e.message); process.exitCode = 1; });
await p.goto('http://localhost:4180/'); await p.waitForFunction(() => window.__app && window.__app.scene && window.__app.state.demoDay, null, { timeout: 60000 });
await p.evaluate(() => { window.__app.state.mode = 'track'; });
await p.setInputFiles('#file', 'samples/own-day1.gpx'); await p.waitForTimeout(5000);
const km = () => p.evaluate(() => +(window.__app.state.route.total / 1000).toFixed(2));
const k0 = await km(); const shown = await p.evaluate(() => !document.getElementById('trimBox').hidden);
await p.evaluate(() => { const a = document.getElementById('trimA'); a.value = 20; a.dispatchEvent(new Event('input', { bubbles: true })); const e = document.getElementById('trimB'); e.value = 10; e.dispatchEvent(new Event('input', { bubbles: true })); });
await p.waitForTimeout(4500); const k1 = await km(); const lbl = await p.evaluate(() => document.getElementById('trimAo').textContent + ' / ' + document.getElementById('trimBo').textContent);
console.log('до', k0, 'после', k1, lbl, 'панель', shown); const ratio = k1 / k0;
await p.setInputFiles('#file', 'samples/own-day1.gpx'); await p.waitForTimeout(4500); const k2 = await km(); const a2 = await p.evaluate(() => document.getElementById('trimA').value);
console.log('новый файл сбросил обрезку:', k2, a2);
const ok = shown && ratio > 0.62 && ratio < 0.78 && Math.abs(k2 - k0) < 0.05 && a2 === '0';
await b.close(); console.log(ok ? 'OK' : 'ПАДЕНИЕ'); if (!ok) process.exit(1);
