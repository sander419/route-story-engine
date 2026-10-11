import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
for (const [name, vp] of [['desk', { width: 1440, height: 900 }], ['mob', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(process.env.URL || 'http://localhost:4180/');
  await p.waitForFunction(() => window.__app && window.__app.state.lastEp && /День 47/.test(document.getElementById('change').textContent), null, { timeout: 30000 });
  await p.waitForTimeout(4500);
  await p.screenshot({ path: `out/ui2-${name}.png`, fullPage: name === 'mob' });
  console.log(name, 'ok', await p.evaluate(() => document.documentElement.scrollWidth + '/' + innerWidth));
  await p.close();
}
await b.close();
