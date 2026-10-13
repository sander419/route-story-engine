/* Проигрыватель EpisodePlan в языке тревел-шоу (docs/SHOW-RULES.md):
   один фокус в кадре, ничего не мелькает, одно плавное движение камеры на кадр,
   титры места внизу, фото на весь экран с медленным наездом, карта — фон без мелких подписей.
   Интерфейс как у обычной сцены: draw(ctx, t, opts), tilesAt(t), duration, assetsReady. */
(function () {
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));      // мягкое ускорение и торможение
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const px = (lon) => ((lon + 180) / 360) * 256;
  const py = (lat) => { const s = Math.sin((clamp(lat, -85, 85) * Math.PI) / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256; };
  const fmtN = (v, d = 0) => v.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
  const daysWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'дня' : 'дней');
  const FADE = 0.6;

  let grainCv = null;
  function grain() {
    if (grainCv) return grainCv;
    const n = 256, c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d'), d = g.createImageData(n, n); let x = 123456789;
    for (let i = 0; i < n * n; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; const v = 96 + ((x >>> 24) & 63) * 2.5; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
    g.putImageData(d, 0, 0); return (grainCv = c);
  }
  /* ---- цвет героя → линия, акцент и ореол в любом стиле ---- */
  function hexHsl(hex) { const n = parseInt(hex.replace('#', ''), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; let h = 0; const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)); if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, s, l]; }
  const hsl = (h, s, l, a) => (a == null ? `hsl(${h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(clamp(l, 0, 1) * 100).toFixed(0)}%)` : `hsl(${h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(clamp(l, 0, 1) * 100).toFixed(0)}% / ${a})`);
  function heroTint(S0, color) {
    const [h, s, l] = hexHsl(color), light = !!S0.paper;
    return { ...S0,
      line: { ...S0.line, stops: light ? [hsl(h, s, Math.min(l + 0.06, 0.5)), hsl(h, s, Math.min(l, 0.4) - 0.06)] : [hsl(h, s, 0.78), hsl(h, s, 0.6), hsl(h, s, 0.5)], glow: light ? S0.line.glow : hsl(h, s, 0.55, 0.42) },
      accent: light ? hsl(h, Math.min(1, s + 0.1), Math.min(l, 0.33)) : hsl(h, s, 0.7), headHalo: hsl(h, s, light ? 0.4 : 0.6, light ? 0.35 : 0.55) };
  }
  /* ---- знак героя: рисуется кодом, одинаково на карте, в заставке и в подписи. spin — поворот колеса ---- */
  function drawMark(ctx, kind, x, y, r, color, spin = 0) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.lineWidth = r * 0.13; ctx.strokeStyle = color; ctx.stroke();
    const k = r / 50; ctx.scale(k, k); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const ink = '#1c1a17', steel = '#5f6770';
    const wheel = (cx, cy, R, rim) => {
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.lineWidth = R * 0.3; ctx.strokeStyle = ink; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.76, 0, 6.2832); ctx.lineWidth = R * 0.14; ctx.strokeStyle = rim; ctx.stroke();
      ctx.lineWidth = 1.3; ctx.strokeStyle = steel; for (let i = 0; i < 8; i++) { const a = spin + (i * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R * 0.7, cy + Math.sin(a) * R * 0.7); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.12, 0, 6.2832); ctx.fillStyle = ink; ctx.fill();
    };
    const L = (pts, w, c) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.lineWidth = w; ctx.strokeStyle = c; ctx.stroke(); };
    if (kind === 'unicycle') {   // Барбос: одно большое колесо с зелёным ободом, чёрная вилка и седло, длинная рама вперёд к двум рукояткам, площадка сзади
      wheel(-2, 14, 23, color);
      L([[-2, 14], [-1, -15]], 4.6, ink);                                   // вилка
      ctx.beginPath(); ctx.moveTo(-13, -17); ctx.quadraticCurveTo(-1, -23, 11, -18); ctx.lineWidth = 6.5; ctx.strokeStyle = ink; ctx.stroke();   // седло
      L([[6, -15], [27, -26]], 3.2, steel); L([[14, -19], [20, -11], [8, -13]], 2, steel);   // рама к рукояткам и клетка
      L([[25, -32], [29, -21]], 5, ink);                                     // рукоятки
      L([[-10, -15], [-27, -13]], 3, steel);                                 // площадка сзади
      const c = Math.cos(spin), sn = Math.sin(spin); L([[-2 - c * 9, 14 - sn * 9], [-2 + c * 9, 14 + sn * 9]], 3, ink); L([[-2 + c * 9 - 4, 14 + sn * 9], [-2 + c * 9 + 4, 14 + sn * 9]], 3.4, ink); L([[-2 - c * 9 - 4, 14 - sn * 9], [-2 - c * 9 + 4, 14 - sn * 9]], 3.4, ink);   // шатуны и педали
    } else if (kind === 'bike') {
      wheel(-18, 12, 13, color); wheel(18, 12, 13, color);
      L([[-18, 12], [-5, -9], [12, -9], [1, 12], [-18, 12]], 3.4, ink); L([[1, 12], [-5, -9]], 3.4, ink); L([[18, 12], [12, -9], [10, -17]], 3.4, ink);
      L([[5, -18], [15, -17]], 4, ink); L([[-10, -12], [-1, -12]], 4.6, ink);
    } else if (kind === 'walk') {
      ctx.beginPath(); ctx.arc(2, -22, 7, 0, 6.2832); ctx.fillStyle = ink; ctx.fill();
      const sw = Math.sin(spin) * 9; L([[1, -13], [-1, 6]], 6, ink); L([[-1, 6], [-8 - sw, 26]], 5, ink); L([[-1, 6], [8 + sw, 26]], 5, ink); L([[0, -9], [-10 + sw, 3]], 4, color); L([[0, -9], [11 - sw, 2]], 4, color);
    } else { ctx.beginPath(); ctx.arc(0, 0, 22, 0, 6.2832); ctx.fillStyle = color; ctx.fill(); }
    ctx.restore();
  }
  const imgCache = new Map();
  function img(url) {
    let e = imgCache.get(url);
    if (!e) { e = { ok: false, img: null }; e.p = new Promise((res) => { const im = new Image(); im.onload = () => { e.ok = true; e.img = im; res(); }; im.onerror = () => res(); im.src = url; }); imgCache.set(url, e); }
    return e;
  }

  function createEpisodeScene({ journey, plan, styleId, lang = 'ru' }, W, H) {
    /* Лицо героя (не меняется от стиля к стилю): знак, цвет, имя. Стиль карты — одежда. */
    const S0 = window.RS.STYLES[styleId] || window.RS.STYLES.night, PF = journey.profile || {};
    const S = PF.color ? heroTint(S0, PF.color) : S0;
    const u = Math.min(W, H) / 1080, portrait = H > W, mx = (portrait ? 72 : 110) * u;
    const ax = W / 2, ay = portrait ? H * 0.44 : H * 0.47;
    const days = [...journey.days].sort((a, b) => a.day - b.day);
    const today = days.find((d) => d.day === plan.episodeNumber) || days[days.length - 1];
    const P = (d) => d.line.map(([lo, la]) => [px(lo), py(la)]);
    const dayPts = days.map((d) => ({ day: d.day, pts: P(d), brk: new Set(d.breaks || []) }));   // brk — разрывы записи: через них не считаем длину и не рисуем
    const todayPts = P(today), todayBrk = new Set(today.breaks || []);
    const past = dayPts.filter((d) => d.day < today.day);
    const pastFlat = past.flatMap((d) => d.pts);
    const pastDayAt = []; past.forEach((d) => d.pts.forEach(() => pastDayAt.push(d.day)));
    const pastBrk = new Set(); { let off = 0; past.forEach((d) => { d.brk.forEach((k) => pastBrk.add(off + k)); off += d.pts.length; }); }
    const cum = (pts, brk) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + (brk && brk.has(i) ? 0 : Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))); return c; };
    const pastCum = cum(pastFlat, pastBrk), todayCum = cum(todayPts, todayBrk);
    const allPts = dayPts.flatMap((d) => d.pts);
    const maxKm = Math.max(1, ...days.map((d) => d.km));
    const mediaById = Object.fromEntries((journey.media || []).map((m) => [m.id, m]));
    const cps = journey.checkpoints || [];
    const origin = cps.find((c) => c.kind === 'origin');
    const prevStop = [...cps].filter((c) => c.day < today.day && (c.kind === 'city' || c.kind === 'origin' || c.kind === 'country')).pop();
    const fromLabel = today.from || (prevStop ? prevStop.label : null), toLabel = today.to || null;
    const MARK = PF.mark && PF.mark !== 'none' ? PF.mark : null, MCOL = PF.color || S.line.stops[S.line.stops.length - 1], NAME = PF.name || '';
    const single = days.length === 1;   // один трек без истории: «день 1» в титрах не пишем
    const DL = (day) => (journey.dayLabels && journey.dayLabels[day]) || 'день ' + day;   // для схемы по постам — даты, а не «день N»
    const kmText = (v) => (journey.totalKmLabel ? journey.totalKmLabel : fmtN(v) + ' км');
    const dayEnd = (day) => { const d = days.find((x) => x.day === day); if (!d) return null; const q = d.line[d.line.length - 1]; return [px(q[0]), py(q[1])]; };

    /* ---- камера ---- */
    const bbox = (pts) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, y0, x1, y1 }; };
    const fit = (b, fw, fh, zMax = 13) => ({ cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, z: clamp(Math.log2(Math.min(fw / Math.max(b.x1 - b.x0, 1e-6), fh / Math.max(b.y1 - b.y0, 1e-6))), 2, zMax) });
    const CAM = { journey: fit(bbox(allPts), W * 0.8, H * (portrait ? 0.36 : 0.56)), segment: fit(bbox(todayPts), W * 0.66, H * (portrait ? 0.3 : 0.48), 12.5) };
    const endP = todayPts[todayPts.length - 1];
    CAM.end = { cx: endP[0], cy: endP[1], z: Math.min(CAM.segment.z + 1.1, 13) };
    // перелёт: зум и сдвиг согласованы — цель всё время в кадре
    const glide = (a, b, t) => {
      const z = lerp(a.z, b.z, t), sc = Math.pow(2, z), s0 = Math.pow(2, a.z), s1 = Math.pow(2, b.z);
      if (b.z > a.z + 0.25) { const k = ((1 - t) * s0) / sc; return { cx: b.cx - (b.cx - a.cx) * k, cy: b.cy - (b.cy - a.cy) * k, z }; }
      if (a.z > b.z + 0.25) { const k = (t * s1) / sc; return { cx: a.cx - (a.cx - b.cx) * k, cy: a.cy - (a.cy - b.cy) * k, z }; }
      return { cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), z };
    };
    const dateRu = (iso) => (iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).replace(' г.', '') : '');
    const TARGET = {
      'weather-card': 'segment', 'trip-title': 'journey', 'day-summary': 'journey', 'time-on-road': 'segment', 'high-point': 'high',
      'day-card': 'journey', 'season-card': 'journey', 'progress-overview': 'journey', 'overview-to-detail': 'segment', 'route-reveal': 'segment',
      'camera-follow': 'segment', 'checkpoint-arrival': 'end', 'photo-reveal': 'end', 'note-card': 'end', 'location-card': 'end', 'distance-counter': 'segment',
      'day-barcode': null, 'elevation-profile': 'segment', 'pullback': 'journey', 'progress-poster': 'journey', 'journey-recap': 'journey', 'highlights-reel': null,
    };
    /* ---- камера-спутник для проезда: всё считается заранее, поэтому движение гладкое и одинаковое при каждом рендере ----
       1) время: на экране путь идёт не равномерно, а по «интересу» — медленнее на поворотах, подъёмах, у мест по пути и на старте/финише;
       2) камера: центр — сглаженное (по Гауссу) положение точки с небольшим упреждением, без рывков по построению;
       3) масштаб «дышит»: где точка идёт медленно — ближе, где быстро — дальше. */
    const FOLLOW_END = 0.97;
    function gauss(arr, sigma) {
      const n = arr.length, r = Math.max(1, Math.ceil(sigma * 3)), k = []; let ks = 0;
      for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); k.push(v); ks += v; }
      const out = new Float64Array(n);
      for (let i = 0; i < n; i++) { let a = 0; for (let j = -r; j <= r; j++) a += arr[clamp(i + j, 0, n - 1)] * k[j + r]; out[i] = a / ks; }
      return out;
    }
    function buildFollow(s) {
      const n = todayPts.length, total = todayCum[n - 1] || 1;
      const at = (fr) => { const L = clamp(fr, 0, 1) * total; let i = 1; while (i < n - 1 && todayCum[i] < L) i++; const g = clamp((L - todayCum[i - 1]) / Math.max(1e-9, todayCum[i] - todayCum[i - 1]), 0, 1); return [lerp(todayPts[i - 1][0], todayPts[i][0], g), lerp(todayPts[i - 1][1], todayPts[i][1], g)]; };
      // места по пути (их выбрал режиссёр)
      const wps = (s.params.waypoints || []).map((w) => {
        const q = [px(w.lon), py(w.lat)]; let bi = 0, bd = Infinity;
        todayPts.forEach((pt, i) => { const d = Math.hypot(pt[0] - q[0], pt[1] - q[1]); if (d < bd) { bd = d; bi = i; } });
        return { name: w.name, p: todayPts[bi], frac: todayCum[bi] / total };
      }).filter((w) => w.frac > 0.06 && w.frac < 0.94).sort((a, b) => a.frac - b.frac);
      // «интерес» вдоль пути → сколько экранного времени отдать каждому участку
      const M = 400, P = Array.from({ length: M + 1 }, (_, k) => at(k / M)), prof = today.profile;
      const pr = (fr) => { if (!prof) return 0; const x = clamp(fr, 0, 1) * (prof.length - 1), i = Math.min(prof.length - 2, Math.floor(x)); return lerp(prof[i], prof[i + 1], x - i); };
      const span = prof ? Math.max(40, Math.max(...prof) - Math.min(...prof)) : 1;
      let w = new Float64Array(M + 1);
      for (let k = 0; k <= M; k++) {
        const fr = k / M, a = P[Math.max(0, k - 5)], b = P[k], c = P[Math.min(M, k + 5)];
        const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [c[0] - b[0], c[1] - b[1]], l1 = Math.hypot(v1[0], v1[1]), l2 = Math.hypot(v2[0], v2[1]);
        const turn = l1 > 0 && l2 > 0 ? clamp(Math.acos(clamp((v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2), -1, 1)) / 1.2, 0, 1) : 0;
        const climb = prof ? clamp((pr(fr + 0.025) - pr(fr - 0.025)) / (span * 0.22), 0, 1) : 0;
        let v = 1 + 0.9 * turn + 1.1 * climb;
        for (const q of wps) v += 1.8 * Math.exp(-Math.pow((fr - q.frac) / 0.035, 2));
        v += 2.4 * Math.exp(-Math.pow(fr / 0.05, 2)) + 3 * Math.exp(-Math.pow((1 - fr) / 0.06, 2));   // мягкий старт и финиш
        w[k] = v;
      }
      w = gauss(w, 7);
      const T = new Float64Array(M + 1); for (let k = 1; k <= M; k++) T[k] = T[k - 1] + (w[k - 1] + w[k]) / 2;
      const dur = s.durationSec * (FOLLOW_END - 0.12), N = Math.max(150, Math.round(dur * 30));   // ~30 отсчётов в секунду
      const f = new Float64Array(N + 1); let kk = 1;
      for (let j = 0; j <= N; j++) { const tt = (j / N) * T[M]; while (kk < M && T[kk] < tt) kk++; f[j] = clamp((kk - 1 + (tt - T[kk - 1]) / Math.max(1e-9, T[kk] - T[kk - 1])) / M, 0, 1); }
      f[N] = 1;
      const perSec = N / dur, la = Math.round(0.45 * perSec);
      const hx = new Float64Array(N + 1), hy = new Float64Array(N + 1), lx = new Float64Array(N + 1), ly = new Float64Array(N + 1);
      for (let j = 0; j <= N; j++) { const h = at(f[j]), l = at(f[Math.min(N, j + la)]); hx[j] = h[0]; hy[j] = h[1]; lx[j] = l[0]; ly[j] = l[1]; }
      // масштаб: чем медленнее идёт точка, тем ближе камера
      const sp = new Float64Array(N + 1); for (let j = 0; j <= N; j++) { const a = Math.max(0, j - 1), b = Math.min(N, j + 1); sp[j] = Math.hypot(hx[b] - hx[a], hy[b] - hy[a]) / (b - a); }
      const ss = gauss(sp, 1.3 * perSec); let lo = Infinity, hi = -Infinity; for (const v of ss) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      // приближение подбирается так, чтобы карта плыла спокойно: не больше ~0,3 ширины кадра в секунду
      const zf = Math.min(clamp(Math.log2((0.3 * Math.min(W, H) * dur) / total), CAM.segment.z + 0.35, CAM.segment.z + 1.6), 13.2);
      let z = new Float64Array(N + 1); for (let j = 0; j <= N; j++) z[j] = zf + 0.32 - 0.64 * (hi > lo ? (ss[j] - lo) / (hi - lo) : 0.5);
      z = gauss(z, 0.9 * perSec);
      // центр камеры: сглаженная точка с упреждением; если точка уходит из кадра — сглаживаем слабее
      let cx, cy, sig = 0.85 * perSec;
      for (let tries = 0; tries < 4; tries++) {
        cx = gauss(lx, sig); cy = gauss(ly, sig);
        let off = 0; for (let j = 0; j <= N; j++) off = Math.max(off, Math.hypot(hx[j] - cx[j], hy[j] - cy[j]) * Math.pow(2, z[j]));
        if (off < Math.min(W, H) * 0.3) break; sig *= 0.6;
      }
      const xAt = (fr) => { let j = 0; while (j < N && f[j] < fr) j++; return j / N; };
      wps.forEach((q) => { q.x = xAt(q.frac); });
      return { N, f, cx, cy, z, dur, wps, cam0: { cx: cx[0], cy: cy[0], z: z[0] }, cam1: { cx: cx[N], cy: cy[N], z: z[N] } };
    }
    const fSample = (F, arr, x) => { const q = clamp(x, 0, 1) * F.N, i = Math.min(F.N - 1, Math.floor(q)); return lerp(arr[i], arr[i + 1], q - i); };
    // ход по заранее посчитанной траектории: разгон и торможение без скачка скорости на стыках с соседними кадрами
    const followX = (s, uu) => { const q = clamp((uu - s.move) / (FOLLOW_END - s.move), 0, 1), e = 0.14, nrm = 1 - e; return (q < e ? (q * q) / (2 * e) : q > 1 - e ? 1 - e - ((1 - q) * (1 - q)) / (2 * e) : q - e / 2) / nrm; };

    /* ---- свет по времени суток: настоящий час в точке, где сейчас едет путешественник; рассвет и закат — настоящие, если есть погода ---- */
    const WX = today.weather || null, tzSec = WX && WX.tz != null ? WX.tz : today.lon0 != null ? Math.round((today.lon0 / 15) * 3600) : null;
    const SR = WX && WX.sunrise != null ? WX.sunrise : 6.2, SS = WX && WX.sunset != null ? WX.sunset : 19.8;
    const NIGHT = [22, 34, 92, 0.4], DAWN = [255, 138, 104, 0.27], NONE = [255, 220, 170, 0], GOLD = [255, 160, 56, 0.32], DUSK = [128, 78, 170, 0.34];
    const LKEYS = [[SR - 1.3, NIGHT], [SR - 0.2, DAWN], [SR + 0.9, [255, 170, 120, 0.12]], [SR + 2.2, NONE], [SS - 2.8, NONE], [SS - 1.3, GOLD], [SS - 0.1, [255, 132, 52, 0.36]], [SS + 0.5, DUSK], [SS + 1.4, NIGHT]];
    function lightAt(h) {
      if (h <= LKEYS[0][0] || h >= LKEYS[LKEYS.length - 1][0]) return NIGHT;
      let i = 1; while (i < LKEYS.length - 1 && LKEYS[i][0] < h) i++;
      const a = LKEYS[i - 1], b = LKEYS[i], q = smooth((h - a[0]) / Math.max(1e-6, b[0] - a[0]));
      return [0, 1, 2, 3].map((k) => lerp(a[1][k], b[1][k], q));
    }
    const msAt = (fr) => { const A = today.tAt; if (!A || A.length < 2) return null; const x = clamp(fr, 0, 1) * (A.length - 1), i = Math.min(A.length - 2, Math.floor(x)); return lerp(A[i], A[i + 1], x - i); };
    const hourAt = (fr) => { const ms = msAt(fr); return ms == null || tzSec == null ? null : ((((ms / 1000 + tzSec) % 86400) + 86400) % 86400) / 3600; };
    const clockAt = (fr) => { const h = hourAt(fr); if (h == null || !(WX && WX.tz != null)) return ''; const m = Math.round(h * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
    const tempAt = (fr) => { const A = WX && WX.temps; if (!A || A.length < 2) return ''; const x = clamp(fr, 0, 1) * (A.length - 1), i = Math.min(A.length - 2, Math.floor(x)), v = Math.round(lerp(A[i], A[i + 1], x - i)); return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + '°'; };
    const OUTRO = { pullback: 1, 'progress-poster': 1, 'day-summary': 1, 'journey-recap': 1, 'season-card': 1, 'progress-overview': 1, 'day-barcode': 1, 'highlights-reel': 1 };
    /* ---- ветер и дождь: штрихи летят по настоящему направлению ветра; положение штрихов задано номером, а не случаем ---- */
    const frac = (v) => v - Math.floor(v);
    function streaks(ctx, t, a, toDeg, speed, n, len, color) {
      if (a <= 0.01) return;
      const ang = (toDeg * Math.PI) / 180, dx = Math.sin(ang), dy = -Math.cos(ang), R = Math.hypot(W, H);
      ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 3 * u;
      for (let i = 0; i < n; i++) {
        const h1 = frac(Math.sin(i * 12.9898) * 43758.5453), h2 = frac(Math.sin(i * 78.233) * 12543.123), h3 = frac(Math.sin(i * 39.425) * 9631.77);
        const along = (frac(h1 + (t * speed * (0.75 + 0.5 * h3)) / R) - 0.5) * R * 1.2, across = (h2 - 0.5) * R * 1.2;
        const x = W / 2 + dx * along - dy * across, y = H / 2 + dy * along + dx * across, L = len * (0.7 + 0.6 * h3);
        const edge = Math.sin(Math.PI * frac(h1 + (t * speed * (0.75 + 0.5 * h3)) / R));   // гаснут у краёв полёта
        const al = a * (0.25 + 0.45 * h2) * edge;
        if (n > 80) { ctx.strokeStyle = color + (al * 0.8).toFixed(3) + ')'; }   // дождь: штрихов много — без градиента, иначе кадр тяжёлый
        else { const g = ctx.createLinearGradient(x - dx * L, y - dy * L, x, y); g.addColorStop(0, color + '0)'); g.addColorStop(1, color + al.toFixed(3) + ')'); ctx.strokeStyle = g; }
        ctx.beginPath(); ctx.moveTo(x - dx * L, y - dy * L); ctx.lineTo(x, y); ctx.stroke();
      }
      ctx.restore();
    }

    const shots = plan.beats.map((b) => ({ ...b, t0: b.startSec, t1: b.startSec + b.durationSec }));
    const duration = plan.durationSec;
    // цепочка: каждый кадр начинается там, где закончился предыдущий
    let prevEnd = { ...CAM.journey, z: CAM.journey.z - 0.25 };
    for (const s of shots) {
      s.camFrom = prevEnd;
      const tg = TARGET[s.recipe];
      if (tg === 'high' && s.params.at) { s.hp = [px(s.params.at[0]), py(s.params.at[1])]; s.camTo = { cx: s.hp[0], cy: s.hp[1], z: Math.min(CAM.segment.z + 1.2, 13) }; }
      else s.camTo = tg && CAM[tg] ? CAM[tg] : prevEnd;
      if (s.recipe === 'route-reveal' && todayPts.length > 2) { s.follow = buildFollow(s); s.camTo = s.follow.cam0; }
      // время перелёта зависит от его дальности: ~0,45 с на каждый уровень приближения (без рывков)
      const dz = Math.abs(s.camTo.z - s.camFrom.z), far = Math.hypot(s.camTo.cx - s.camFrom.cx, s.camTo.cy - s.camFrom.cy) * Math.pow(2, Math.max(s.camTo.z, s.camFrom.z)) / Math.max(W, H);
      const moveSec = clamp(1 + 0.45 * dz + 0.3 * Math.min(far, 4), 1.2, s.durationSec * (s.recipe === 'pullback' ? 0.78 : s.recipe === 'overview-to-detail' ? 0.88 : 0.62));
      s.move = clamp(moveSec / s.durationSec, 0.15, 0.9);
      if (s.follow) { s.move = clamp(moveSec, 1.5, 2.6) / s.durationSec; s.follow.dur = s.durationSec * (FOLLOW_END - s.move); }
      if (s.recipe === 'journey-recap') {
        const hist = (s.params.history || []).filter((h) => dayEnd(h.day));
        s.stops = hist.map((h) => { const p = dayEnd(h.day); return { h, cam: { cx: p[0], cy: p[1], z: Math.min(CAM.journey.z + 1.8, 9) } }; });
        s.camTo = CAM.journey;
      }
      prevEnd = s.follow ? s.follow.cam1 : s.recipe === 'journey-recap' ? s.camTo : { ...s.camTo, z: s.camTo.z + 0.08 };   // учитываем дрейф — следующий кадр стартует ровно отсюда
    }
    function shotAt(t) { let i = shots.findIndex((s) => t < s.t1); if (i < 0) i = shots.length - 1; const s = shots[i]; return { i, s, u: clamp((t - s.t0) / s.durationSec, 0, 1), lt: t - s.t0 }; }
    function recapState(s, uu) {
      const n = s.stops.length; if (!n) return { k: -1, f: 1, seg: 1 };
      const seg = 1 / (n + 0.6); const k = Math.min(n - 1, Math.floor(uu / seg)); return { k, f: clamp((uu - k * seg) / seg, 0, 1), seg };
    }
    function cam(t) {
      const { s, u: uu } = shotAt(t);
      if (s.recipe === 'journey-recap' && s.stops.length) {
        const r = recapState(s, uu), endAt = r.seg * s.stops.length;
        if (uu > endAt) return glide(s.stops[s.stops.length - 1].cam, CAM.journey, sine((uu - endAt) / (1 - endAt)));
        const from = r.k === 0 ? s.camFrom : s.stops[r.k - 1].cam;
        return glide(from, s.stops[r.k].cam, sine(r.f / 0.32));
      }
      if (s.follow) {
        if (uu < s.move) return glide(s.camFrom, s.follow.cam0, sine(uu / s.move));
        const x = followX(s, uu), F = s.follow;
        return { cx: fSample(F, F.cx, x), cy: fSample(F, F.cy, x), z: fSample(F, F.z, x) };
      }
      const c = glide(s.camFrom, s.camTo, sine(uu / s.move));
      return { ...c, z: c.z + 0.08 * smooth((uu - s.move) / (1 - s.move)) };   // мягкий дрейф после движения
    }
    function todayReveal(t) {
      const s = shots.find((x) => x.recipe === 'route-reveal' || x.recipe === 'camera-follow');
      if (!s) return 1; if (t < s.t0) return 0; if (t >= s.t1) return 1;
      if (s.follow) { const uu = (t - s.t0) / s.durationSec; return uu < s.move ? 0 : fSample(s.follow, s.follow.f, followX(s, uu)); }
      return sine(clamp(((t - s.t0) / s.durationSec - s.move * 0.85) / (0.95 - s.move * 0.85), 0, 1));
    }
    function pastReveal(t) {
      const po = shots.find((x) => x.recipe === 'progress-overview');
      if (po) { if (t < po.t0) return 0; return sine(clamp((t - po.t0) / (po.durationSec * 0.8), 0, 1)); }
      const jr = shots.find((x) => x.recipe === 'journey-recap');
      if (jr) { if (t < jr.t0) return 0; if (t >= jr.t1) return 1; return -1; }   // -1: по вехам пересказа
      return 1;
    }

    const tilesAt = (t) => (S.vec ? window.VMap.tilesAt(cam(t), ax, ay, W, H) : []);
    const allMediaIds = [...new Set(shots.flatMap((s) => s.params.mediaIds || []))];
    let assetsReady = Promise.all(allMediaIds.map((id) => (mediaById[id] ? img(mediaById[id].url).p : Promise.resolve())));

    /* ---- типографика ---- */
    function T(ctx, str, x, y, a) {
      if (str == null || str === '') return;
      ctx.save();
      const size = (a.size || 40) * u, fam = a.fam || S.fBody, wt = a.weight || 700;
      ctx.font = `${wt} ${size}px ${fam}`; ctx.fillStyle = a.color || S.ink; ctx.textAlign = a.align || 'left'; ctx.textBaseline = 'alphabetic';
      ctx.letterSpacing = (a.ls || 0) * u + 'px'; if (a.alpha != null) ctx.globalAlpha *= a.alpha;
      if (a.shadow !== false) { ctx.shadowColor = a.shadowC || (S.paper ? 'rgba(239,226,196,.9)' : 'rgba(0,0,0,.6)'); ctx.shadowBlur = 24 * u; }
      if (a.max) { const w = ctx.measureText(str).width; if (w > a.max) ctx.font = `${wt} ${size * (a.max / w)}px ${fam}`; }
      ctx.fillText(str, x, y); ctx.restore();
    }
    let LT_NO_SCRIM = false, mapCache = null, lastCam = null;
    const HAND = '"Marck Script", "RS Geologica", "Segoe Script", cursive';
    // строки с цифрами — данные: шрифт S.fNum с табличными цифрами; слова (места, заголовки) — S.fHead с трекингом заголовка −2 %
    const withDigits = (str) => /\d/.test(String(str));
    const headStyle = (str, size) => (withDigits(str) ? { fam: S.fNum, weight: S.numW, ls: 0 } : { fam: S.fHead, weight: S.headW, ls: -0.02 * size });
    // видимость надписи кадра: плавно появляется, держится, плавно уходит
    const vis = (lt, dur, delay = 0.15) => smooth((lt - delay) / FADE) * (1 - smooth((lt - (dur - FADE)) / FADE));
    const rise = (lt, delay = 0.15) => (1 - sine((lt - delay) / 0.8)) * 26 * u;

    // титр места внизу — как в передаче
    function lowerThird(ctx, a, dy, kicker, title, sub, onPhoto) {
      if (a <= 0.01) return;
      const ink = onPhoto ? '#ffffff' : S.ink, dimC = onPhoto ? 'rgba(255,255,255,.85)' : S.dim, sh = onPhoto ? 'rgba(0,0,0,.7)' : null;
      const ts = portrait ? 108 : 128, ks = portrait ? 31 : 34, ss = portrait ? 40 : 44;
      const base = H - (portrait ? 360 : 150) * u + dy, ty = base - (sub ? ss * 1.4 : 0) * u, ky = ty - ts * 0.9 * u;
      const maxW = portrait ? W - 2 * mx : W * 0.62;
      ctx.save(); ctx.globalAlpha = a;
      if (!onPhoto && !LT_NO_SCRIM) {   // мягкая подложка под титром вместо плашки
        const y0 = ky - 190 * u, g = ctx.createLinearGradient(0, y0, 0, H); const c = S.scrim.join(',');
        g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.45, `rgba(${c},${S.paper ? 0.72 : 0.62})`); g.addColorStop(1, `rgba(${c},${S.paper ? 0.9 : 0.82})`);
        ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0);
      }
      ctx.fillStyle = S.accent; ctx.fillRect(mx, ky - ks * 1.5 * u, 72 * u, 7 * u);
      T(ctx, kicker && kicker.toUpperCase(), mx, ky, { size: ks, weight: 700, color: S.accent, ls: ks * 0.05, max: maxW, shadow: !!onPhoto, shadowC: sh });
      T(ctx, title, mx, ty, { size: ts, ...headStyle(title, ts), max: maxW, color: ink, shadowC: sh, shadow: !!onPhoto });
      if (sub) T(ctx, sub, mx, base, { size: ss, weight: 500, color: dimC, max: maxW, shadowC: sh, shadow: !!onPhoto });
      ctx.restore();
    }
    function centerTitle(ctx, a, dy, kicker, big, sub, bigSize) {
      if (a <= 0.01) return;
      const my = H * (portrait ? 0.45 : 0.47) + dy;
      ctx.save(); ctx.globalAlpha = a;
      T(ctx, kicker && kicker.toUpperCase(), W / 2, my - bigSize * 0.62 * u, { size: 34, weight: 700, color: S.accent, ls: 34 * 0.05, align: 'center' });
      T(ctx, big, W / 2, my + bigSize * 0.28 * u, { size: bigSize, ...headStyle(big, bigSize), align: 'center', max: W - 2 * mx });
      T(ctx, sub, W / 2, my + bigSize * 0.28 * u + 70 * u, { size: 40, weight: 600, align: 'center', max: W - 2 * mx, alpha: 0.9 });
      ctx.restore();
    }
    /* Заставка серии: знак, имя, и крупно — главное дня (обещание, на которое ответит финал). Текст переносится на 2–3 строки. */
    function hookCard(ctx, a, dy, kicker, text, sub) {
      if (a <= 0.01) return;
      const maxW = W - 2 * mx; let size = (portrait ? 118 : 124) * u, lines = [];
      for (let k = 0; k < 8; k++) {
        ctx.font = `${S.headW} ${size}px ${S.fHead}`; lines = []; let cur = '';
        for (const w of String(text).split(/\s+/)) { const tt = cur ? cur + ' ' + w : w; if (ctx.measureText(tt).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tt; }
        lines.push(cur);
        if (lines.length <= 3 && lines.every((ln) => ctx.measureText(ln).width <= maxW)) break; size *= 0.9;
      }
      const lh = size * 1.12, blockH = lines.length * lh, cy = H * (portrait ? 0.46 : 0.5) + dy, top = cy - blockH / 2, mr = (portrait ? 92 : 78) * u;
      ctx.save(); ctx.globalAlpha = a; if (MARK) drawMark(ctx, MARK, W / 2, top - 120 * u - mr, mr, MCOL, 0); ctx.restore();
      T(ctx, kicker && kicker.toUpperCase(), W / 2, top - 44 * u, { size: 32, weight: 700, color: S.accent, ls: 32 * 0.05, align: 'center', alpha: a, max: maxW });
      lines.forEach((ln, i) => T(ctx, ln, W / 2, top + lh * (i + 0.82), { size: size / u, fam: S.fHead, weight: S.headW, ls: -0.02 * (size / u), align: 'center', alpha: a }));
      T(ctx, sub, W / 2, top + blockH + 62 * u, { size: 40, weight: 600, align: 'center', alpha: a * 0.9, max: maxW });
    }
    function dim(ctx, a, TR) { if (TR || a <= 0.01) return; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = `rgb(${S.scrim.join(',')})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    function fullPhoto(ctx, m, a, k) {
      const e = img(m.url); if (!e.ok || a <= 0.01) return;
      const im = e.img, zk = 1.04 + 0.08 * k, sc = Math.max(W / im.width, H / im.height) * zk;
      const dw = im.width * sc, dh = im.height * sc;
      ctx.save(); ctx.globalAlpha = a;
      ctx.drawImage(im, (W - dw) / 2 + (k - 0.5) * 30 * u, (H - dh) / 2, dw, dh);
      const g = ctx.createLinearGradient(0, H * 0.45, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.72)');
      ctx.fillStyle = g; ctx.fillRect(0, H * 0.45, W, H * 0.55);
      if (m.credit) T(ctx, m.credit, W - mx, H - (portrait ? 250 : 60) * u, { size: 18, weight: 500, color: 'rgba(255,255,255,.7)', align: 'right', shadow: false });
      ctx.restore();
    }

    /* ================= кадр ================= */
    function draw(ctx, t, opts) {
      const LY = (opts && opts.layers) || { map: true, route: true, hud: true };
      const TR = !!(opts && opts.transparent);
      t = clamp(t, 0, duration - 1e-4);
      const c = cam(t), k = Math.pow(2, c.z), left = c.cx * k - ax, top = c.cy * k - ay;
      const X = (p) => p[0] * k - left, Y = (p) => p[1] * k - top;
      const { s, u: su, lt } = shotAt(t);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (TR) ctx.clearRect(0, 0, W, H);
      else if (S.bgGrad) { const g = ctx.createLinearGradient(0, 0, W * 0.5, H); S.bgGrad.forEach((cc, i, a) => g.addColorStop(i / (a.length - 1), cc)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      else { ctx.fillStyle = S.bg; ctx.fillRect(0, 0, W, H); }
      if (J && !TR) J.draw(ctx, t, s, su, lt, TR); else {
      if (LY.map && S.navigator) window.NavigatorGrid.draw(ctx, W, H, u);
      // карта — спокойный фон: без подписей и мелочи
      // на общих планах — только суша, вода и границы; дороги и мелкие реки появляются лишь вблизи
      const close = c.z >= 9.6;
      if (LY.map && S.vec) {
        const theme = { ...S.vec, font: S.fBody, road: close ? S.vec.road : null, rail: close ? S.vec.rail : null, noWaterways: c.z < 7.5 };
        // камера стоит на месте (только лёгкий наезд) — карту не перерисовываем, а берём готовую картинку: кадр в несколько раз дешевле
        const st = window.VMap.stamp(), M = mapCache, still = lastCam && lastCam.cx === c.cx && lastCam.cy === c.cy && !TR;
        if (still && M && M.cx === c.cx && M.cy === c.cy && M.st === st && M.close === close && c.z >= M.z - 1e-9 && c.z - M.z < 0.2) {
          const sc = Math.pow(2, c.z - M.z); ctx.drawImage(M.cv, ax - ax * sc, ay - ay * sc, W * sc, H * sc);
        } else if (still) {
          const cv = (M && M.cv) || document.createElement('canvas'); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
          const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
          window.VMap.draw(g, W, H, { cx: c.cx, cy: c.cy, z: c.z, rot: 0 }, ax, ay, theme, { fills: true, lines: true, labels: false }, lang, u);
          mapCache = { cv, cx: c.cx, cy: c.cy, z: c.z, st, close }; ctx.drawImage(cv, 0, 0);
        } else window.VMap.draw(ctx, W, H, { cx: c.cx, cy: c.cy, z: c.z, rot: 0 }, ax, ay, theme, { fills: !TR, lines: true, labels: false }, lang, u);
        lastCam = c;
      }
      if (!TR && S.paper) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(240,214,160,.12)'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
      if (!TR) { // мягкая виньетка вместо полос
        const g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.75);
        g.addColorStop(0, `rgba(${S.scrim.join(',')},0)`); g.addColorStop(1, `rgba(${S.scrim.join(',')},${S.paper ? 0.45 : 0.6})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // зерно: бумага у «Атласа», плёнка у «Полночи»
        ctx.save(); ctx.globalAlpha = S.paper ? 0.16 : 0.09; ctx.globalCompositeOperation = S.paper ? 'multiply' : 'overlay';
        ctx.fillStyle = ctx.createPattern(grain(), 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
      }

      if (!TR && today.tAt && tzSec != null && !journey.schematic) {
        const hasReveal = shots.find((q) => q.recipe === 'route-reveal'), fr = hasReveal ? (t < hasReveal.t0 ? 0 : todayReveal(t)) : 1;
        const h = hourAt(fr), L = h == null ? null : lightAt(h);
        const fade = OUTRO[s.recipe] ? (shots.indexOf(s) === 0 ? 0 : 1 - smooth(lt / 1.2)) : s.recipe === 'trip-title' || s.recipe === 'day-card' ? smooth((lt - 0.4) / 1.5) : 1;
        if (L && L[3] * fade > 0.005) {
          const k = L[3] * fade;
          ctx.save();
          if (S.paper) { ctx.globalCompositeOperation = 'multiply'; const m = Math.min(1, k * 2.1); ctx.fillStyle = `rgb(${L.slice(0, 3).map((c) => Math.round(255 - (255 - c) * m)).join(',')})`; }
          else { ctx.globalCompositeOperation = L[0] < 100 ? 'multiply' : 'soft-light'; ctx.fillStyle = L[0] < 100 ? `rgb(${L.slice(0, 3).map((c) => Math.round(255 - (255 - c) * Math.min(1, k * 1.6))).join(',')})` : `rgba(${L.slice(0, 3).map(Math.round).join(',')},${Math.min(1, k * 2.4).toFixed(3)})`; }
          ctx.fillRect(0, 0, W, H); ctx.restore();
        }
      }
      if (LY.route) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const poly = (pts, upto, brk) => { ctx.beginPath(); for (let i = 0; i < pts.length && (upto == null || i <= upto); i++) (i && !(brk && brk.has(i))) ? ctx.lineTo(X(pts[i]), Y(pts[i])) : ctx.moveTo(X(pts[i]), Y(pts[i])); };
        // прошлый путь
        let pr = pastReveal(t), upto = null;
        if (pr === -1) {   // пересказ: путь дорисовывается до вехи, у которой сейчас камера
          const r = recapState(s, su); const tgtDay = s.stops && s.stops[r.k] ? s.stops[r.k].h.day : today.day;
          const prevDay = r.k > 0 ? s.stops[r.k - 1].h.day : 0; const f = sine(r.f / 0.32);
          const lim = su > r.seg * (s.stops ? s.stops.length : 0) ? today.day : lerp(prevDay, tgtDay, f);
          upto = -1; for (let i = 0; i < pastDayAt.length; i++) if (pastDayAt[i] <= lim) upto = i;
          pr = 1;
        } else if (pr < 1) { const L = pastCum[pastCum.length - 1] * pr; upto = 0; while (upto < pastFlat.length - 1 && pastCum[upto] < L) upto++; }
        if (pastFlat.length > 1 && pr > 0 && (upto == null || upto > 0)) {
          const glow = s.recipe === 'pullback' ? smooth((su - 0.3) / 0.5) : 0;
          poly(pastFlat, upto, pastBrk);
          if (journey.schematic) ctx.setLineDash([16 * u, 12 * u]);
          ctx.strokeStyle = S.line.glow; ctx.globalAlpha = 0.25 + 0.55 * glow; ctx.lineWidth = S.line.w * 2.2 * u; ctx.stroke();
          ctx.globalAlpha = 0.85; ctx.strokeStyle = S.paper ? S.accent : 'rgba(225,235,255,.85)'; ctx.lineWidth = 4.5 * u; ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]);
          const o = pastFlat[0]; ctx.beginPath(); ctx.arc(X(o), Y(o), 9 * u, 0, 6.2832); ctx.fillStyle = S.paper ? S.accent : '#e8f0ff'; ctx.fill();
        }
        // сегодня
        const tr = todayReveal(t);
        if (tr > 0 && todayPts.length > 1) {
          const L = todayCum[todayCum.length - 1] * tr; let i = 1; while (i < todayCum.length - 1 && todayCum[i] < L) i++;
          const f = (L - todayCum[i - 1]) / Math.max(1e-9, todayCum[i] - todayCum[i - 1]);
          const hx = lerp(todayPts[i - 1][0], todayPts[i][0], f), hy = lerp(todayPts[i - 1][1], todayPts[i][1], f);
          poly(todayPts, i - 1, todayBrk); ctx.lineTo(X([hx, hy]), Y([hx, hy]));
          ctx.strokeStyle = S.line.glow; ctx.lineWidth = S.line.w * 3.2 * u; ctx.stroke();
          const g = ctx.createLinearGradient(X(todayPts[0]), Y(todayPts[0]), X([hx, hy]) + 1, Y([hx, hy]));
          S.line.stops.forEach((cc, j, a) => g.addColorStop(j / (a.length - 1), cc));
          ctx.strokeStyle = g; ctx.lineWidth = S.line.w * 1.25 * u; ctx.stroke();
          const pulse = (t / 2) % 1, X0 = X([hx, hy]), Y0 = Y([hx, hy]);   // спокойный пульс, 2 с
          ctx.beginPath(); ctx.arc(X0, Y0, (18 + 36 * pulse) * u, 0, 6.2832); ctx.fillStyle = S.headHalo; ctx.globalAlpha = 0.7 * (1 - pulse); ctx.fill(); ctx.globalAlpha = 1;
          // старт дня — кольцо в начале линии (финиш отмечает «голова»)
          ctx.beginPath(); ctx.arc(X(todayPts[0]), Y(todayPts[0]), 11 * u, 0, 6.2832); ctx.fillStyle = S.paper ? '#fbf3df' : '#0b1220'; ctx.fill(); ctx.lineWidth = 5 * u; ctx.strokeStyle = S.line.stops[0]; ctx.stroke();
          if (MARK) drawMark(ctx, MARK, X0, Y0, (portrait ? 48 : 44) * u, MCOL, tr * (today.km || 0) * 0.35 + t * 0.6);   // по карте едет знак героя, а не точка
          else { ctx.beginPath(); ctx.arc(X0, Y0, 15 * u, 0, 6.2832); ctx.fillStyle = S.head; ctx.fill(); ctx.lineWidth = 6 * u; ctx.strokeStyle = S.line.stops[S.line.stops.length - 1]; ctx.stroke(); }
        }
        // высшая точка дня
        if (s.recipe === 'high-point' && s.hp) {
          const a = vis(lt, s.durationSec, s.move * s.durationSec * 0.7), hx = X(s.hp), hy = Y(s.hp), pulse = (t / 2) % 1;
          ctx.save(); ctx.globalAlpha = a;
          ctx.beginPath(); ctx.arc(hx, hy, (22 + 40 * pulse) * u, 0, 6.2832); ctx.strokeStyle = S.accent; ctx.lineWidth = 4 * u; ctx.globalAlpha = a * (1 - pulse); ctx.stroke();
          ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(hx, hy - 30 * u); ctx.lineTo(hx + 24 * u, hy + 14 * u); ctx.lineTo(hx - 24 * u, hy + 14 * u); ctx.closePath(); ctx.fillStyle = S.paper ? '#3b2412' : '#ffffff'; ctx.fill(); ctx.lineJoin = 'round'; ctx.lineWidth = 5 * u; ctx.strokeStyle = S.paper ? '#fbf3df' : '#0b1220'; ctx.stroke();
          ctx.restore();
        }
      }
      // места по пути: появляются, когда линия до них дошла, и держатся не меньше ~3 с
      if (LY.hud && s.recipe === 'route-reveal' && s.follow && su >= s.move) {
        const F = s.follow, x = followX(s, su), sec = (v) => v * F.dur;
        const lab = (name, p0, a0) => { if (a0 <= 0.01) return; const wx = X(p0), wy = Y(p0), right = wx < W * 0.56;
          if (wx < 32 * u || wx > W - 32 * u || wy < 32 * u || wy > H - 32 * u) return;
          ctx.save(); ctx.globalAlpha = a0; ctx.beginPath(); ctx.arc(wx, wy, 13 * u, 0, 6.2832); ctx.fillStyle = S.paper ? '#fbf3df' : '#ffffff'; ctx.fill(); ctx.lineWidth = 5 * u; ctx.strokeStyle = S.accent; ctx.stroke(); ctx.restore();
          T(ctx, name, wx + (right ? 62 : -62) * u, wy + 20 * u, { size: portrait ? 64 : 58, fam: S.fHead, weight: S.headW, align: right ? 'left' : 'right', alpha: a0, max: (right ? W - wx : wx) - 60 * u, shadowC: S.paper ? 'rgba(239,230,210,.95)' : 'rgba(4,8,18,.9)' }); };
        if (fromLabel) lab(fromLabel, todayPts[0], smooth(sec(x) / FADE) * (1 - smooth((sec(x) - 2.8) / FADE)));
        F.wps.forEach((q, i) => {
          const nx = F.wps[i + 1] ? F.wps[i + 1].x : 2, hold = clamp(sec(nx - q.x) - 0.3, 2.2, 3.6), dt = sec(x - q.x);
          lab(q.name, q.p, smooth((dt + 0.2) / FADE) * (1 - smooth((dt - hold) / FADE)));
        });
      }
      if (LY.hud && WX && !TR) {
        const onCard = s.recipe === 'weather-card', onRide = s.recipe === 'route-reveal' && s.follow && su >= s.move;
        const a = onCard ? vis(lt, s.durationSec, 0) : onRide ? 0.5 * smooth(((su - s.move) * s.durationSec) / 1.2) * (1 - smooth((su - 0.9) / 0.07)) : 0;
        const col = S.paper ? 'rgba(70,48,30,' : 'rgba(225,238,255,';
        if (a > 0.01 && WX.precip >= 2) streaks(ctx, t, Math.min(1, a * 1.7), 168 + (WX.dir != null ? Math.sin((WX.dir * Math.PI) / 180) * -14 : 0), 1500 * u, 240, 58 * u, S.paper ? 'rgba(60,90,130,' : 'rgba(170,205,255,');
        else if (a > 0.01 && WX.wind >= 3 && WX.dir != null) streaks(ctx, t, a * clamp(WX.wind / 7, 0.5, 1), WX.dir + 180, (260 + WX.wind * 55) * u, 34, (110 + WX.wind * 14) * u, col);
      }
      LT_NO_SCRIM = TR; if (LY.hud) hud(ctx, t, s, su, lt, TR);
      }
      if (journey.schematic) T(ctx, 'Схема по постам канала, пунктир — не GPS-трек', W / 2, H - (S.paper ? 70 : 46) * u, { size: 18, weight: 600, color: S.dim, align: 'center', alpha: 0.75, shadow: false });
      const SIGM = MARK && MARK !== 'dot';
      if (LY.hud && (SIGM || NAME) && shots.length > 1 && t >= shots[0].t1 - 0.3) {
        const sa = smooth((t - (shots[0].t1 - 0.3)) / 0.8), onPh = s.recipe === 'photo-reveal' || s.recipe === 'highlights-reel' || (J && J.isDark(s));
        const sy = H * (portrait ? 0.1 : 0.09), r = 36 * u; ctx.save(); ctx.globalAlpha = sa;
        if (SIGM) drawMark(ctx, MARK, mx + r, sy, r, MCOL, 0);
        ctx.restore();
        if (NAME) T(ctx, NAME, mx + (SIGM ? r * 2 + 14 * u : 0), sy + 13 * u, { size: 38, weight: 700, alpha: sa, color: onPh ? '#ffffff' : S.ink, shadowC: onPh ? 'rgba(0,0,0,.7)' : undefined, max: W * 0.5 });
      }
      T(ctx, S.credit, W / 2, H - (S.paper ? 46 : 22) * u, { size: 15, weight: 500, color: S.dim, align: 'center', alpha: 0.55, shadow: false });
      ctx.restore();
    }

    function hud(ctx, t, s, su, lt, TR) {
      const dur = s.durationSec, p = s.params || {}, a = vis(lt, dur), dy = rise(lt);
      const loopDay = !!today.loop;
      const route2 = loopDay ? [fromLabel || toLabel, 'кольцо'].filter(Boolean).join(' · ') : [fromLabel, toLabel].filter(Boolean).join(' → ');
      switch (s.recipe) {
        case 'day-card':
          dim(ctx, 0.5 * vis(lt, dur, 0), TR);
          if (p.hook) hookCard(ctx, a, dy, ['день ' + p.day, route2].filter(Boolean).join(' · '), p.hook, NAME);
          else hookCard(ctx, a, dy, route2 || journey.title, 'День ' + p.day, NAME);
          break;
        case 'trip-title': {
          dim(ctx, 0.5 * vis(lt, dur, 0), TR);
          const head = p.from && p.to && p.from !== p.to && !loopDay ? `${p.from} → ${p.to}` : p.to || p.from || p.name || journey.title || 'Маршрут';
          const kmS = (loopDay && head.toLowerCase() !== 'кольцо' ? 'кольцо · ' : '') + fmtN(p.km, p.km < 100 ? 1 : 0) + ' км';
          if (p.hook) hookCard(ctx, a, dy, [dateRu(p.date), head].filter(Boolean).join(' · '), p.hook, NAME);
          else hookCard(ctx, a, dy, dateRu(p.date) || 'маршрут', head, [kmS, NAME].filter(Boolean).join('  ·  '));
          break;
        }
        case 'day-summary': {
          dim(ctx, 0.5 * smooth((lt - 0.3) / FADE), TR);
          const head = loopDay ? route2 || 'кольцо' : p.from && p.to && p.from !== p.to ? `${p.from} → ${p.to}` : p.to || p.from || p.name || 'итог';
          const sub = [p.time, p.gain ? '+' + fmtN(p.gain) + ' м' : null, p.time || p.gain ? null : dateRu(p.date)].filter(Boolean).join('  ·  ');
          centerTitle(ctx, smooth((lt - 0.5) / FADE), rise(lt, 0.5), head, fmtN(p.km, p.km < 100 ? 1 : 0) + ' км', [sub, PF.next ? 'дальше — ' + PF.next : ''].filter(Boolean).join('  ·  '), 200);
          break;
        }
        case 'weather-card':
          lowerThird(ctx, a, dy, 'погода в тот день', p.head, p.sub);
          if (p.src) T(ctx, 'Погода: ' + p.src, W - mx, H - (portrait ? 250 : 60) * u, { size: 18, weight: 500, color: S.dim, align: 'right', shadow: false, alpha: a * 0.8 });
          break;
        case 'time-on-road':
          lowerThird(ctx, a, dy, 'в пути', p.text, 'средняя скорость ' + fmtN(p.avgKmh, 1) + ' км/ч');
          break;
        case 'high-point':
          lowerThird(ctx, vis(lt, dur, s.move * dur * 0.7), rise(lt, s.move * dur * 0.7), 'высшая точка дня', fmtN(p.ele) + ' м', p.km != null ? `на ${fmtN(p.km)}-м километре` : '');
          break;
        case 'season-card':
          dim(ctx, 0.5 * vis(lt, dur, 0), TR);
          hookCard(ctx, a, dy, NAME || p.traveler || 'история путешествия', p.title || '', p.line || `${p.days} ${daysWord(p.days)} · ${fmtN(p.totalKm)} км`);
          break;
        case 'progress-overview':
          lowerThird(ctx, vis(lt, dur, 0.6), rise(lt, 0.6), 'путь до сегодня', fmtN(p.totalKm) + ' км', `${p.days} ${daysWord(p.days)}${origin ? ' · от ' + origin.label : ''}`);
          break;
        case 'overview-to-detail':
          lowerThird(ctx, a, dy, 'сегодня · день ' + today.day, today.date ? new Date(today.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }) : 'новый день', route2);
          break;
        case 'route-reveal': case 'camera-follow': {
          const km = p.km * todayReveal(t);
          const d0 = s.move * dur * (s.follow ? 1 : 0.85);   // титр — когда маршрут начинает рисоваться
          const frNow = todayReveal(t), ck = [clockAt(frNow), tempAt(frNow)].filter(Boolean).join(' · ');
          lowerThird(ctx, vis(lt, dur, d0), rise(lt, d0), (single ? 'пройдено' : 'день ' + today.day) + (ck ? ' · ' + ck : ''), (single ? '' : '+') + fmtN(km, km < 100 ? 1 : 0) + ' км', route2 || 'новый участок');
          break;
        }
        case 'checkpoint-arrival':
          lowerThird(ctx, a, dy, p.kind === 'milestone' ? 'веха' : p.kind === 'chapter' ? 'новая глава' : loopDay ? 'круг замкнулся' : 'прибытие', p.label, p.kind === 'milestone' ? 'на пути' : single ? (dateRu(today.date) || '') : 'день ' + today.day);
          break;
        case 'photo-reveal': case 'highlights-reel': {
          const ids = (p.mediaIds || []).filter((id) => mediaById[id]), n = ids.length; if (!n) break;
          const slot = dur / n;
          ids.forEach((id, i) => {
            const st = i * slot, l2 = lt - st, m = mediaById[id];
            if (l2 < 0) return;
            const aIn = smooth(l2 / (i === 0 ? 0.8 : 0.7)), aOut = i === n - 1 ? 1 - smooth((lt - (dur - 0.8)) / 0.8) : 1;
            fullPhoto(ctx, m, aIn * aOut, clamp(l2 / (slot + 0.7), 0, 1));
            const capA = smooth((l2 - 0.5) / FADE) * (1 - smooth((l2 - (slot - FADE - 0.1)) / FADE)) * aOut;
            lowerThird(ctx, capA, rise(l2, 0.5), DL(s.recipe === 'highlights-reel' ? m.day : today.day), m.caption || toLabel || '', '', true);
          });
          break;
        }
        case 'note-card': {
          dim(ctx, 0.55 * vis(lt, dur, 0), TR);
          const txt = p.text || '';
          ctx.save(); ctx.globalAlpha = a;
          const size = (portrait ? 96 : 84) * u; ctx.font = `400 ${size}px ${HAND}`;
          const words = ('«' + txt + '»').split(/\s+/), lines = []; let cur = '';
          for (const w of words) { const tt = cur ? cur + ' ' + w : w; if (ctx.measureText(tt).width > W - 2 * mx && cur) { lines.push(cur); cur = w; } else cur = tt; }
          lines.push(cur);
          T(ctx, 'из дневника · день ' + today.day, W / 2, H * 0.45 - lines.length * size * 0.55 - 40 * u + dy, { size: 30, weight: 700, color: S.accent, ls: 8, align: 'center' });
          lines.forEach((ln, i) => T(ctx, ln, W / 2, H * 0.45 + (i - (lines.length - 1) / 2) * size * 1.1 + dy, { size: size / u, fam: HAND, weight: 400, align: 'center', color: S.paper ? '#3b2412' : '#fffbea' }));
          ctx.restore();
          break;
        }
        case 'location-card':
          lowerThird(ctx, a, dy, `${Math.abs(p.lat).toFixed(2)}° ${p.lat >= 0 ? 'с. ш.' : 'ю. ш.'} · ${Math.abs(p.lon).toFixed(2)}° ${p.lon >= 0 ? 'в. д.' : 'з. д.'}`, p.label || 'здесь', 'день ' + today.day);
          break;
        case 'distance-counter': {
          const km = p.newKm * sine(lt / 1.4);
          lowerThird(ctx, a, dy, 'за день', '+' + fmtN(km, km < 100 ? 1 : 0) + ' км', 'всего ' + fmtN(p.totalKm) + ' км');
          break;
        }
        case 'elevation-profile': {
          const pr = p.profile;
          if (pr && pr.length >= 8) {
            // профиль дня: график рисуется слева направо, вершина подписана
            dim(ctx, 0.84 * vis(lt, dur, 0), TR);
            const x0 = mx, x1 = W - mx, hh = (portrait ? 430 : 300) * u, yb = H * (portrait ? 0.56 : 0.6);
            const lo = Math.min(...pr), hi = Math.max(...pr), sp = Math.max(1, hi - lo);
            const PX = (i) => x0 + ((x1 - x0) * i) / (pr.length - 1), PY = (e) => yb - ((e - lo) / sp) * hh;
            const g = sine(lt / (dur * 0.5)) * (pr.length - 1), gi = Math.floor(g), gf = g - gi;
            const ex = gi >= pr.length - 1 ? PX(pr.length - 1) : lerp(PX(gi), PX(gi + 1), gf), ey = gi >= pr.length - 1 ? PY(pr[pr.length - 1]) : lerp(PY(pr[gi]), PY(pr[gi + 1]), gf);
            ctx.save(); ctx.globalAlpha = vis(lt, dur, 0);
            ctx.beginPath(); ctx.moveTo(x0, PY(pr[0])); for (let i = 1; i <= Math.min(gi, pr.length - 1); i++) ctx.lineTo(PX(i), PY(pr[i])); ctx.lineTo(ex, ey);
            ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = S.line.stops[S.line.stops.length - 1]; ctx.lineWidth = 9 * u; ctx.stroke();
            ctx.lineTo(ex, yb + 24 * u); ctx.lineTo(x0, yb + 24 * u); ctx.closePath();
            const fg = ctx.createLinearGradient(0, yb - hh, 0, yb + 24 * u); const lc = S.line.stops[S.line.stops.length - 1]; fg.addColorStop(0, lc); fg.addColorStop(1, S.paper ? 'rgba(239,230,210,0)' : 'rgba(4,8,18,0)'); ctx.globalAlpha *= 0.28; ctx.fillStyle = fg; ctx.fill();
            ctx.restore();
            const mi = pr.indexOf(hi);
            if (p.maxEle != null && g >= mi) {
              const ma = smooth((g - mi) / 3) * vis(lt, dur, 0), tx = clamp(PX(mi), mx + 150 * u, W - mx - 150 * u);
              ctx.save(); ctx.globalAlpha = ma; ctx.beginPath(); ctx.arc(PX(mi), PY(hi), 12 * u, 0, 6.2832); ctx.fillStyle = S.head; ctx.fill(); ctx.restore();
              T(ctx, fmtN(p.maxEle) + ' м', tx, PY(hi) - 34 * u, { size: 54, fam: S.fNum, weight: S.numW, align: 'center', alpha: ma });
            }
          }
          lowerThird(ctx, a, dy, 'набор высоты', '+' + fmtN(p.gain) + ' м', pr ? 'рельеф дня' : 'за день ' + today.day);
          break;
        }
        case 'day-barcode': {
          dim(ctx, 0.6 * vis(lt, dur, 0), TR);
          const n = days.length, bw = W - 2 * mx, h = (portrait ? 520 : 330) * u, by = H * (portrait ? 0.56 : 0.6), step = bw / n, w = Math.max(3 * u, step * 0.64);
          ctx.save(); ctx.globalAlpha = vis(lt, dur, 0);
          days.forEach((d, i) => {
            const grow = sine(lt / 1.8 - (i / n) * 0.5), rest = d.km < 1, isT = d.day === today.day;
            const hh = rest ? 8 * u : Math.max(8 * u, (d.km / maxKm) * h * grow);
            ctx.fillStyle = isT ? S.head : rest ? S.ghost : S.paper ? 'rgba(124,45,18,.75)' : 'rgba(180,205,255,.8)';
            ctx.fillRect(mx + i * step + (step - w) / 2, by - hh, w, hh);
          });
          ctx.restore();
          lowerThird(ctx, vis(lt, dur, 0.8), rise(lt, 0.8), 'день за днём', `${n} ${daysWord(n)}`, 'высота столбика — километры за день');
          break;
        }
        case 'pullback': case 'progress-poster': {
          const pa = s.recipe === 'pullback' ? smooth((su - 0.62) / 0.18) * (1 - smooth((lt - (dur - 0.4)) / 0.4)) : a;
          const NEXT = PF.next ? 'дальше — ' + PF.next : 'продолжение следует →';
          const dayRes = p.newKm != null ? ['день ' + p.day, '+' + fmtN(p.newKm, p.newKm < 100 ? 1 : 0) + ' км', p.time].filter(Boolean).join(' · ') : 'день ' + p.day;
          lowerThird(ctx, pa, s.recipe === 'pullback' ? (1 - smooth((su - 0.62) / 0.25)) * 26 * u : dy, journey.schematic ? 'и путь продолжается' : dayRes, kmText(p.totalKm), journey.schematic ? (journey.totalKmNote || '') : NEXT);
          break;
        }
        case 'journey-recap': {
          const r = recapState(s, su); const st = s.stops[r.k]; if (!st) break;
          const ca = smooth((r.f - 0.3) / 0.12) * (1 - smooth((r.f - 0.88) / 0.1));   // ~3 с титра на каждую веху
          lowerThird(ctx, ca, (1 - smooth((r.f - 0.3) / 0.2)) * 26 * u, DL(st.h.day), st.h.label, (journey.dayNotes && journey.dayNotes[st.h.day]) || '');
          break;
        }
        default: break;
      }
    }

    /* ================= «Дневник»: страница вместо карты ================= */
    let J = null;
    if (S.journal && window.Journal) {
      const loopDay = !!today.loop;
      const route2T = () => (loopDay ? [fromLabel || toLabel, 'кольцо'].filter(Boolean).join(' · ') : [fromLabel, toLabel].filter(Boolean).join(' → '));
      const famOf = (s) => window.Journal.FAM[s.recipe] || 'road';
      const NEXT = () => (PF.next ? 'Дальше — ' + PF.next : 'Продолжение следует →');
      const bridge = {
        W, H, u, portrait, S, HAND, MARK, MCOL, NAME, drawMark, journey, today, days, maxKm, mediaById, img, DL, fmtN, daysWord, toLabel, vis,
        get WX() { return WX; },
        run: (s) => { const i = shots.indexOf(s), f = famOf(s); let a = i, b = i; while (a > 0 && famOf(shots[a - 1]) === f) a--; while (b < shots.length - 1 && famOf(shots[b + 1]) === f) b++; return { t0: shots[a].t0, t1: shots[b].t1 }; },
        todaySet: () => ({ pts: todayPts, brk: todayBrk, cum: todayCum, today: true }),
        allSets: () => dayPts.map((d) => ({ pts: d.pts, brk: d.brk, cum: d.day === today.day ? todayCum : null, today: d.day === today.day })),
        reveal: (t) => todayReveal(t),
        routeNames: () => route2T() || journey.title || '',
        journeyName: () => journey.title || route2T() || '',
        recapPoint: (s, lt, dur) => { const r = recapState(s, lt / dur), st = s.stops[r.k]; return st ? [st.cam.cx, st.cam.cy] : null; },
        photoDate: (m, s) => (journey.schematic || s.recipe === 'highlights-reel' ? DL(m.day) : [DL(today.day), dateRu(today.date)].filter(Boolean).join(' · ')),
        dateLine: (s, p) => (journey.schematic ? (journey.dayLabels && journey.dayLabels[p && p.day != null ? p.day : today.day]) || '' : dateRu(today.date)),
        kindWord: (s, p) => (s.recipe === 'location-card' ? 'здесь' : p.kind === 'milestone' ? 'веха' : p.kind === 'chapter' ? 'новая глава' : loopDay ? 'круг замкнулся' : 'прибытие'),
        arrivalLabel: (s, p) => (s.recipe === 'location-card' ? p.label || 'здесь' : p.label),
        countryOf: (s, p) => (journey.dayNotes && journey.dayNotes[p && p.day != null ? p.day : today.day]) || today.country || null,
        coverTexts: (s, p) => {
          const route2 = route2T();
          if (s.recipe === 'day-card') return p.hook ? { from: ['день ' + p.day, route2].filter(Boolean).join(' · '), to: p.hook, small: true } : { from: route2 || journey.title || '', to: 'День ' + p.day, small: false };
          if (s.recipe === 'trip-title') {
            const pair = p.from && p.to && p.from !== p.to && !loopDay, head = pair ? `${p.from} → ${p.to}` : p.to || p.from || p.name || journey.title || 'Маршрут';
            if (p.hook) return { from: [dateRu(p.date), head].filter(Boolean).join(' · '), to: p.hook, small: true };
            return pair ? { from: p.from, to: p.to, small: false } : { from: dateRu(p.date) || 'маршрут', to: head, small: false };
          }
          return { from: p.line || NAME || p.traveler || 'история путешествия', to: p.title || '', small: false };
        },
        metric: (s, p, t, lt, dur) => {
          const route2 = route2T();
          switch (s.recipe) {
            case 'route-reveal': case 'camera-follow': { const fr = todayReveal(t), km = p.km * fr, ck = [clockAt(fr), tempAt(fr)].filter(Boolean).join(' · '); return { kicker: (single ? 'пройдено' : 'день ' + today.day) + (ck ? ' · ' + ck : ''), big: (single ? '' : '+') + fmtN(km, km < 100 ? 1 : 0) + ' км', sub: route2 || 'новый участок' }; }
            case 'weather-card': return { kicker: 'погода в тот день', big: p.head, sub: [p.sub, p.src ? 'Погода: ' + p.src : ''].filter(Boolean).join(' · ') };
            case 'time-on-road': return { kicker: 'в пути', big: p.text, sub: 'средняя скорость ' + fmtN(p.avgKmh, 1) + ' км/ч' };
            case 'high-point': return { kicker: 'высшая точка дня', big: fmtN(p.ele) + ' м', sub: p.km != null ? `на ${fmtN(p.km)}-м километре` : '' };
            case 'distance-counter': { const km = p.newKm * sine(lt / 1.4); return { kicker: 'за день', big: '+' + fmtN(km, km < 100 ? 1 : 0) + ' км', sub: 'всего ' + fmtN(p.totalKm) + ' км' }; }
            case 'overview-to-detail': return { kicker: 'сегодня · день ' + today.day, big: today.date ? new Date(today.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }) : 'новый день', sub: route2 };
            case 'progress-overview': return { kicker: 'путь до сегодня', big: fmtN(p.totalKm) + ' км', sub: `${p.days} ${daysWord(p.days)}${origin ? ' · от ' + origin.label : ''}` };
            case 'journey-recap': { const r = recapState(s, lt / dur), st = s.stops[r.k]; return st ? { kicker: DL(st.h.day), big: st.h.label, sub: (journey.dayNotes && journey.dayNotes[st.h.day]) || '' } : null; }
            default: return null;
          }
        },
        finale: (s, p) => {
          if (s.recipe === 'day-summary') {
            const head = loopDay ? route2T() || 'кольцо' : p.from && p.to && p.from !== p.to ? `${p.from} → ${p.to}` : p.to || p.from || p.name || 'итог';
            return { kicker: head, big: fmtN(p.km, p.km < 100 ? 1 : 0) + ' км', sub: [p.time, p.gain ? '+' + fmtN(p.gain) + ' м' : null, p.time || p.gain ? null : dateRu(p.date)].filter(Boolean).join(' · '), next: NEXT() };
          }
          const dayRes = p.newKm != null ? ['день ' + p.day, '+' + fmtN(p.newKm, p.newKm < 100 ? 1 : 0) + ' км', p.time].filter(Boolean).join(' · ') : 'день ' + p.day;
          return { kicker: journey.schematic ? 'и путь продолжается' : dayRes, big: kmText(p.totalKm), sub: journey.schematic ? journey.totalKmNote || '' : '', next: NEXT() };
        },
      };
      J = window.Journal.create(bridge);
      const base = assetsReady; assetsReady = Promise.all([base, J.ready]);
    }

    return { draw, tilesAt, cam, duration, W, H, get assetsReady() { return assetsReady; }, plan, events: [] };
  }

  window.Episode = { createEpisodeScene };
})();
