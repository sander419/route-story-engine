// Сайт на планшете (как у героя): node tools/tablet-look.mjs → out/ui-tablet.png
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
const c = await b.newContext({ viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const p = await c.newPage(); p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto(process.argv[2] || 'http://localhost:4180/'); await p.waitForFunction(() => window.__app && window.__app.scene, null, { timeout: 60000 }); await p.waitForTimeout(4000);
await p.screenshot({ path: 'out/ui-tablet.png' }); await b.close();
