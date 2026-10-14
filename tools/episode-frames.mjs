import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const WXJ = process.env.WX_JSON || '';
const NAME_TO = process.env.NAME_TO || '';   // NAME_TO='Петропавловск-Камчатский' — проверка длинных названий
const [,, type = 'returning-viewer', style = 'night', fmt = 'v'] = process.argv;
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto('http://localhost:4180/');
await p.waitForFunction(() => window.Director && window.Episode);
const info = await p.evaluate(async ([type, style, fmt, WXJ, NAME_TO]) => {
  await document.fonts.load('700 40px Caveat', 'Аа'); await document.fonts.load('700 40px Oswald', 'Аа');
  const base = await (await fetch('data/demo-journey.json')).json();
  const gpx = await (await fetch('samples/day47.gpx')).text();
  const r = window.RouteLib.prepare(window.RouteLib.parseAny(gpx, 'day47.gpx'));
  const step = Math.max(1, Math.floor(r.n / 150)), line = [];
  for (let i = 0; i < r.n; i += step) line.push([r.lon[i], r.lat[i]]); line.push([r.lon[r.n - 1], r.lat[r.n - 1]]);
  const seg = { km: Math.round(r.total / 100) / 10, line, date: '2026-08-16', to: NAME_TO || 'Байкал', gain: Math.round(r.stats.gain) };
  if (WXJ) seg.weather = JSON.parse(WXJ);   // WX_JSON='{...}' — подставить погоду дня для проверки карточки
  const media = [{ kind: 'photo', url: 'media/demo/baikal-1.jpg', caption: 'Первый вид на Байкал', credit: 'Фото: Thomas D. Fischer · CC BY-SA 4.0' }, { kind: 'photo', url: 'media/demo/baikal-2.jpg', caption: 'Берег у Листвянки', credit: 'Фото: Thomas D. Fischer · CC BY-SA 4.0' }];
  const { journey, change } = window.Director.addDay(base, seg, media, [{ text: 'Изнурительно, но весело' }]);
  const res = window.Director.direct(journey, type, { aspect: fmt === 'v' ? '9:16' : '16:9' });
  const [W, H] = fmt === 'v' ? [540, 960] : [960, 540];
  const sc = window.Episode.createEpisodeScene({ journey, plan: res.plan, styleId: style }, W, H);
  await sc.assetsReady;
  window.__ep = sc;
  return { change, plan: res.plan.beats.map((x) => `${x.startSec}s ${x.recipe} (${x.durationSec})`), dur: res.plan.durationSec, valid: window.Director.validate(res.plan, journey) };
}, [type, style, fmt, WXJ, NAME_TO]);
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
// плавность: скорость камеры на экране кадр к кадру и скачки этой скорости
{
  const b2 = await chromium.launch({ channel: 'msedge', headless: true });
  const p2 = await b2.newPage(); await p2.goto('http://localhost:4180/');
  await p2.waitForFunction(() => window.Director && window.Episode);
  const r = await p2.evaluate(async ([type, fmt]) => {
    const base = await (await fetch('data/demo-journey.json')).json();
    const gpx = await (await fetch('samples/day47.gpx')).text();
    const rt = window.RouteLib.prepare(window.RouteLib.parseAny(gpx, 'd.gpx')); const line = []; for (let i = 0; i < rt.n; i += 2) line.push([rt.lon[i], rt.lat[i]]);
    const { journey } = window.Director.addDay(base, { km: 69, line, to: 'Байкал', gain: 237 }, [{ kind: 'photo', url: 'media/demo/baikal-1.jpg' }], [{ text: 'Изнурительно, но весело' }]);
    const plan = window.Director.direct(journey, type).plan;
    const sc = window.Episode.createEpisodeScene({ journey, plan, styleId: 'night' }, 1080, 1920);
    let prev = null, pv = null, maxJump = 0, at = 0, maxV = 0;
    for (let f = 0; f < plan.durationSec * 30; f++) {
      const c = sc.cam(f / 30), s = Math.pow(2, c.z) / 1080;   // сдвиг в долях ширины кадра
      if (prev) { const v = Math.hypot((c.cx - prev.cx) * s, (c.cy - prev.cy) * s, c.z - prev.z); if (pv != null && Math.abs(v - pv) > maxJump) { maxJump = Math.abs(v - pv); at = f / 30; } pv = v; maxV = Math.max(maxV, v); }
      prev = c;
    }
    return { maxJump: +maxJump.toFixed(4), at: at.toFixed(2), maxV: +maxV.toFixed(4), shots: plan.beats.map((x) => x.startSec + ' ' + x.recipe).join(' | ') };
  }, [type, fmt]);
  console.log('плавность камеры: макс. скачок скорости', r.maxJump, 'px/кадр на', r.at, 'с; макс. скорость', r.maxV, 'px/кадр\n', r.shots);
  await b2.close();
}
