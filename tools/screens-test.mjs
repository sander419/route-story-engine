// Экраны ролика: скрытие и длительность реально меняют ролик: node tools/screens-test.mjs
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', (e) => { console.log('pageerror:', e.message); process.exitCode = 1; });
await p.goto('http://localhost:4180/'); await p.waitForFunction(() => window.__app && window.__app.scene && window.__app.state.demoDay, null, { timeout: 60000 });
const dur = () => p.evaluate(() => window.__app.scene.duration), rows = () => p.evaluate(() => [...document.querySelectorAll('#screens .srow')].map((r) => r.firstChild.textContent + (r.classList.contains('off') ? ' (off)' : '')));
const d0 = await dur(), r0 = await rows(); console.log('до:', d0, r0.join(' | '));
let ok = r0.length >= 4;
await p.evaluate(() => { const r = [...document.querySelectorAll('#screens .srow')].find((x) => x.firstChild.textContent === 'Профиль высот'); [...r.querySelectorAll('button')].find((x) => x.textContent === 'Скрыть').click(); });
await p.waitForTimeout(2500); const d1 = await dur(), r1 = await rows(); console.log('скрыт профиль:', d1, r1.join(' | ')); ok = ok && d1 < d0 && r1.some((x) => x === 'Профиль высот (off)');
await p.evaluate(() => { const r = [...document.querySelectorAll('#screens .srow')].find((x) => x.firstChild.textContent === 'Дорога'); [...r.querySelectorAll('button')].find((x) => x.textContent === '+').click(); });
await p.waitForTimeout(2500); const d2 = await dur(); console.log('дорога +0,5 с:', d2); ok = ok && Math.abs(d2 - d1 - 0.5) < 0.05;
await b.close(); console.log(ok ? 'OK' : 'ПАДЕНИЕ'); if (!ok) process.exit(1);
