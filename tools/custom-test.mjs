// Пользовательские настройки доходят до ролика: заметки на маршруте, отметки фото, стикеры настроения, короткий/длинный ролик.
// Через интерфейс (как человек), кадры — out/custom-<стиль>-<n>.jpg. Запуск: node tools/custom-test.mjs [стиль] [v|h]; сервер на 4180.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const [,, style = 'journal', fmt = 'v'] = process.argv;
let bad = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) bad++; };
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(process.env.URL || 'http://localhost:4180/');
await p.waitForFunction(() => window.__app && window.__app.scene && window.__app.state.demoDay, null, { timeout: 60000 });
await p.evaluate(([st, f]) => { document.querySelector(`#styles button[data-id="${st}"]`).click(); document.querySelector(`#fmt button[data-v="${f}"]`).click(); }, [style, fmt]);
// короткий и длинный — разная длина ролика
const durShort = await p.evaluate(async () => { document.querySelector('#kind button[data-v="short"]').click(); await new Promise((r) => setTimeout(r, 700)); return window.__app.scene.duration; });
const durLong = await p.evaluate(async () => { document.querySelector('#kind button[data-v="long"]').click(); await new Promise((r) => setTimeout(r, 700)); return window.__app.scene.duration; });
ok(durLong > durShort + 2, `«Вся дорога» длиннее «Фрагмента»: ${durLong.toFixed(1)} с против ${durShort.toFixed(1)} с`);
await p.evaluate(() => document.querySelector('#kind button[data-v="short"]').click());
// заметки на маршруте
await p.evaluate(() => {
  for (const [txt, f] of [['Тут сломалась спица', 0.25], ['Самый красивый вид', 0.6]]) {
    document.getElementById('addNote').click(); const rows = document.querySelectorAll('#tnotes .tnote'), row = rows[rows.length - 1];
    const inp = row.querySelector('input:not([type])'); inp.value = txt; inp.dispatchEvent(new Event('input'));
    const rg = row.querySelector('input[type=range]'); rg.value = f * 100; rg.dispatchEvent(new Event('input')); rg.dispatchEvent(new Event('change'));
  }
});
// Ручные стикеры отключены по запросу: вместо них библиотека выбранного стиля.
await p.waitForTimeout(1500);
const st = await p.evaluate(() => ({ notes: window.__app.state.o.tnotes.length, stickers: window.__app.state.o.stickers.filter(Boolean).length, photos: (window.__app.state.o.photos || []).filter((q) => q.s != null).length }));
ok(st.notes === 2 && st.stickers === 0, `в состоянии 2 заметки, ручных стикеров нет: ${JSON.stringify(st)}`);
ok(await p.evaluate(() => document.getElementById('legacyStickerControls').hidden && !document.querySelector('#moods button') && !window.StyleIcons.legacyEnabled), 'выбор настроений и стикеров скрыт и отключён');
// перетаскивание фото по карте: отметка №1 переезжает ближе к концу маршрута
await p.evaluate(() => document.querySelector('#tabs button[data-t="photo"]').click()); await p.waitForTimeout(600);
const before = await p.evaluate(() => window.__app.state.o.photos.map((q) => q.s));
const pin = await p.evaluate(() => { const xy = window.__pmapPins()[0], cv = document.getElementById('pmap'), r = cv.getBoundingClientRect(); return xy && [r.left + (xy[0] * r.width) / cv.width, r.top + ((xy[1] - 38) * r.height) / cv.height, r.left + r.width * 0.9, r.top + r.height * 0.9]; });
if (pin) { await p.mouse.move(pin[0], pin[1]); await p.mouse.down(); await p.mouse.move((pin[0] + pin[2]) / 2, (pin[1] + pin[3]) / 2, { steps: 5 }); await p.mouse.move(pin[2], pin[3], { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(800); }
const after = await p.evaluate(() => window.__app.state.o.photos.map((q) => q.s));
ok(pin && after[0] !== before[0], `фото №1 перетащено по треку: ${Math.round(before[0] / 100) / 10} → ${Math.round(after[0] / 100) / 10} км`);
// «Что показывать»: выключаем фото, высоту и время в пути — этих кадров в плане быть не должно, знак по умолчанию — уницикл
const sh = await p.evaluate(async () => {
  const before = window.__app.state.lastEp.res.plan.beats.map((x) => x.recipe), mark = window.__app.state.lastEp.J.profile.mark;
  for (const k of ['photos', 'ele', 'time']) { const cb = document.querySelector(`#shows input[data-k="${k}"]`); cb.checked = false; cb.dispatchEvent(new Event('change')); }
  await new Promise((r) => setTimeout(r, 900)); const after = window.__app.state.lastEp.res.plan.beats.map((x) => x.recipe);
  for (const k of ['photos', 'ele', 'time']) { const cb = document.querySelector(`#shows input[data-k="${k}"]`); cb.checked = true; cb.dispatchEvent(new Event('change')); }
  await new Promise((r) => setTimeout(r, 900)); return { before, after, mark };
});
ok(sh.mark === 'unicycle', 'знак по умолчанию — уницикл: ' + sh.mark);
ok(sh.before.includes('photo-reveal') && !sh.after.some((r) => ['photo-reveal', 'elevation-profile', 'time-on-road'].includes(r)), `выключенное не попадает в ролик: было ${sh.before.join(',')} → стало ${sh.after.join(',')}`);
// кадры: обложка, раскрытие пути (заметки и фото на треке), прибытие, финал
const shots = await p.evaluate(async () => {
  const sc = window.__app.scene; await sc.assetsReady; const beats = window.__app.state.lastEp.res.plan.beats;
  const at = (r, k) => { const x = beats.find((q) => q.recipe === r); return x ? x.startSec + x.durationSec * k : null; };
  const times = [at('day-card', 0.6), at('route-reveal', 0.45), at('route-reveal', 0.8), at('checkpoint-arrival', 0.7), at('pullback', 0.9)].filter((v) => v != null);
  const out = []; for (const t of times) { const cv = document.createElement('canvas'); cv.width = sc.W; cv.height = sc.H; sc.draw(cv.getContext('2d'), t); out.push(cv.toDataURL('image/jpeg', 0.85)); }
  return out;
});
shots.forEach((d, i) => writeFileSync(`out/custom-${style}-${fmt}-${i}.jpg`, Buffer.from(d.split(',')[1], 'base64')));
ok(shots.length >= 4, `снято кадров: ${shots.length}`);
ok(!errs.length, 'без ошибок страницы' + (errs.length ? ': ' + errs.slice(0, 2).join(' ; ') : ''));
await b.close();
console.log(bad ? `\nПАДЕНИЙ: ${bad}` : '\nВСЕ ПРОВЕРКИ ПРОШЛИ'); process.exit(bad ? 1 : 0);
