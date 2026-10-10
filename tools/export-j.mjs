import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
// node export-j.mjs <style> <v|h> <hd|sd> <journey|both> <outfile>
const [,, style='night', fmt='v', res='sd', mode='journey', out='out/j.mp4'] = process.argv;
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto(process.env.URL || 'http://localhost:4180/');
if (mode === 'both') await p.click('#demo');
await p.waitForFunction(() => window.__app);
await p.evaluate(async ([s,f,m]) => { const a=window.__app; a.loadJourney(await (await fetch('data/journey-wahrider.json')).json()); a.setMode(m); }, [style,fmt,mode]);
await p.evaluate((s)=>{ [...document.querySelectorAll('#styles button')].find(x=>x.dataset.id===s).click(); }, style);
await p.click(`#fmt button[data-v="${fmt}"]`);
await p.selectOption('#res', res);
await p.waitForFunction(() => window.__app.scene && window.__app.scene.duration > 5);
const t0 = Date.now();
await p.click('#export');
await p.waitForFunction(() => window.__lastExport || !document.getElementById('err').hidden, null, { timeout: 900000 });
const err = await p.evaluate(() => document.getElementById('err').hidden ? '' : document.getElementById('err').textContent);
if (err) { console.log('ERR', err); await b.close(); process.exit(1); }
const r = await p.evaluate(async () => { const x = window.__lastExport; const buf = new Uint8Array(await (await fetch(x.url)).arrayBuffer()); let s=''; for (let i=0;i<buf.length;i+=0x8000) s+=String.fromCharCode.apply(null, buf.subarray(i,i+0x8000)); return { size:x.size, codec:x.codec, b64: btoa(s) }; });
writeFileSync(out, Buffer.from(r.b64, 'base64'));
console.log(out, r.size, r.codec, ((Date.now()-t0)/1000).toFixed(1)+'s');
await b.close();
