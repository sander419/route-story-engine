// Аудит таймингов и «дерганья» эпизодов в стиле «Дневник»: кадр за кадром (30 к/с) считает изменение картинки
// и ищет всплески (мигание, скачок камеры). Запуск: node tools/timing-audit.mjs [тип|all] [v|h] [стиль]; сервер на 4180.
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const [,, which = 'all', fmtArg = 'v,h', style = 'journal'] = process.argv;
const types = which === 'all' ? ['new-viewer', 'returning-viewer', 'story-so-far'] : [which];
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto('http://localhost:4180/');
await p.waitForFunction(() => window.Director && window.Episode);
let bad = 0;
for (const fmt of fmtArg.split(',')) for (const type of types) {
  const r = await p.evaluate(async ([type, fmt, style]) => {
    await document.fonts.ready;
    const base = await (await fetch('data/demo-journey.json')).json();
    const gpx = await (await fetch('samples/day47.gpx')).text();
    const rt = window.RouteLib.prepare(window.RouteLib.parseAny(gpx, 'd.gpx')); const line = []; for (let i = 0; i < rt.n; i += 2) line.push([rt.lon[i], rt.lat[i]]);
    const media = [{ kind: 'photo', url: 'media/demo/baikal-1.jpg', caption: 'Первый вид на Байкал' }, { kind: 'photo', url: 'media/demo/baikal-2.jpg', caption: 'Берег' }];
    const { journey } = window.Director.addDay(base, { km: 69, line, to: 'Байкал', gain: 237, date: '2026-08-16' }, media, [{ text: 'Изнурительно, но весело' }]);
    const res = window.Director.direct(journey, type, { aspect: fmt === 'v' ? '9:16' : '16:9' });
    const [W, H] = fmt === 'v' ? [540, 960] : [960, 540];
    const sc = window.Episode.createEpisodeScene({ journey, plan: res.plan, styleId: style }, W, H); await sc.assetsReady;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d', { willReadFrequently: true });
    const sm = document.createElement('canvas'); sm.width = 54; sm.height = fmt === 'v' ? 96 : 30; const sg = sm.getContext('2d', { willReadFrequently: true });
    const dur = res.plan.durationSec, N = Math.floor(dur * 30), diffs = []; let prev = null;
    for (let f = 0; f < N; f++) {
      sc.draw(c, f / 30); sg.drawImage(cv, 0, 0, sm.width, sm.height); const d = sg.getImageData(0, 0, sm.width, sm.height).data;
      if (prev) { let s = 0; for (let i = 0; i < d.length; i += 4) s += Math.abs(d[i] - prev[i]) + Math.abs(d[i + 1] - prev[i + 1]) + Math.abs(d[i + 2] - prev[i + 2]); diffs.push(s / (d.length / 4) / 3); }
      prev = Uint8ClampedArray.from(d);
    }
    return { dur, beats: res.plan.beats.map((x) => [x.startSec, x.durationSec, x.recipe]), diffs, valid: window.Director.validate(res.plan, journey) };
  }, [type, fmt, style]);
  const d = r.diffs, med = [...d].sort((a, b) => a - b)[Math.floor(d.length / 2)] || 0;
  const bounds = r.beats.map((x) => x[0]), nearB = (t) => bounds.some((s) => Math.abs(t - s) < 0.5 || Math.abs(t - (s + 0)) < 0.5);
  const spikes = []; for (let i = 2; i < d.length - 2; i++) { const nb = (d[i - 2] + d[i - 1] + d[i + 1] + d[i + 2]) / 4; if (d[i] > 2 && d[i] > nb * 3 + 0.3) spikes.push([+(i / 30).toFixed(2), +d[i].toFixed(2), +nb.toFixed(2)]); }
  // резкие смены: кадры, где смена картинки >12 ед. (почти полная замена) — склейка без перехода
  // резкая склейка = короткий всплеск (1–2 кадра); серия из нескольких кадров — это плавный переход (наплыв), он допустим
  const cuts = []; for (let i = 0; i < d.length;) { if (d[i] > 12) { let j = i; while (j < d.length && d[j] > 12) j++; if (j - i <= 2) cuts.push([+((i + 1) / 30).toFixed(2), +Math.max(...d.slice(i, j)).toFixed(1)]); i = j; } else i++; }
  const short = r.beats.filter((x) => x[1] < 2.2).map((x) => x[2] + ' ' + x[1] + 'с');
  console.log(`\n== ${type} ${fmt} ${style}: ${r.dur} с, плановых кадров ${r.beats.length}, валид ${JSON.stringify(r.valid)}`);
  console.log(' кадры:', r.beats.map((x) => `${x[0]}+${x[1]} ${x[2]}`).join(' | '));
  console.log(` медиана изменения ${med.toFixed(2)}; всплески (дёрганье):`, spikes.length ? JSON.stringify(spikes) : 'нет', '| резкие склейки (>12):', cuts.length ? JSON.stringify(cuts) : 'нет', '| короче 2,2 с:', short.join(', ') || 'нет');
  bad += spikes.length + cuts.length;
}
console.log('\nИТОГ: проблемных моментов', bad); await b.close();
if (bad) process.exit(1);
