import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const [,, style='night', fmt='v'] = process.argv;
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:4180/');
await p.click('#demo');
await p.waitForFunction(() => window.__app.scene);
await p.fill('#note', '300 км пустыни — и ни одного прокола');
await p.setInputFiles('#photos', ['out/ph-gps.jpg', 'out/ph-time.jpg', 'out/ph-none.jpg']);
await p.waitForFunction(() => window.__app.state.o.photos.length === 3);
await p.evaluate(([s, f]) => { const a = window.__app; a.state.styleId = s; a.state.fmt = f; a.rebuild(); }, [style, fmt]);
await p.waitForTimeout(800);
console.log('list:', await p.evaluate(() => [...document.querySelectorAll('#photoList small')].map(x => x.textContent).join(' | ')));
const ph = await p.evaluate(() => window.__app.scene.photos.map(q => ({ s: Math.round(q.s / 100) / 10, arr: +q.arr.toFixed(2), ok: q.e.ok })));
console.log('photos:', JSON.stringify(ph));
for (const t of [1.2, ph[0].arr + 0.9, ph[1].arr + 0.9]) {
  const png = await p.evaluate(async (t) => { const sc = window.__app.scene, cv = document.getElementById('cv'), c = cv.getContext('2d'); for (let k = 0; k < 3; k++) for (const q of sc.tilesAt(t)) await (q.vec ? window.VMap.getTile(q.z, q.x, q.y) : window.RS.getTile(q.layer, q.z, q.x, q.y, true)).p; for (const q of sc.photos) await q.e.p; sc.draw(c, t); return cv.toDataURL(); }, t);
  writeFileSync(`out/dp-${style}-${fmt}-${t.toFixed(1)}.png`, Buffer.from(png.split(',')[1], 'base64')); console.log('saved', t.toFixed(1));
}
await b.close();
