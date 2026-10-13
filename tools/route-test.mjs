// Проверка подготовки маршрута (src/route.js) без браузера: разрывы записи, набор высоты, 180-й меридиан.
// Запуск: node tools/route-test.mjs   (код выхода 1, если что-то не так)
import { readFileSync } from 'node:fs';
globalThis.window = {};
await import(process.env.ROUTE_SRC ? 'file:///' + process.env.ROUTE_SRC : '../src/route.js');
const R = window.RouteLib;
let bad = 0;
const ok = (cond, msg) => { console.log((cond ? 'OK   ' : 'FAIL ') + msg); if (!cond) bad++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/* точки по прямой: n точек с шагом (dLat, dLon), высота ele, сегмент seg, время от t0 с шагом dt мс */
const line = (lat, lon, dLat, dLon, n, ele, seg, t0, dt = 8000) => Array.from({ length: n }, (_, i) => {
  let ln = lon + dLon * i; if (ln > 180) ln -= 360; if (ln < -180) ln += 360;
  return { lat: lat + dLat * i, lon: ln, ele, t: t0 + i * dt, seg };
});
const T0 = Date.UTC(2026, 5, 3, 7, 0, 0);

// 1. один сегмент — всё как раньше, разрывов нет
{
  const r = R.prepare({ pts: line(47, 8, 0.0002, 0.0003, 400, 500, 0, T0) });
  ok(r.pieces === 1 && r.gapM === 0, 'один сегмент: разрывов нет');
  ok(r.total > 12000 && r.total < 13500, `один сегмент: длина ${(r.total / 1000).toFixed(2)} км`);
}
// 2. два сегмента, прыжок ~80 км: км, скорость и набор высоты через разрыв не считаются
{
  const a = line(48.85, 2.35, 0.0003, 0.0003, 300, 100, 0, T0), b = line(48.40, 3.20, 0.0003, 0.0003, 300, 1000, 1, T0 + 2 * 3600e3);
  const r = R.prepare({ pts: [...a, ...b] });
  const one = R.prepare({ pts: a }).total + R.prepare({ pts: b }).total;
  ok(r.pieces === 2 && r.gapM > 60000, `разрыв найден: кусков ${r.pieces}, пропущено ${(r.gapM / 1000).toFixed(0)} км`);
  ok(near(r.total, one, one * 0.01), `длина без разрыва: ${(r.total / 1000).toFixed(1)} км (сумма кусков ${(one / 1000).toFixed(1)})`);
  ok(r.stats.avg == null || r.stats.avg < 40, `средняя скорость без телепорта: ${r.stats.avg && r.stats.avg.toFixed(1)} км/ч`);
  ok(r.stats.gain < 10, `набор высоты между кусками не засчитан: +${r.stats.gain.toFixed(0)} м`);
  ok(r.brk.reduce((s, v) => s + v, 0) === 1, 'разрыв отмечен ровно в одной точке');
  const k = r.brk.indexOf(1);
  ok(r.D[k] === r.D[k - 1], 'дистанция через разрыв не растёт');
  ok(r.speed.every((v) => v <= 80) && r.speed[k] < 40 && r.speed[k - 1] < 40, 'скорость рядом с разрывом не раздута');
}
// 3. сегмент сменился, но прыжок маленький (пауза записи) — это склейка, не разрыв
{
  const a = line(47, 8, 0.0002, 0.0003, 200, 500, 0, T0), end = a[a.length - 1];
  const b = line(end.lat + 0.001, end.lon + 0.001, 0.0002, 0.0003, 200, 500, 1, T0 + 3600e3);
  const r = R.prepare({ pts: [...a, ...b] });
  ok(r.pieces === 1 && r.gapM === 0, 'маленький прыжок между сегментами — склейка, не разрыв');
}
// 3б. невозможный скачок высоты без пространственного разрыва (100 м → 1000 м за несколько метров)
{
  const a = line(47, 8, 0.0001, 0.0002, 200, 100, 0, T0), e = a[a.length - 1];
  const b = line(e.lat + 0.0001, e.lon + 0.0002, 0.0001, 0.0002, 200, 1000, 0, T0 + 3600e3);
  const r = R.prepare({ pts: [...a, ...b] });
  ok(r.stats.gain < 10, `скачок высоты не засчитан как набор: +${r.stats.gain.toFixed(0)} м`);
}
// 3в. настоящий набор сохраняется: ровный подъём 100 → 600 м на ~10 км
{
  const pts = Array.from({ length: 400 }, (_, i) => ({ lat: 47 + i * 0.00022, lon: 8, ele: 100 + (500 * i) / 399, t: T0 + i * 20000, seg: 0 }));
  const r = R.prepare({ pts });
  ok(near(r.stats.gain, 500, 40), `настоящий подъём считается: +${r.stats.gain.toFixed(0)} м (ожидали ~500)`);
}
// 4. точки без признака сегмента — поведение как раньше, даже с большим прыжком
{
  const strip = (p) => p.map(({ seg, ...q }) => q);
  const r = R.prepare({ pts: strip([...line(48.85, 2.35, 0.0003, 0.0003, 300, 100, 0, T0), ...line(48.40, 3.20, 0.0003, 0.0003, 300, 100, 0, T0 + 3600e3)]) });
  ok(r.pieces === 1, 'без признака сегмента разрыв не придумываем');
}
// 5. прореживание не теряет границы разрыва (5000 точек в каждом куске)
{
  const r = R.prepare({ pts: [...line(35.0, 139.0, 0.00005, 0.00007, 5000, 40, 0, T0, 2000), ...line(35.6, 139.9, 0.00005, 0.00007, 5000, 40, 1, T0 + 5 * 3600e3, 2000)] });
  ok(r.n <= 1900 && r.pieces === 2, `после прореживания (${r.n} точек) разрыв сохранён`);
  const k = r.brk.indexOf(1);
  ok(k > 0 && r.D[k] === r.D[k - 1], 'граница разрыва — соседние точки сохранены');
}
// 6. 180-й меридиан: долгота непрерывна, «день» один, положение в диапазоне
{
  const r = R.prepare({ pts: line(-16.9, 179.8, 0.0007, 0.0066, 120, 20, 0, T0) });
  ok(r.days === 1, `через 180-й меридиан день один (дней: ${r.days})`);
  ok(near(r.total / 1000, 83, 4), `длина через 180-й меридиан ${(r.total / 1000).toFixed(1)} км`);
  const a = R.at(r, r.total * 0.3);
  ok(a.lon >= -180 && a.lon <= 180, `положение на карте в диапазоне: ${a.lon.toFixed(2)}`);
}
// 7. сбой GPS «в (0,0)» отсеян
{
  const p = line(38.72, -9.14, 0.0002, 0.0002, 300, 50, 0, T0); p.splice(150, 0, { lat: 0, lon: 0, ele: 0, t: p[150].t, seg: 0 });
  const r = R.prepare({ pts: p });
  ok(r.total < 20000, `сбой (0,0) отсеян: ${(r.total / 1000).toFixed(1)} км`);
}
// 8. реальные примеры считаются как раньше (81,9 км)
for (const f of ['samples/ride-no-elevation.csv', 'samples/short-section.geojson']) {
  const parsed = R.parseAny(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), f);
  const r = R.prepare(parsed);
  ok(r.pieces === 1 && near(r.total / 1000, 81.9, 0.3), `${f}: ${(r.total / 1000).toFixed(1)} км, куски: ${r.pieces}`);
}
console.log(bad ? `\nПАДЕНИЙ: ${bad}` : '\nВСЕ ПРОВЕРКИ ПРОШЛИ');
process.exit(bad ? 1 : 0);
