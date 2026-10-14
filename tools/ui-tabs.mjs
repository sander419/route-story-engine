// Снимки всех шагов интерфейса (Маршрут/История/Вид/Ещё) на ноутбуке и телефоне + ошибки консоли: node tools/ui-tabs.mjs
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:4180/';
const b = await chromium.launch({ channel: 'msedge', headless: true });
for (const [name, vp, mobile] of [['desk', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const c = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const p = await c.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); p.on('console', (m) => m.type() === 'error' && !/404|Failed to load resource/.test(m.text()) && errs.push('console: ' + m.text().slice(0, 160)));
  await p.goto(url); await p.waitForFunction(() => window.__app && window.__app.scene, null, { timeout: 60000 }); await p.waitForTimeout(3000);
  for (const t of ['route', 'text', 'photo', 'look']) {
    await p.evaluate((t) => document.querySelector(`#tabs button[data-t="${t}"]`).click(), t); await p.waitForTimeout(500);
    await p.screenshot({ path: `out/tab-${name}-${t}.png`, fullPage: true });
  }
  console.log(name, errs.length ? errs : 'без ошибок'); await c.close();
}
await b.close();
