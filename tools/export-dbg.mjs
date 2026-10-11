import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
p.on('console', m => m.type() === 'error' && !/404/.test(m.text()) && console.log('console:', m.text().slice(0, 200)));
await p.goto('http://localhost:4180/');
await p.waitForFunction(() => window.__app);
await p.evaluate(async () => { const a = window.__app; a.loadJourney(await (await fetch('data/journey-wahrider.json')).json()); a.setMode('journey'); });
await p.waitForFunction(() => window.__app.scene && window.__app.scene.duration > 5);
await p.selectOption('#res', 'sd');
await p.click('#export');
for (let i = 0; i < 20; i++) {
  await p.waitForTimeout(3000);
  const s = await p.evaluate(() => ({ stage: document.getElementById('stage').textContent, err: document.getElementById('err').hidden ? '' : document.getElementById('err').textContent, done: !!window.__lastExport }));
  console.log(i * 3 + 's', JSON.stringify(s));
  if (s.done || s.err) break;
}
await b.close();
