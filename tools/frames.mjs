import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const [,, style='night', fmt='v', ...times] = process.argv;
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('console', m => m.type()==='error' && console.log('console:', m.text()));
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:4180/');
await p.click('#demo');
await p.waitForFunction(() => window.__app.scene);
await p.evaluate(([s,f]) => { window.__app.state.styleId=s; window.__app.state.fmt=f; window.__app.rebuild(); }, [style, fmt]);
await p.waitForTimeout(500);
for (const t of (times.length?times:['0.5','6','12','19'])) {
  // загрузить все тайлы кадра, потом снять
  const png = await p.evaluate(async (t) => {
    const sc = window.__app.scene; const cv = document.getElementById('cv'); const c = cv.getContext('2d');
    for (let k=0;k<3;k++){ for (const q of sc.tilesAt(+t)) await window.RS.getTile(q.layer,q.z,q.x,q.y,true).p; }
    sc.draw(c, +t); return cv.toDataURL('image/png');
  }, t);
  writeFileSync(`out/f-${style}-${fmt}-${t}.png`, Buffer.from(png.split(',')[1], 'base64'));
  console.log('saved', t);
}
await b.close();
