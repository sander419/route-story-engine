import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
for (const [name, vp] of [['desk', { width: 1440, height: 900 }], ['mob', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp });
  await p.goto('http://localhost:4180/');
  await p.screenshot({ path: `out/ui-${name}-0.png` });
  await p.click('#demo');
  await p.waitForFunction(() => window.__app.scene); await p.waitForTimeout(2500);
  await p.screenshot({ path: `out/ui-${name}-1.png`, fullPage: name === 'mob' });
  await p.close();
}
await b.close();
