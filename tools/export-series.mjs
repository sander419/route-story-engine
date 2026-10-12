import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
// node export-series.mjs <etype> <style> <v|h> <hd|sd> <out>
const [,, etype = 'returning-viewer', style = 'night', fmt = 'v', res = 'hd', out = 'out/series.mp4'] = process.argv;
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto(process.env.URL || 'http://localhost:4180/');
await p.waitForFunction(() => window.__app && window.__app.scene && window.__app.state.lastEp);
if (etype === 'hero') {
  await p.waitForFunction(() => window.__app.state.lastEp);
  await p.evaluate(() => document.getElementById('wj').click());
  await p.waitForFunction(() => window.__app.state.lastEp && window.__app.state.lastEp.J.schematic);
} else {
  await p.waitForFunction(() => /День 47/.test(document.getElementById('change').textContent) && window.__app.state.o.photos.length === 2);
}
await p.evaluate((s) => [...document.querySelectorAll('#styles button')].find((x) => x.dataset.id === s).click(), style);
await p.evaluate((f) => document.querySelector(`#fmt button[data-v="${f}"]`).click(), fmt);
if (etype !== 'hero') await p.evaluate((v) => { const e = document.getElementById('etype'); e.value = v; e.dispatchEvent(new Event('change')); }, etype);
await p.evaluate((r) => { const e = document.getElementById('res'); e.value = r; e.dispatchEvent(new Event('change')); }, res);
await p.waitForTimeout(500);
const plan = await p.evaluate(() => window.__app.state.lastEp.res.plan.beats.map((x) => x.recipe).join(' → '));
const t0 = Date.now();
await p.click('#export');
await p.waitForFunction(() => window.__lastExport || !document.getElementById('err').hidden, null, { timeout: 900000 });
const err = await p.evaluate(() => (document.getElementById('err').hidden ? '' : document.getElementById('err').textContent));
if (err) { console.log('ERR', err); process.exit(1); }
const r = await p.evaluate(async () => { const x = window.__lastExport; const buf = new Uint8Array(await (await fetch(x.url)).arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); });
writeFileSync(out, Buffer.from(r, 'base64'));
console.log(out, '|', plan, '|', ((Date.now() - t0) / 1000).toFixed(0) + 's');
await b.close();
