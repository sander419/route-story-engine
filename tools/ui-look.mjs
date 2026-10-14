// Снимки экрана самого сайта (первое впечатление жюри): node tools/ui-look.mjs [url] — ноутбук и телефон, out/ui-*.png
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:4180/';
const b = await chromium.launch({ channel: 'msedge', headless: true });
for (const [name, vp, mobile] of [['desk', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const c = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const p = await c.newPage(); p.on('pageerror', (e) => console.log(name, 'pageerror:', e.message));
  await p.goto(url); await p.waitForFunction(() => window.__app && window.__app.scene, null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(5000);
  await p.screenshot({ path: `out/ui-${name}.png` });
  await p.screenshot({ path: `out/ui-${name}-full.png`, fullPage: true });
  await c.close();
}
await b.close();
