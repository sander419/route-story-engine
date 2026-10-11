/* Режим «весь путь»: остановки (JSON) → маршрут-схема дугами → сцена; и склейка двух актов в один ролик. */
(function () {
  const { prepare, hav } = window.RouteLib;
  const rad = (x) => (x * Math.PI) / 180, deg = (x) => (x * 180) / Math.PI;

  /* точки большого круга между двумя местами (на Меркаторе — плавная дуга) */
  function arc(a, b, k) {
    const v = (p) => [Math.cos(rad(p.lat)) * Math.cos(rad(p.lon)), Math.cos(rad(p.lat)) * Math.sin(rad(p.lon)), Math.sin(rad(p.lat))];
    const A = v(a), B = v(b);
    const dot = Math.min(1, Math.max(-1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
    const om = Math.acos(dot), out = [];
    for (let i = 1; i <= k; i++) {
      const f = i / k;
      const s1 = om < 1e-9 ? 1 - f : Math.sin((1 - f) * om) / Math.sin(om), s2 = om < 1e-9 ? f : Math.sin(f * om) / Math.sin(om);
      const x = s1 * A[0] + s2 * B[0], y = s1 * A[1] + s2 * B[1], z = s1 * A[2] + s2 * B[2];
      out.push({ lat: deg(Math.atan2(z, Math.hypot(x, y))), lon: deg(Math.atan2(y, x)) });
    }
    return out;
  }

  /* count — сколько остановок оставить (первая и последняя — всегда) */
  function build(data, count) {
    const all = data.stops;
    let pick = all.map((_, i) => i);
    if (count && count < all.length) {
      const c = Math.max(2, count);
      pick = [...new Set(Array.from({ length: c }, (_, i) => Math.round((i * (all.length - 1)) / (c - 1))))];
    }
    const stops = pick.map((i) => all[i]);
    const pts = [{ lat: stops[0].lat, lon: stops[0].lon }];
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1], b = stops[i];
      const k = Math.max(12, Math.min(60, Math.round(hav(a, b) / 40000)));
      pts.push(...arc(a, b, k));
    }
    const route = prepare({ name: data.title, pts: pts.map((p) => ({ ...p, ele: NaN, t: NaN })) }, data.title);
    // расстояние до каждой остановки: ближайшая точка схемы
    const st = stops.map((q) => {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < route.n; i++) { const d = Math.abs(route.lat[i] - q.lat) + Math.abs(route.lon[i] - q.lon); if (d < bd) { bd = d; bi = i; } }
      return { name: q.name, country: q.country, precision: q.precision, dateLabel: q.dateLabel, fact: q.fact, km: q.km, photo: q.photo, photoPost: q.photoPost, s: route.D[bi] };
    });
    // защита от нулевых/обратных отрезков
    for (let i = 1; i < st.length; i++) if (st[i].s <= st[i - 1].s) st[i].s = Math.min(route.total, st[i - 1].s + 1);
    return {
      route,
      journey: { stops: st, note: data.note, introLine: data.introLine, summary: data.summary && { ...data.summary, cells: (data.summary.cells || []).map(([l, v]) => [l, l === 'ОСТАНОВОК' ? String(st.length) : v]) } },
      title: data.title, subtitle: data.subtitle,
    };
  }

  /* склейка актов: плавное растворение на стыке */
  function composite(parts, W, H, fade = 0.8) {
    const offs = []; let acc = 0;
    parts.forEach((p) => { offs.push(acc); acc += p.duration; });
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
    const tctx = tmp.getContext('2d');
    const idx = (t) => { let i = parts.length - 1; while (i > 0 && t < offs[i]) i--; return i; };
    return {
      duration: acc, W, H, events: [],
      assetsReady: Promise.all(parts.map((p) => p.assetsReady)),
      draw(ctx, t) {
        const i = idx(t), lt = t - offs[i];
        parts[i].draw(ctx, Math.min(lt, parts[i].duration));
        if (i > 0 && lt < fade) {
          parts[i - 1].draw(tctx, parts[i - 1].duration);
          ctx.save(); ctx.globalAlpha = 1 - lt / fade; ctx.drawImage(tmp, 0, 0); ctx.restore();
        }
      },
      tilesAt(t) {
        const i = idx(t), lt = t - offs[i];
        const out = parts[i].tilesAt(Math.min(lt, parts[i].duration));
        if (i > 0 && lt < fade) out.push(...parts[i - 1].tilesAt(parts[i - 1].duration));
        return out;
      },
    };
  }

  window.Journey = { build, composite };
})();
