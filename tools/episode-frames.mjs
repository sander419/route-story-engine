import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const [,, type = 'returning-viewer', style = 'night', fmt = 'v'] = process.argv;
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto('http://localhost:4180/');
await p.waitForFunction(() => window.Director && window.Episode);
const info = await p.evaluate(async ([type, style, fmt]) => {
  await document.fonts.load('700 40px Caveat', 'Аа'); await document.fonts.load('700 40px Oswald', 'Аа');
  const base = await (await fetch('data/demo-journey.json')).json();
  const gpx = await (await fetch('samples/day47.gpx')).text();
  const r = window.RouteLib.prepare(window.RouteLib.parseAny(gpx, 'day47.gpx'));
  const step = Math.max(1, Math.floor(r.n / 150)), line = [];
  for (let i = 0; i < r.n; i += step) line.push([r.lon[i], r.lat[i]]); line.push([r.lon[r.n - 1], r.lat[r.n - 1]]);
  const seg = { km: Math.round(r.total / 100) / 10, line, date: '2026-08-16', to: 'Байкал', gain: Math.round(r.stats.gain) };
  const media = [{ kind: 'photo', url: 'out/ph-gps.jpg', caption: 'Первый вид на Байкал' }, { kind: 'photo', url: 'out/ph-time.jpg' }];
  const { journey, change } = window.Director.addDay(base, seg, media, [{ text: 'Изнурительно, но весело' }]);
  const res = window.Director.direct(journey, type, { aspect: fmt === 'v' ? '9:16' : '16:9' });
  const [W, H] = fmt === 'v' ? [540, 960] : [960, 540];
  const sc = window.Episode.createEpisodeScene({ journey, plan: res.plan, styleId: style }, W, H);
  await sc.assetsReady;
  window.__ep = sc;
  return { change, plan: res.plan.beats.map((x) => `${x.startSec}s ${x.recipe} (${x.durationSec})`), dur: res.plan.durationSec, valid: window.Director.validate(res.plan, journey) };
}, [type, style, fmt]);
console.log(JSON.stringify(info.change), '\nplan', info.dur, 's\n ' + info.plan.join('\n '), '\nvalid', JSON.stringify(info.valid));
const times = await p.evaluate(() => window.__ep.plan.beats.map((x) => x.startSec + x.durationSec * 0.6));
const shots = [];
for (const t of times) {
  shots.push(await p.evaluate(async (t) => {
    const sc = window.__ep, cv = document.createElement('canvas'); cv.width = sc.W; cv.height = sc.H; const c = cv.getContext('2d');
    for (let k = 0; k < 3; k++) for (const q of sc.tilesAt(t)) await window.VMap.getTile(q.z, q.x, q.y).p;
    sc.draw(c, t); return cv.toDataURL('image/jpeg', 0.85);
  }, t));
}
shots.forEach((d, i) => writeFileSync(`out/ep-${type}-${style}-${fmt}-${i}.jpg`, Buffer.from(d.split(',')[1], 'base64')));
console.log('saved', shots.length);
await b.close();
