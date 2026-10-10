import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
// usage: node export.mjs <style> <fmt v|h> <res hd|sd> <duration> [file]
const [,, style='night', fmt='v', res='hd', dur='20', gpx='samples/samarkand-bukhara.gpx', outdir='out'] = process.argv;
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:4180/');
if (gpx.includes('samarkand')) await p.click('#demo'); else await p.setInputFiles('#file', gpx);
await p.waitForFunction(() => window.__app.scene);
await p.evaluate(([s,d]) => { const a=window.__app; a.state.styleId=s; a.state.o.duration=+d; }, [style, dur]);
await p.click(`#fmt button[data-v="${fmt}"]`);
await p.selectOption('#res', res);
await p.selectOption('#duration', dur).catch(()=>{});
await p.evaluate((s)=>{ [...document.querySelectorAll('#styles button')].find(x=>x.dataset.id===s).click(); }, style);
const t0 = Date.now();
await p.click('#export');
await p.waitForFunction(() => window.__lastExport || !document.getElementById('err').hidden, null, { timeout: 600000 });
const err = await p.evaluate(() => document.getElementById('err').hidden ? '' : document.getElementById('err').textContent);
if (err) { console.log('ERR', err); await b.close(); process.exit(1); }
const r = await p.evaluate(async () => { const x = window.__lastExport; const buf = new Uint8Array(await (await fetch(x.url)).arrayBuffer()); let s=''; for (let i=0;i<buf.length;i+=0x8000) s+=String.fromCharCode.apply(null, buf.subarray(i,i+0x8000)); return { name:x.name, size:x.size, codec:x.codec, b64: btoa(s) }; });
mkdirSync(outdir, { recursive: true });
writeFileSync(`${outdir}/${r.name}`, Buffer.from(r.b64, 'base64'));
console.log(r.name, r.size, r.codec, ((Date.now()-t0)/1000).toFixed(1)+'s');
await b.close();
