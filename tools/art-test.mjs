// Материалы стиля «Дневник» (art/): файлы на месте, вес в бюджете, страны и стикеры согласованы. Только Node.
// Запуск: node tools/art-test.mjs
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
const A = new URL('../art/', import.meta.url);
let bad = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) bad++; };
const info = JSON.parse(readFileSync(new URL('stickers.json', A), 'utf8'));
const size = (f) => statSync(new URL(f, A)).size;

for (const f of ['paper.jpg', 'wash.webp', 'barbos.webp', 'stickers.json', 'stickers/STICKER-LICENSE.txt']) ok(existsSync(new URL(f, A)), `есть art/${f}`);
const missing = Object.entries(info.files).filter(([, f]) => !existsSync(new URL(f, A)));
ok(missing.length === 0, `все ${Object.keys(info.files).length} стикеров лежат в art/stickers${missing.length ? ': нет ' + missing.map((m) => m[0]).join(', ') : ''}`);
const svgBad = Object.values(info.files).filter((f) => { const t = readFileSync(new URL(f, A), 'utf8'); return !/<svg[^>]*viewBox="0 0 512 512"/.test(t) && !/<svg/.test(t); });
ok(svgBad.length === 0, 'все стикеры — корректные SVG');
const isos = Object.keys(info.countryAliases);
ok(isos.every((c) => info.cultureByCountry[c] && info.files[info.cultureByCountry[c]]), `у каждой из ${isos.length} стран есть культурный стикер`);
ok(['wind', 'rain'].every((k) => info.files[info.events[k]]), 'стикеры событий (ветер, дождь) на месте');
ok(!!info.files['uz-chilpyk'] && !!info.files['stamp-compass'], 'Шылпык (подтверждённое событие) и компас на месте');
const aliasDup = Object.values(info.countryAliases).flat().map((x) => x.toLowerCase()); ok(new Set(aliasDup).size === aliasDup.length, 'названия стран не повторяются между странами');
// вес: всё, кроме source/ и pack/ (набор «приключение», подгружается по надобности), ≤ 600 КБ
const walk = (d) => readdirSync(new URL(d, A), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'source' || e.name === 'pack' ? [] : walk(d + e.name + '/')) : [d + e.name]));
const total = walk('').reduce((s, f) => s + size(f), 0);
ok(total <= 600 * 1024, `вес art/ без source: ${(total / 1024).toFixed(0)} КБ (бюджет 600)`);
ok(size('barbos.webp') <= 150 * 1024 && size('paper.jpg') <= 400 * 1024 && size('wash.webp') <= 150 * 1024, 'каждый файл в своём бюджете');

// набор art/pack: всё, что использует код, на месте; каждый файл ≤ 200 КБ, весь набор ≤ 6 МБ
{
  const idx = JSON.parse(readFileSync(new URL('pack/pack.json', A), 'utf8')); let tot = 0, big = 0, miss = 0;
  for (const [c, items] of Object.entries(idx)) for (const it of items) { const f = `pack/${c}/${it.id}.webp`; try { const z = size(f); tot += z; if (z > 200 * 1024) big++; } catch (e) { miss++; } }
  ok(miss === 0, 'все файлы из pack.json лежат в art/pack');
  ok(big === 0, 'каждый файл набора ≤ 200 КБ'); ok(tot <= 6 * 1048576, `набор art/pack: ${(tot / 1048576).toFixed(1)} МБ (бюджет 6)`);
  const used = ['land/02', 'sign/09', 'sign/10', 'sign/11', 'sign/12', 'wx/storm', 'wx/snow', 'wx/rain', 'wx/forest-fog', 'wx/wind-leaves', 'wx/sun', 'wx/sun-rays', 'wx/clouds'];
  ok(used.every((u) => { try { size(`pack/${u}.webp`); return true; } catch (e) { return false; } }), 'графика, которую использует «Дневник», на месте');
}

console.log(bad ? `\nПАДЕНИЙ: ${bad}` : '\nВСЕ ПРОВЕРКИ ПРОШЛИ'); process.exit(bad ? 1 : 0);
