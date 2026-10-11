import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const [,, style='night', fmt='v', mode='journey', ...times] = process.argv;
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
p.on('console', m => m.type()==='error' && !/404/.test(m.text()) && console.log('console:', m.text()));
await p.goto('http://localhost:4180/');
if (mode==='both') await p.click('#demo');
await p.waitForFunction(() => window.__app);
await p.evaluate(async ([s,f,m]) => { const a=window.__app; a.state.styleId=s; a.state.fmt=f; a.loadJourney(await (await fetch('data/journey-wahrider.json')).json()); a.setMode(m); }, [style,fmt,mode]);
await p.waitForFunction(() => window.__app.scene && window.__app.scene.duration > 5);
console.log('duration', await p.evaluate(() => window.__app.scene.duration));
await p.waitForTimeout(500);
for (const t of times) {
  const png = await p.evaluate(async (t) => {
    const sc = window.__app.scene, cv = document.getElementById('cv'), c = cv.getContext('2d');
    for (let k=0;k<3;k++) for (const q of sc.tilesAt(+t)) await (q.vec ? window.VMap.getTile(q.z,q.x,q.y) : window.RS.getTile(q.layer,q.z,q.x,q.y,true)).p;
    sc.draw(c, +t); return cv.toDataURL('image/png');
  }, t);
  writeFileSync(`out/j-${style}-${fmt}-${mode}-${t}.png`, Buffer.from(png.split(',')[1], 'base64'));
  console.log('saved', t);
}
await b.close();
