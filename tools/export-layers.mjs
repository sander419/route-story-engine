import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
// node export-layers.mjs <file> <png|webm> <split 0|1> <dur> <outdir>
const [,, file='samples/short-section.geojson', fmt='png', split='0', dur='6', out='out/layers'] = process.argv;
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto(process.env.URL || 'http://localhost:4180/');
await p.setInputFiles('#file', file);
await p.waitForFunction(() => window.__app.scene);
await p.evaluate((d) => { window.__app.state.o.duration = +d; document.getElementById('duration').value = d; document.getElementById('duration').dispatchEvent(new Event('change')); }, dur).catch(()=>{});
await p.selectOption('#res', 'sd');
await p.click('#xmode button[data-v="layers"]');
await p.selectOption("#lyFmt", fmt); await p.selectOption("#lyFps", "15");
if (split === '1') await p.check('#lySplit');
const t0 = Date.now();
await p.click('#export');
await p.waitForFunction(() => window.__lastLayers || !document.getElementById('err').hidden, null, { timeout: 900000 });
const err = await p.evaluate(() => document.getElementById('err').hidden ? '' : document.getElementById('err').textContent);
if (err) { console.log('ERR', err); await b.close(); process.exit(1); }
const files = await p.evaluate(async () => Promise.all(window.__lastLayers.map(async (l) => { const buf = new Uint8Array(await (await fetch(l.url)).arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return { nm: l.nm, size: l.size, b64: btoa(s) }; })));
mkdirSync(out, { recursive: true });
for (const f of files) { writeFileSync(`${out}/${f.nm}`, Buffer.from(f.b64, 'base64')); console.log(f.nm, f.size); }
console.log(((Date.now() - t0) / 1000).toFixed(1) + 's');
await b.close();
