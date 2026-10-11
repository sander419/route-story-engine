import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto('http://localhost:4180/');
await p.waitForFunction(() => window.__app && window.__app.state.lastEp);
await p.evaluate(() => document.getElementById('wj').click());
await p.waitForFunction(() => window.__app.state.seriesBase && window.__app.state.seriesBase.schematic && window.__app.state.lastEp.J.schematic);
await p.waitForTimeout(500);
const info = await p.evaluate(() => { const e = window.__app.state.lastEp; return { plan: e.res.plan.beats.map((x) => `${x.startSec}s ${x.recipe}`), dur: e.res.plan.durationSec, valid: window.Director.validate(e.res.plan, e.J) }; });
console.log(info.dur + 's', info.plan.join(' | '), JSON.stringify(info.valid));
const times = await p.evaluate(() => { const out = []; for (const x of window.__app.state.lastEp.res.plan.beats) { if (x.recipe === 'journey-recap' || x.recipe === 'highlights-reel') { for (let k = 0.15; k < 1; k += 0.22) out.push(x.startSec + x.durationSec * k); } else out.push(x.startSec + x.durationSec * 0.7); } return out; });
let i = 0;
for (const t of times) {
  const d = await p.evaluate(async (t) => { const sc = window.__app.scene, cv = document.createElement('canvas'); cv.width = sc.W; cv.height = sc.H; const c = cv.getContext('2d'); if (sc.assetsReady) await sc.assetsReady; for (let k = 0; k < 3; k++) for (const q of sc.tilesAt(t)) await window.VMap.getTile(q.z, q.x, q.y).p; sc.draw(c, t); return cv.toDataURL('image/jpeg', 0.85); }, t);
  writeFileSync(`out/hero-${String(i++).padStart(2, '0')}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
}
console.log('кадров', i);
await b.close();
