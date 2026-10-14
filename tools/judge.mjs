// Путь жюри: чужой файл → экспорт через интерфейс → проверка готового MP4 (ffprobe).
// Каждый случай — чистый браузер без кэша и без памяти путешествия.
// Запуск: node tools/judge.mjs            (сервер на 4180 уже поднят; адрес можно сменить: URL=https://... )
// Результат: out/judge/*.mp4 + сводка в консоли. Код выхода 1, если хоть один случай не прошёл.
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');

const URL_ = process.env.URL || 'http://localhost:4180/';
const OUT = 'out/judge';
mkdirSync(OUT, { recursive: true });

/* --- детерминированные «чужие» треки (не из samples/, не в России) --- */
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
function walk(lat, lon, n, stepM, turn, withTime, withEle, t0 = Date.UTC(2026, 5, 3, 7, 0, 0)) {
  const pts = []; let hd = 1.1, t = t0, el = 40;
  for (let i = 0; i < n; i++) {
    pts.push({ lat, lon, t: withTime ? new Date(t).toISOString() : null, ele: withEle ? el.toFixed(1) : null });
    hd += (rnd() - 0.5) * turn;
    lat += (Math.cos(hd) * stepM) / 111320;
    lon += (Math.sin(hd) * stepM) / (111320 * Math.cos((lat * Math.PI) / 180));
    t += (stepM / 5.5) * 1000; el += (rnd() - 0.48) * 1.5;
  }
  return pts;
}
const trkpt = (p) => `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">${p.ele != null ? `<ele>${p.ele}</ele>` : ''}${p.t ? `<time>${p.t}</time>` : ''}</trkpt>`;
const gpx = (name, segs, ext = '') => `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="judge-test" xmlns="http://www.topografix.com/GPX/1/1"${ext}><trk><name>${name}</name>${segs.map((s) => `<trkseg>${s.map(trkpt).join('')}</trkseg>`).join('')}</trk></gpx>`;

const line = (lat, lon, dLat, dLon, n, ele, t0 = Date.UTC(2026, 5, 3, 7, 0, 0)) => Array.from({ length: n }, (_, i) => {
  let ln = lon + dLon * i; if (ln > 180) ln -= 360; if (ln < -180) ln += 360;
  return { lat: lat + dLat * i, lon: ln, t: new Date(t0 + i * 8000).toISOString(), ele: String(ele) };
});
const glitchy = walk(38.72, -9.14, 400, 30, 0.3, true, true); glitchy.splice(200, 0, { lat: 0, lon: 0, t: glitchy[200].t, ele: '0' });

const cases = [
  { id: 'geojson-sample', file: 'samples/short-section.geojson', style: 'journal', fmt: 'v', res: 'hd', note: 'формат GeoJSON, настройки по умолчанию (Full HD, 9:16)' },
  { id: 'csv-no-ele', file: 'samples/ride-no-elevation.csv', style: 'paper', fmt: 'h', res: 'sd', note: 'CSV без высоты, 16:9, второй стиль' },
  { id: 'csv-navigator', file: 'samples/ride-no-elevation.csv', style: 'navigator', fmt: 'v', res: 'sd', note: 'стиль «Навигатор» вместе с погодой, часами, знаком и цветом героя' },
  { id: 'gpx-south-notime', text: gpx('Ушуайя — Толуин', [walk(-54.80, -68.30, 500, 90, 0.35, false, false)]), ext: '.gpx', style: 'navigator', fmt: 'v', res: 'sd', note: 'южное полушарие, без времени и высоты' },
  { id: 'gpx-gap', text: gpx('Два куска', [walk(48.85, 2.35, 300, 40, 0.3, true, true), walk(48.40, 3.20, 300, 40, 0.3, true, true, Date.UTC(2026, 5, 3, 9, 0, 0))]), ext: '.gpx', style: 'journal', fmt: 'h', res: 'sd', maxKm: 40, note: 'два сегмента с разрывом ~80 км, записано ~24 км' },
  { id: 'gpx-big', text: gpx('Большой трек', [walk(35.68, 139.70, 22000, 12, 0.5, true, true)], ' xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"'), ext: '.gpx', style: 'sat', fmt: 'v', res: 'sd', note: '22 000 точек, расширения Garmin' },
  { id: 'gpx-glitch00', text: gpx('Сбой GPS', [glitchy]), ext: '.gpx', style: 'journal', fmt: 'v', res: 'sd', maxKm: 40, note: 'одиночный сбой GPS «в (0,0)» посреди трека (бывает у Strava/Garmin): путь не должен растягиваться' },
  { id: 'gpx-antimeridian', text: gpx('Таveuni, 180-й меридиан', [line(-16.9, 179.8, 0.0007, 0.0066, 120, 20)]), ext: '.gpx', style: 'night', fmt: 'h', res: 'sd', maxKm: 90, noDaySplit: true, maxSpanX: 5, note: 'один короткий трек через 180-й меридиан (Фиджи), 83 км за 16 мин записи' },
  { id: 'gpx-elev-gap', text: gpx('Перепад между сегментами', [line(47.00, 8.00, 0.0001, 0.0002, 200, 100), line(47.02, 8.04, 0.0001, 0.0002, 200, 1000, Date.UTC(2026, 5, 3, 9, 0, 0))]), ext: '.gpx', style: 'journal', fmt: 'v', res: 'sd', maxGain: 50, note: 'сегмент на 100 м, затем сегмент на 1000 м: настоящего набора нет' },
  { id: 'garbage', text: 'это не маршрут, просто текст\nвторая строка', ext: '.txt', expectError: true, note: 'мусорный файл — понятная ошибка, без падения' },
  { id: 'one-point', text: gpx('Одна точка', [[{ lat: 50, lon: 8, t: null, ele: null }]]), ext: '.gpx', expectError: true, note: 'одна точка — понятная ошибка' },
];
if (process.env.JURY_DIR) {   // JURY_DIR=папка — вместо встроенных случаев прогнать чужие файлы из папки (по умолчанию «Дневник», 9:16, SD)
  cases.length = 0;
  for (const f of readdirSync(process.env.JURY_DIR)) if (/\.(gpx|csv|json|geojson|tcx|kml)$/i.test(f)) cases.push({ id: f.replace(/\W+/g, '_'), file: process.env.JURY_DIR + '/' + f, style: 'journal', fmt: 'v', res: 'sd', note: f });
}
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const results = [];

