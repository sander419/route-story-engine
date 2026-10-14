// Рельеф (src/terrain.js): высоты загружаются, текстура не пустая и не чёрная, 3D-кадр рисуется, точки проецируются,
// при недоступных высотах стиль «Дневник» падает на эскиз без ошибок. Нужен интернет (плитки AWS Terrain Tiles); без него тест пропускается.
// Запуск: node tools/terrain-test.mjs  (сервер на 4180)
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
let bad = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) bad++; };
const b = await chromium.launch({ channel: 'msedge', headless: true });
const URL_ = process.env.URL || 'http://localhost:4180/';

const page = async (ctxOpts = {}) => { const c = await b.newContext(ctxOpts), p = await c.newPage(), errs = []; p.on('pageerror', (e) => errs.push(e.message)); await p.goto(URL_); await p.waitForFunction(() => window.Terrain && window.__app && window.__app.state.lastEp, null, { timeout: 90000 }); return { c, p, errs }; };
const bbox = `(() => { const px = (lon) => ((lon + 180) / 360) * 256, py = (lat) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256; }; const xs = [px(104.28), px(104.87)], ys = [py(52.29), py(51.85)]; return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; })()`;

{
  const { c, p, errs } = await page();
  const reach = await p.evaluate(async () => { try { const r = await fetch('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/8/187/86.png'); return r.ok; } catch (e) { return false; } });
  if (!reach) { console.log('ПРОПУЩЕНО: нет доступа к плиткам высот (AWS) — рельеф без сети проверяется ниже как запасной вариант'); }
  else {
    const r = await p.evaluate(async (bb) => {
      const T = await window.Terrain.load(eval(bb)); if (!T) return null;
      const tw = T.tex.width, th = T.tex.height, g = T.tex.getContext('2d'), d = g.getImageData(0, 0, tw, th).data; let sum = 0, dark = 0; const n = tw * th;
      for (let i = 0; i < n; i++) { const s = d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]; sum += s; if (s < 120) dark++; }
      const cam = { cx: T.cx, cy: T.cy, dist: 0.5, pitch: 55, bearing: 20, fov: 38 }, cv = window.Terrain.render(T, cam, 600, 600);
      let alpha = 0, black = 0, size = 0; if (cv) { const t = document.createElement('canvas'); t.width = t.height = 600; const x = t.getContext('2d'); x.drawImage(cv, 0, 0); const q = x.getImageData(0, 0, 600, 600).data; size = cv.width; for (let i = 0; i < 360000; i++) { if (q[i * 4 + 3] > 200) { alpha++; if (q[i * 4] + q[i * 4 + 1] + q[i * 4 + 2] < 90) black++; } } }
      const pr = window.Terrain.projector(T, cam, 600, 600), mid = pr(T.cx, T.cy);
      return { z: T.z, W: T.W, H: T.H, texW: tw, texH: th, hmin: Math.round(T.hmin), hmax: Math.round(T.hmax), meanBright: Math.round(sum / n / 3), darkPct: Math.round((100 * dark) / n), rendered: !!cv, size, opaquePct: Math.round(alpha / 3600), blackOfOpaquePct: alpha ? Math.round((100 * black) / alpha) : 100, mid };
    }, bbox);
    ok(!!r, 'рельеф загрузился');
    if (r) {
      ok(r.hmax > 800 && r.hmax < 3500 && r.hmin > -2000, `высоты правдоподобны: ${r.hmin}…${r.hmax} м (Байкал, горы вокруг)`);
      ok(r.texW === r.W && r.texH === r.H, `текстура ${r.texW}×${r.texH} совпадает с данными ${r.W}×${r.H}`);
      ok(r.meanBright > 90 && r.darkPct < 3, `текстура не пустая и не чёрная: средняя яркость ${r.meanBright}, тёмных пикселей ${r.darkPct}%`);
      ok(r.rendered && r.opaquePct > 25, `3D-кадр рисуется: непрозрачных ${r.opaquePct}%`);
      ok(r.blackOfOpaquePct < 2, `в кадре нет чёрных пятен (${r.blackOfOpaquePct}%)`);
      ok(r.mid && isFinite(r.mid[0]) && r.mid[0] > 100 && r.mid[0] < 500 && r.mid[1] > 100 && r.mid[1] < 500, `центр области проецируется в середину кадра: ${r.mid && r.mid.map(Math.round)}`);
    }
  }
  ok(errs.length === 0, `ошибок страницы: ${errs.length}`); await c.close();
}
{ // высоты недоступны: load → null, а экспорт «Дневника» всё равно идёт (эскиз)
  const c = await b.newContext(); await c.route('**/elevation-tiles-prod/**', (r) => r.abort());
  const p = await c.newPage(), errs = []; p.on('pageerror', (e) => errs.push(e.message)); await p.goto(URL_);
  await p.waitForFunction(() => window.Terrain && window.__app && window.__app.state.lastEp, null, { timeout: 90000 });
  const t0 = Date.now(); const T = await p.evaluate(async (bb) => { const x = await window.Terrain.load(eval(bb)); return x === null; }, bbox);
  ok(T, `без высот load() возвращает null (за ${((Date.now() - t0) / 1000).toFixed(1)} с)`);
  await p.click('#export'); await p.waitForFunction(() => window.__lastExport || !document.getElementById('err').hidden, null, { timeout: 300000 });
  const e2 = await p.evaluate(() => (document.getElementById('err').hidden ? '' : document.getElementById('err').textContent));
  ok(!e2 && !errs.length, `экспорт «Дневника» без рельефа проходит (запасной эскиз)${e2 ? ': ' + e2 : ''}${errs.length ? ' · ' + errs[0] : ''}`); await c.close();
}
await b.close();
console.log(bad ? `\nПАДЕНИЙ: ${bad}` : '\nВСЕ ПРОВЕРКИ ПРОШЛИ'); process.exit(bad ? 1 : 0);
