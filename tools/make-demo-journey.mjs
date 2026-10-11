// Демо-путешествие: вымышленный путешественник на РЕАЛЬНЫХ дорогах OSM (OSRM).
// Дни 1–46: Самара → Иркутск (data/demo-journey.json). День 47: Иркутск → Листвянка (samples/day47.gpx).
import { writeFileSync } from 'node:fs';

const hav = (a, b) => { const R = 6371, t = (x) => (x * Math.PI) / 180; const dl = t(b[1] - a[1]), dn = t(b[0] - a[0]); const h = Math.sin(dl / 2) ** 2 + Math.cos(t(a[1])) * Math.cos(t(b[1])) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const osrm = async (pts) => {
  const u = `https://router.project-osrm.org/route/v1/driving/${pts.map((p) => p.join(',')).join(';')}?overview=full&geometries=geojson`;
  for (let k = 0; k < 4; k++) { try { const j = await (await fetch(u)).json(); if (j.code === 'Ok') return j.routes[0].geometry.coordinates; console.log('osrm', j.code); } catch (e) { console.log('osrm err', e.message); } await new Promise((r) => setTimeout(r, 3000)); }
  throw new Error('OSRM недоступен');
};
const thin = (c, stepKm) => { const out = [c[0]]; let acc = 0; for (let i = 1; i < c.length; i++) { acc += hav(c[i - 1], c[i]); if (acc >= stepKm || i === c.length - 1) { out.push(c[i]); acc = 0; } } return out; };
const r5 = (p) => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5];

const CITIES = [
  ['Самара', [50.1, 53.2], 'origin'], ['Уфа', [55.97, 54.74], 'city'], ['Челябинск', [61.4, 55.16], 'chapter'],
  ['Курган', [65.34, 55.44], 'city'], ['Омск', [73.37, 54.99], 'city'], ['Новосибирск', [82.92, 55.03], 'city'],
  ['Красноярск', [92.87, 56.01], 'city'], ['Иркутск', [104.28, 52.29], 'city'],
];
const full = thin(await osrm(CITIES.map((c) => c[1])), 1.5);
const cum = [0]; for (let i = 1; i < full.length; i++) cum.push(cum[i - 1] + hav(full[i - 1], full[i]));
const total = cum[cum.length - 1];
console.log('Самара → Иркутск по дорогам:', Math.round(total), 'км,', full.length, 'точек');

// 46 дней: «живая» неравномерность, 3 дня отдыха
const REST = new Set([15, 28, 39]);
const raw = []; for (let d = 1; d <= 46; d++) raw.push(REST.has(d) ? 0 : 92 + 26 * Math.sin(d * 1.7) + 14 * Math.sin(d * 0.53));
const k = total / raw.reduce((a, b) => a + b, 0);
const kms = raw.map((x) => x * k);
const days = []; let s0 = 0, i0 = 0;
const date = (d) => new Date(Date.UTC(2026, 6, 1) + (d - 1) * 864e5).toISOString().slice(0, 10);
for (let d = 1; d <= 46; d++) {
  const s1 = s0 + kms[d - 1];
  let i1 = i0; while (i1 < full.length - 1 && cum[i1] < s1) i1++;
  if (d === 46) i1 = full.length - 1;
  const seg = full.slice(i0, i1 + 1);
  const line = (seg.length >= 2 ? thin(seg, Math.max(1.5, kms[d - 1] / 45)) : [full[i0], full[i0]]).map(r5);
  days.push({ day: d, date: date(d), km: Math.round((cum[i1] - cum[i0]) * 10) / 10, line });
  s0 = cum[i1]; i0 = i1;
}
// чекпоинты: день, в который путь проходит ближе всего к городу
const checkpoints = CITIES.map(([label, p, kind]) => {
  let best = 1, bd = Infinity;
  days.forEach((d) => d.line.forEach((q) => { const dd = hav(q, p); if (dd < bd) { bd = dd; best = d.day; } }));
  if (kind === 'origin') best = 1;
  return { day: best, kind, label };
});
// граница Европы и Азии на трассе М5 (обелиск у Златоуста ≈ 59.69, 55.07): день, когда путь ближе всего к ней
{ let best = 1, bd = Infinity; days.forEach((d) => d.line.forEach((q) => { const dd = hav(q, [59.69, 55.07]); if (dd < bd) { bd = dd; best = d.day; } })); checkpoints.push({ day: best, kind: 'chapter', label: 'Европа → Азия' }); }
days.forEach((d) => { const c = checkpoints.find((q) => q.day === d.day && q.kind !== 'origin'); if (c) d.to = c.label; });

writeFileSync('data/demo-journey.json', JSON.stringify({
  id: 'demo-samara-baikal', title: 'Самара → Байкал', traveler: 'Демо-путешественник',
  about: 'Вымышленный путешественник на реальных дорогах OpenStreetMap (OSRM). Даты и дневные километры смоделированы. Используется только для показа режиссёра серий.',
  days, media: [], notes: [], checkpoints, episodes: [],
}));
console.log('дней', days.length, 'итого', Math.round(days.reduce((a, d) => a + d.km, 0)), 'км; чекпоинты', checkpoints.map((c) => c.day + ':' + c.label).join(', '));

// День 47: Иркутск → Листвянка (Байкал), с высотами и временем
const d47 = thin(await osrm([[104.28, 52.29], [104.87, 51.857]]), 0.25);
const ele = [];
for (let i = 0; i < d47.length; i += 100) {
  const part = d47.slice(i, i + 100);
  const u = `https://api.open-meteo.com/v1/elevation?latitude=${part.map((p) => p[1].toFixed(5)).join(',')}&longitude=${part.map((p) => p[0].toFixed(5)).join(',')}`;
  let j; for (let t = 0; t < 8; t++) { j = await (await fetch(u)).json(); if (j.elevation) break; await new Promise((r) => setTimeout(r, 8000)); }
  ele.push(...j.elevation);
}
let t = Date.UTC(2026, 7, 16, 0, 30, 0);  // 08:30 по Иркутску
const pts = d47.map((p, i) => { if (i) t += (hav(d47[i - 1], p) / (14 + 4 * Math.sin(i / 23))) * 3600e3; return `<trkpt lat="${p[1].toFixed(6)}" lon="${p[0].toFixed(6)}"><ele>${ele[i]}</ele><time>${new Date(t).toISOString()}</time></trkpt>`; });
writeFileSync('samples/day47.gpx', `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="route-story demo" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>День 47 — Иркутск → Байкал (демо)</name></metadata><trk><name>День 47: Иркутск → Листвянка</name><trkseg>\n${pts.join('\n')}\n</trkseg></trk></gpx>`);
let km47 = 0; for (let i = 1; i < d47.length; i++) km47 += hav(d47[i - 1], d47[i]);
console.log('день 47:', Math.round(km47), 'км,', d47.length, 'точек');