const probe = (f) => {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height', '-of', 'json', f], { encoding: 'utf8' }));
  const v = j.streams.find((s) => s.codec_type === 'video') || {}; const a = j.streams.find((s) => s.codec_type === 'audio');
  return { dur: j.format.duration ? +(+j.format.duration).toFixed(1) : null, mb: +(+j.format.size / 1048576).toFixed(1), vcodec: v.codec_name, w: v.width, h: v.height, audio: a ? a.codec_name : 'нет' };
};
const stdAt = (f, sec) => { // «не пустой ли кадр»: разброс яркости
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(sec), '-i', f, '-frames:v', '1', '-vf', 'scale=64:64,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 20 });
  const a = [...raw]; const m = a.reduce((s, x) => s + x, 0) / a.length;
  return +Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length).toFixed(1);
};

const b = await chromium.launch({ channel: 'msedge', headless: true });
for (const c of cases) {
  if (only && !only.includes(c.id)) continue;
  const r = { id: c.id, note: c.note, problems: [] };
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  // BLOCK=nominatim,open-meteo,googleapis — имитация недоступных сервисов (подстроки хоста)
  const block = (process.env.BLOCK || '').split(',').filter(Boolean);
  if (block.length) await ctx.route('**/*', (rt) => (block.some((h) => rt.request().url().includes(h)) ? rt.abort() : rt.continue()));
  const p = await ctx.newPage();
  // NOCODEC=1 — как в браузере без WebCodecs (Firefox/Safari): должен сработать запасной WebM
  if (process.env.NOCODEC) await p.addInitScript(() => { delete window.VideoEncoder; delete window.AudioEncoder; });
  const ext = new Map(), pageErrors = [], badResp = [];
  p.on('pageerror', (e) => pageErrors.push(e.message));
  p.on('response', (x) => { const u = new URL(x.url()); if (u.host !== new URL(URL_).host) ext.set(u.host, (ext.get(u.host) || 0) + 1); if (x.status() >= 400) badResp.push(x.status() + ' ' + u.host + u.pathname.slice(0, 40)); });
  try {
    await p.goto(URL_);
    await p.waitForFunction(() => window.__app && window.__app.state.lastEp, null, { timeout: 60000 });
    const file = c.file ? c.file : `${OUT}/${c.id}${c.ext}`;
    if (c.text) writeFileSync(file, c.text);
    await p.setInputFiles('#file', file);
    await p.waitForFunction(() => !document.getElementById('err').hidden || (window.__app.state.route && !window.__app.state.routeIsDemo), null, { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2500);
    const errTxt = await p.evaluate(() => (document.getElementById('err').hidden ? '' : document.getElementById('err').textContent));
    r.head = await p.evaluate(() => document.getElementById('headline').textContent);
    r.facts = (await p.evaluate(() => document.getElementById('facts').innerText)).replace(/\n+/g, ' | ').slice(0, 700);
    const km = (r.head.match(/(\d[\d\s ]*(?:,\d+)?)\s*км/) || [])[1]; r.km = km ? +km.replace(/[\s ]/g, '').replace(',', '.') : null;
    const gain = (r.facts.match(/набор\s*\+(\d+)\s*м/) || [])[1];
    if (c.maxGain != null && gain != null && +gain > c.maxGain) r.problems.push(`набор высоты +${gain} м, реально не больше ${c.maxGain}`);
    if (c.maxSpanX) { r.spanX = await p.evaluate(() => { const rt = window.__app.state.route; return rt ? +(rt.bx1 - rt.bx0).toFixed(3) : null; }); if (r.spanX == null || r.spanX > c.maxSpanX) r.problems.push(`трек растянут по карте: ширина ${r.spanX} (должна быть < ${c.maxSpanX}) — линия через весь мир`); }
    if (c.noDaySplit && /день \d+ из путешествия/.test(r.head)) r.problems.push('один трек разрезан на «дни»: ' + r.head.slice(0, 80));
    if (c.maxKm && r.km != null && r.km > c.maxKm) r.problems.push(`в заголовке ${r.km} км, реально не больше ${c.maxKm}`);
    if (c.expectError) {
      r.error = errTxt; if (!errTxt) r.problems.push('нет сообщения об ошибке на мусорный файл');
    } else {
      if (errTxt) r.problems.push('ошибка на нормальном файле: ' + errTxt);
      const styles = await p.evaluate(() => [...document.querySelectorAll('#styles button')].map((x) => x.dataset.id));
      r.styles = styles.join(',');
      if (c.style != null) await p.evaluate((id) => document.querySelector(`#styles button[data-id="${id}"]`).click(), c.style);
      if (c.fmt) await p.evaluate((f) => document.querySelector(`#fmt button[data-v="${f}"]`).click(), c.fmt);
      if (c.res === 'sd') await p.evaluate(() => { const e = document.getElementById('res'); e.value = 'sd'; e.dispatchEvent(new Event('change')); });
      await p.waitForTimeout(600);
      const t0 = Date.now();
      await p.click('#export');
      await p.waitForFunction(() => window.__lastExport || !document.getElementById('err').hidden, null, { timeout: +(process.env.EXPORT_TIMEOUT || 900000) });
      r.exportSec = Math.round((Date.now() - t0) / 1000);
      const e2 = await p.evaluate(() => (document.getElementById('err').hidden ? '' : document.getElementById('err').textContent));
      if (e2) { r.problems.push('экспорт: ' + e2); }
      else {
        const b64 = await p.evaluate(async () => { const x = window.__lastExport; const buf = new Uint8Array(await (await fetch(x.url)).arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); });
        const nm = await p.evaluate(() => window.__lastExport.name || 'x.mp4'); const out = `${OUT}/${c.id}${nm.slice(nm.lastIndexOf('.'))}`; writeFileSync(out, Buffer.from(b64, 'base64'));
        r.file = probe(out);
        const wantV = c.fmt === 'h' ? [c.res === 'sd' ? 1280 : 1920, c.res === 'sd' ? 720 : 1080] : [c.res === 'sd' ? 720 : 1080, c.res === 'sd' ? 1280 : 1920];
        if (r.file.vcodec !== 'h264') r.problems.push('кодек ' + r.file.vcodec);
        if (r.file.w !== wantV[0] || r.file.h !== wantV[1]) r.problems.push(`размер ${r.file.w}×${r.file.h}, ожидали ${wantV.join('×')}`);
        if (r.file.dur == null) r.problems.push('в файле нет длительности (WebM без заголовка) — не перематывается');
        else if (r.file.dur < 8) r.problems.push('слишком короткий: ' + r.file.dur + ' с');
        r.contrast = [0.15, 0.5, 0.85].map((q) => stdAt(out, +((r.file.dur || 24) * q).toFixed(1)));
        if (Math.min(r.contrast[1], r.contrast[2]) < 4) r.problems.push('почти пустой кадр: ' + r.contrast.join('/'));
      }
    }
  } catch (e) { r.problems.push('сбой: ' + String(e.message).split('\n')[0]); }
  r.ext = Object.fromEntries(ext); if (badResp.length) r.badResp = badResp.slice(0, 6);
  if (pageErrors.length) r.problems.push('ошибки страницы: ' + pageErrors.slice(0, 2).join(' ; '));
  if (c.known) { r.known = c.known; if (r.problems.length) { r.knownProblems = r.problems; r.problems = []; } else r.problems.push('дефект «' + c.known + '» больше не воспроизводится — уберите known'); }
  results.push(r); console.log(JSON.stringify(r, null, 1));
  await ctx.close();
}
await b.close();
writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 1));
const bad = results.filter((r) => r.problems.length);
results.filter((r) => r.knownProblems).forEach((r) => console.log(' ⚠ известный дефект', r.id, '→', r.known, '|', r.knownProblems.join(' ; ')));
console.log('\nИТОГ:', results.length - bad.length + ' из ' + results.length + ' прошли');
bad.forEach((r) => console.log(' ✗', r.id, '→', r.problems.join(' | ')));
process.exit(bad.length ? 1 : 0);
