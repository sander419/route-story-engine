// 10 синтетических случаев из брифа (п. 64–65): план валиден, длительность в границах,
// нет ссылок на отсутствующие данные, детерминизм, разнообразие планов.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const D = require('../src/director.js');

function line(lon, lat, km, wiggle = 0.0, n = 40) {
  const pts = [];
  const deg = km / 111 / Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i < n; i++) { const f = i / (n - 1); pts.push([lon + deg * f, lat + Math.sin(f * Math.PI * 4) * wiggle]); }
  return pts;
}
function journey(days, { photosOn = [], noteOn = [], start = [50.1, 53.2] } = {}) {
  let J = { id: 'demo', title: 'Самара → Байкал', traveler: 'Демо-путешественник', days: [], media: [], notes: [], checkpoints: [{ day: 1, kind: 'origin', label: 'Самара' }], episodes: [] };
  let lon = start[0];
  for (let d = 1; d <= days; d++) {
    const km = 80 + ((d * 37) % 60);
    const seg = { day: d, km, line: line(lon, start[1], km), date: `2026-08-${String(((d - 1) % 30) + 1).padStart(2, '0')}` };
    lon = seg.line[seg.line.length - 1][0];
    if (d === 12) seg.to = 'Уфа';
    if (d === 20) { seg.to = 'Урал'; seg.toKind = 'chapter'; }
    if (d === 33) seg.to = 'Омск';
    J = D.addDay(J, seg, photosOn.includes(d) ? [{ kind: 'photo', url: `p${d}.jpg` }] : [], noteOn.includes(d) ? [{ text: 'Ветер весь день' }] : []).journey;
  }
  return J;
}
function addToday(J, seg, photos = 0, note = null) {
  const media = Array.from({ length: photos }, (_, i) => ({ kind: 'photo', url: `today-${i}.jpg` }));
  return D.addDay(J, seg, media, note ? [{ text: note }] : []).journey;
}
const base46 = journey(46, { photosOn: [5, 18, 30, 41], noteOn: [9] });
const lastLon = base46.days[45].line[39][0];
const T = (km, wiggle = 0) => ({ km, line: line(lastLon, 53.2, km, wiggle), date: '2026-09-16' });

const cases = [
  ['1. 200 км, 2 фото, заметка, returning', addToday(base46, { ...T(200), to: 'Красноярск' }, 2, 'Изнурительно, но весело'), 'returning-viewer'],
  ['2. 5 км, без фото и заметки, returning', addToday(base46, T(5)), 'returning-viewer'],
  ['3. 80 км, фото, new viewer', addToday(base46, T(80), 1), 'new-viewer'],
  ['4. день-веха без медиа', addToday(journey(49), { ...T(120) }), 'returning-viewer'],
  ['5. высота + фото', addToday(base46, { ...T(90, 0.08), gain: 1350 }, 1), 'new-viewer'],
  ['6. story-so-far, 47 дней', addToday(base46, T(100), 1), 'story-so-far'],
  ['7. только маршрут, без подписей', addToday({ id: 'bare', title: '', days: [], media: [], notes: [], checkpoints: [], episodes: [] }, { day: 1, km: 40, line: line(30, 50, 40) }), 'returning-viewer'],
  ['8. много фото', addToday(base46, T(110), 6, 'Красота'), 'returning-viewer'],
  ['9. те же рецепты недавно', (() => { let J = addToday(base46, T(150), 2, 'Снова дождь'); const p = D.direct(J, 'returning-viewer').plan; J = { ...J, episodes: [D.summaryOf(p), D.summaryOf(p), D.summaryOf(p)] }; return J; })(), 'returning-viewer'],
  ['10. очень длинный участок', addToday(base46, { ...T(620, 0.2), to: 'Новосибирск' }, 1), 'returning-viewer'],
];

let fails = 0; const sigs = new Set();
for (const [name, J, type] of cases) {
  const a = D.direct(J, type), b = D.direct(J, type);
  const same = JSON.stringify(a.plan) === JSON.stringify(b.plan);
  const v = D.validate(a.plan, J);
  const sig = a.plan.beats.map((x) => x.recipe).join(' → ');
  sigs.add(sig);
  const ok = v.ok && same;
  if (!ok) fails++;
  console.log(`${ok ? 'OK ' : 'ERR'} ${name}\n    ${a.plan.durationSec} с · ${sig}${a.plan.fallback ? '  [fallback: ' + a.plan.fallback + ']' : ''}${a.plan.fitting ? '  {' + a.plan.fitting + '}' : ''}`);
  if (!same) console.log('    НЕ детерминирован');
  v.errors.forEach((e) => console.log('    ошибка:', e));
  v.warnings.forEach((e) => console.log('    предупреждение:', e));
}
console.log(`\nразных монтажных планов: ${sigs.size} из ${cases.length}; ошибок: ${fails}`);
// пример журнала решений
const ex = D.direct(cases[0][1], 'returning-viewer');
const mom = ex.log.find((l) => l.beat === 'moment');
console.log('\nжурнал, бит moment:', mom.candidates.map((c) => `${c.id}:${c.eligible ? c.total : 'нет'}`).join(', '), '→', mom.selected, '|', mom.reason);
process.exit(fails || sigs.size < 5 ? 1 : 0);
