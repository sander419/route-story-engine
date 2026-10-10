import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
for (const f of process.argv.slice(2)) {
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  p.on('pageerror', e => console.log('  pageerror:', e.message));
  await p.goto(process.env.URL || 'http://localhost:4180/');
  await p.setInputFiles('#file', f);
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => ({ err: document.getElementById('err').hidden ? '' : document.getElementById('err').textContent, scene: !!window.__app.scene, info: document.getElementById('info').innerText.replace(/\n/g,' | ') }));
  console.log(f, JSON.stringify(r));
  await p.close();
}
await b.close();
