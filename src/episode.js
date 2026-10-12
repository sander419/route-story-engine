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
  const imgCache = new Map();
  function img(url) {
    let e = imgCache.get(url);
    if (!e) { e = { ok: false, img: null }; e.p = new Promise((res) => { const im = new Image(); im.onload = () => { e.ok = true; e.img = im; res(); }; im.onerror = () => res(); im.src = url; }); imgCache.set(url, e); }
    return e;
  }

  function createEpisodeScene({ journey, plan, styleId, lang = 'ru' }, W, H) {
    const S = window.RS.STYLES[styleId] || window.RS.STYLES.night;
    const u = Math.min(W, H) / 1080, portrait = H > W, mx = (portrait ? 72 : 110) * u;
    const ax = W / 2, ay = portrait ? H * 0.44 : H * 0.47;
    const days = [...journey.days].sort((a, b) => a.day - b.day);
    const today = days.find((d) => d.day === plan.episodeNumber) || days[days.length - 1];
    const P = (d) => d.line.map(([lo, la]) => [px(lo), py(la)]);
    const dayPts = days.map((d) => ({ day: d.day, pts: P(d) }));
    const todayPts = P(today);
    const past = dayPts.filter((d) => d.day < today.day);
    const pastFlat = past.flatMap((d) => d.pts);
    const pastDayAt = []; past.forEach((d) => d.pts.forEach(() => pastDayAt.push(d.day)));
    const cum = (pts) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; };
    const pastCum = cum(pastFlat), todayCum = cum(todayPts);
    const allPts = dayPts.flatMap((d) => d.pts);
    const maxKm = Math.max(1, ...days.map((d) => d.km));
    const mediaById = Object.fromEntries((journey.media || []).map((m) => [m.id, m]));
    const cps = journey.checkpoints || [];
    const origin = cps.find((c) => c.kind === 'origin');
    const prevStop = [...cps].filter((c) => c.day < today.day && (c.kind === 'city' || c.kind === 'origin' || c.kind === 'country')).pop();
    const fromLabel = today.from || (prevStop ? prevStop.label : null), toLabel = today.to || null;
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
      'trip-title': 'journey', 'day-summary': 'journey', 'time-on-road': 'segment', 'high-point': 'high',
      'day-card': 'journey', 'season-card': 'journey', 'progress-overview': 'journey', 'overview-to-detail': 'segment', 'route-reveal': 'segment',
      'camera-follow': 'segment', 'checkpoint-arrival': 'end', 'photo-reveal': 'end', 'note-card': 'end', 'location-card': 'end', 'distance-counter': 'segment',
      'day-barcode': null, 'elevation-profile': 'segment', 'pullback': 'journey', 'progress-poster': 'journey', 'journey-recap': 'journey', 'highlights-reel': null,
    };
    const shots = plan.beats.map((b) => ({ ...b, t0: b.startSec, t1: b.startSec + b.durationSec }));
    const duration = plan.durationSec;
    // цепочка: каждый кадр начинается там, где закончился предыдущий
    let prevEnd = { ...CAM.journey, z: CAM.journey.z - 0.25 };
    for (const s of shots) {
      s.camFrom = prevEnd;
      const tg = TARGET[s.recipe];
      if (tg === 'high' && s.params.at) { s.hp = [px(s.params.at[0]), py(s.params.at[1])]; s.camTo = { cx: s.hp[0], cy: s.hp[1], z: Math.min(CAM.segment.z + 1.2, 13) }; }
      else s.camTo = tg && CAM[tg] ? CAM[tg] : prevEnd;
      if (s.recipe === 'route-reveal') {
        // места по пути: линия идёт от места к месту с мягкой остановкой, подпись держится до следующего места
        const total = todayCum[todayCum.length - 1] || 1;
        const wps = (s.params.waypoints || []).map((w) => {
          const q = [px(w.lon), py(w.lat)]; let bi = 0, bd = Infinity;
          todayPts.forEach((pt, i) => { const d = Math.hypot(pt[0] - q[0], pt[1] - q[1]); if (d < bd) { bd = d; bi = i; } });
          return { name: w.name, p: todayPts[bi], frac: todayCum[bi] / total };
        }).filter((w) => w.frac > 0.06 && w.frac < 0.94).sort((a, b) => a.frac - b.frac);
        if (wps.length) {
          const fr = [0, ...wps.map((w) => w.frac), 1], share = [];
          for (let i = 1; i < fr.length; i++) share.push(Math.max(fr[i] - fr[i - 1], 0.6 / (fr.length - 1)));   // короткий отрезок не проскакивает
          const sum = share.reduce((a, b) => a + b, 0); let acc = 0;
          s.knots = [{ f: 0, x: 0 }, ...share.map((sh, i) => { acc += sh / sum; return { f: fr[i + 1], x: acc }; })];
          s.wps = wps;
        }
      }
      // время перелёта зависит от его дальности: ~0,45 с на каждый уровень приближения (без рывков)
      const dz = Math.abs(s.camTo.z - s.camFrom.z), far = Math.hypot(s.camTo.cx - s.camFrom.cx, s.camTo.cy - s.camFrom.cy) * Math.pow(2, Math.max(s.camTo.z, s.camFrom.z)) / Math.max(W, H);
      const moveSec = clamp(1 + 0.45 * dz + 0.3 * Math.min(far, 4), 1.2, s.durationSec * (s.recipe === 'pullback' ? 0.78 : s.recipe === 'overview-to-detail' ? 0.88 : 0.62));
      s.move = clamp(moveSec / s.durationSec, 0.15, 0.9);
      if (s.recipe === 'journey-recap') {
        const hist = (s.params.history || []).filter((h) => dayEnd(h.day));
        s.stops = hist.map((h) => { const p = dayEnd(h.day); return { h, cam: { cx: p[0], cy: p[1], z: Math.min(CAM.journey.z + 1.8, 9) } }; });
        s.camTo = CAM.journey;
      }
      prevEnd = s.recipe === 'journey-recap' ? s.camTo : { ...s.camTo, z: s.camTo.z + 0.08 };   // учитываем дрейф — следующий кадр стартует ровно отсюда
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
      const c = glide(s.camFrom, s.camTo, sine(uu / s.move));
      return { ...c, z: c.z + 0.08 * smooth((uu - s.move) / (1 - s.move)) };   // мягкий дрейф после движения
    }
    function todayReveal(t) {
      const s = shots.find((x) => x.recipe === 'route-reveal' || x.recipe === 'camera-follow');
      if (!s) return 1; if (t < s.t0) return 0; if (t >= s.t1) return 1;
      const x = revealX(s, t);
      if (!s.knots) return sine(x);   // рисуем, когда камера уже прилетела
      let i = 1; while (i < s.knots.length - 1 && x > s.knots[i].x) i++;
      const a = s.knots[i - 1], b = s.knots[i];
      return lerp(a.f, b.f, sine((x - a.x) / Math.max(1e-6, b.x - a.x)));
    }
    const revealX = (s, t) => clamp(((t - s.t0) / s.durationSec - s.move * 0.85) / (0.95 - s.move * 0.85), 0, 1);
    function pastReveal(t) {
      const po = shots.find((x) => x.recipe === 'progress-overview');
      if (po) { if (t < po.t0) return 0; return sine(clamp((t - po.t0) / (po.durationSec * 0.8), 0, 1)); }
      const jr = shots.find((x) => x.recipe === 'journey-recap');
      if (jr) { if (t < jr.t0) return 0; if (t >= jr.t1) return 1; return -1; }   // -1: по вехам пересказа
      return 1;
    }

    const tilesAt = (t) => (S.vec ? window.VMap.tilesAt(cam(t), ax, ay, W, H) : []);
    const allMediaIds = [...new Set(shots.flatMap((s) => s.params.mediaIds || []))];
    const assetsReady = Promise.all(allMediaIds.map((id) => (mediaById[id] ? img(mediaById[id].url).p : Promise.resolve())));

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
    let LT_NO_SCRIM = false;
    const HAND = '"Caveat", "Segoe Print", cursive';
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
      T(ctx, kicker && kicker.toUpperCase(), mx, ky, { size: ks, weight: 700, color: S.accent, ls: 6, max: maxW, shadow: !!onPhoto, shadowC: sh });
      T(ctx, title, mx, ty, { size: ts, fam: S.fHead, weight: S.headW, max: maxW, color: ink, shadowC: sh, shadow: !!onPhoto });
      if (sub) T(ctx, sub, mx, base, { size: ss, weight: 500, color: dimC, max: maxW, shadowC: sh, shadow: !!onPhoto });
      ctx.restore();
    }
    function centerTitle(ctx, a, dy, kicker, big, sub, bigSize) {
      if (a <= 0.01) return;
      const my = H * (portrait ? 0.45 : 0.47) + dy;
      ctx.save(); ctx.globalAlpha = a;
      T(ctx, kicker && kicker.toUpperCase(), W / 2, my - bigSize * 0.62 * u, { size: 34, weight: 700, color: S.accent, ls: 14, align: 'center' });
      T(ctx, big, W / 2, my + bigSize * 0.28 * u, { size: bigSize, fam: S.fHead, weight: S.headW, align: 'center', max: W - 2 * mx });
      T(ctx, sub, W / 2, my + bigSize * 0.28 * u + 70 * u, { size: 40, weight: 600, align: 'center', max: W - 2 * mx, alpha: 0.9 });
      ctx.restore();
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
      // карта — спокойный фон: без подписей и мелочи
      // на общих планах — только суша, вода и границы; дороги и мелкие реки появляются лишь вблизи
      const close = c.z >= 9.6;
      if (LY.map && S.vec) window.VMap.draw(ctx, W, H, { cx: c.cx, cy: c.cy, z: c.z, rot: 0 }, ax, ay, { ...S.vec, font: S.fBody, road: close ? S.vec.road : null, rail: close ? S.vec.rail : null, noWaterways: c.z < 7.5 }, { fills: !TR, lines: true, labels: false }, lang, u);
      if (!TR && S.paper) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(240,214,160,.12)'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
      if (!TR) { // мягкая виньетка вместо полос
        const g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.75);
        g.addColorStop(0, `rgba(${S.scrim.join(',')},0)`); g.addColorStop(1, `rgba(${S.scrim.join(',')},${S.paper ? 0.45 : 0.6})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // зерно: бумага у «Атласа», плёнка у «Полночи»
        ctx.save(); ctx.globalAlpha = S.paper ? 0.16 : 0.09; ctx.globalCompositeOperation = S.paper ? 'multiply' : 'overlay';
        ctx.fillStyle = ctx.createPattern(grain(), 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
      }

      if (LY.route) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const poly = (pts, upto) => { ctx.beginPath(); for (let i = 0; i < pts.length && (upto == null || i <= upto); i++) i ? ctx.lineTo(X(pts[i]), Y(pts[i])) : ctx.moveTo(X(pts[i]), Y(pts[i])); };
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
          poly(pastFlat, upto);
          if (journey.schematic) ctx.setLineDash([16 * u, 12 * u]);
          ctx.strokeStyle = S.line.glow; ctx.globalAlpha = 0.25 + 0.55 * glow; ctx.lineWidth = S.line.w * 2.2 * u; ctx.stroke();
          ctx.globalAlpha = 0.85; ctx.strokeStyle = S.paper ? 'rgba(124,45,18,.8)' : 'rgba(225,235,255,.85)'; ctx.lineWidth = 4.5 * u; ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]);
          const o = pastFlat[0]; ctx.beginPath(); ctx.arc(X(o), Y(o), 9 * u, 0, 6.2832); ctx.fillStyle = S.paper ? '#7c2d12' : '#e8f0ff'; ctx.fill();
        }
        // сегодня
        const tr = todayReveal(t);
        if (tr > 0 && todayPts.length > 1) {
          const L = todayCum[todayCum.length - 1] * tr; let i = 1; while (i < todayCum.length - 1 && todayCum[i] < L) i++;
          const f = (L - todayCum[i - 1]) / Math.max(1e-9, todayCum[i] - todayCum[i - 1]);
          const hx = lerp(todayPts[i - 1][0], todayPts[i][0], f), hy = lerp(todayPts[i - 1][1], todayPts[i][1], f);
          poly(todayPts, i - 1); ctx.lineTo(X([hx, hy]), Y([hx, hy]));
          ctx.strokeStyle = S.line.glow; ctx.lineWidth = S.line.w * 3.2 * u; ctx.stroke();
          const g = ctx.createLinearGradient(X(todayPts[0]), Y(todayPts[0]), X([hx, hy]) + 1, Y([hx, hy]));
          S.line.stops.forEach((cc, j, a) => g.addColorStop(j / (a.length - 1), cc));
          ctx.strokeStyle = g; ctx.lineWidth = S.line.w * 1.25 * u; ctx.stroke();
          const pulse = (t / 2) % 1, X0 = X([hx, hy]), Y0 = Y([hx, hy]);   // спокойный пульс, 2 с
          ctx.beginPath(); ctx.arc(X0, Y0, (18 + 36 * pulse) * u, 0, 6.2832); ctx.fillStyle = S.headHalo; ctx.globalAlpha = 0.7 * (1 - pulse); ctx.fill(); ctx.globalAlpha = 1;
          // старт дня — кольцо в начале линии (финиш отмечает «голова»)
          ctx.beginPath(); ctx.arc(X(todayPts[0]), Y(todayPts[0]), 11 * u, 0, 6.2832); ctx.fillStyle = S.paper ? '#fbf3df' : '#0b1220'; ctx.fill(); ctx.lineWidth = 5 * u; ctx.strokeStyle = S.line.stops[0]; ctx.stroke();
          ctx.beginPath(); ctx.arc(X0, Y0, 15 * u, 0, 6.2832); ctx.fillStyle = S.head; ctx.fill(); ctx.lineWidth = 6 * u; ctx.strokeStyle = S.line.stops[S.line.stops.length - 1]; ctx.stroke();
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
      // места по пути: появляются, когда линия до них дошла
      if (LY.hud && s.recipe === 'route-reveal' && s.wps) {
        const x = revealX(s, t), span = (0.95 - s.move * 0.85) * s.durationSec;
        if (fromLabel) {
          const a0 = smooth((x * span - 0.1) / FADE) * smooth(((s.knots[1].x - x) * span + 0.1) / FADE);
          if (a0 > 0.01) { const p0 = todayPts[0], wx = X(p0), wy = Y(p0), right = wx < W * 0.56; T(ctx, fromLabel, wx + (right ? 30 : -30) * u, wy + 20 * u, { size: portrait ? 62 : 56, fam: S.fHead, weight: S.headW, align: right ? 'left' : 'right', alpha: a0, max: (right ? W - wx : wx) - 60 * u }); }
        }
        s.wps.forEach((w, i) => {
          const tIn = (x - s.knots[i + 1].x) * span, tOut = (s.knots[i + 2].x - x) * span;   // от прибытия до следующего места
          const a = smooth((tIn + 0.25) / FADE) * smooth((tOut + 0.1) / FADE);
          if (a <= 0.01) return;
          const wx = X(w.p), wy = Y(w.p), right = wx < W * 0.56;
          ctx.save(); ctx.globalAlpha = a;
          ctx.beginPath(); ctx.arc(wx, wy, 13 * u, 0, 6.2832); ctx.fillStyle = S.paper ? '#fbf3df' : '#ffffff'; ctx.fill(); ctx.lineWidth = 5 * u; ctx.strokeStyle = S.accent; ctx.stroke();
          T(ctx, w.name, wx + (right ? 34 : -34) * u, wy + 20 * u, { size: portrait ? 62 : 56, fam: S.fHead, weight: S.headW, align: right ? 'left' : 'right', max: (right ? W - wx : wx) - 60 * u });
          ctx.restore();
        });
      }

      LT_NO_SCRIM = TR; if (LY.hud) hud(ctx, t, s, su, lt, TR);
      if (journey.schematic) T(ctx, 'Схема по постам канала, пунктир — не GPS-трек', W / 2, H - (S.paper ? 70 : 46) * u, { size: 18, weight: 600, color: S.dim, align: 'center', alpha: 0.75, shadow: false });
      T(ctx, S.credit, W / 2, H - (S.paper ? 46 : 22) * u, { size: 15, weight: 500, color: S.dim, align: 'center', alpha: 0.55, shadow: false });
      ctx.restore();
    }

    function hud(ctx, t, s, su, lt, TR) {
      const dur = s.durationSec, p = s.params || {}, a = vis(lt, dur), dy = rise(lt);
      const route2 = [fromLabel, toLabel].filter(Boolean).join(' → ');
      switch (s.recipe) {
        case 'day-card':
          dim(ctx, 0.5 * vis(lt, dur, 0), TR);
          centerTitle(ctx, a, dy, 'день', String(p.day), route2 || journey.title, 240);
          break;
        case 'trip-title': {
          dim(ctx, 0.5 * vis(lt, dur, 0), TR);
          const head = p.from && p.to && p.from !== p.to ? `${p.from} → ${p.to}` : p.to || p.from || p.name || journey.title || 'Маршрут';
          centerTitle(ctx, a, dy, dateRu(p.date) || 'маршрут', head, fmtN(p.km, p.km < 100 ? 1 : 0) + ' км', portrait ? 124 : 132);
          break;
        }
        case 'day-summary': {
          dim(ctx, 0.5 * smooth((lt - 0.3) / FADE), TR);
          const head = p.from && p.to && p.from !== p.to ? `${p.from} → ${p.to}` : p.to || p.from || p.name || 'итог';
          const sub = [p.time, p.gain ? '+' + fmtN(p.gain) + ' м' : null, p.time || p.gain ? null : dateRu(p.date)].filter(Boolean).join('  ·  ');
          centerTitle(ctx, smooth((lt - 0.5) / FADE), rise(lt, 0.5), head, fmtN(p.km, p.km < 100 ? 1 : 0) + ' км', sub, 200);
          break;
        }
        case 'time-on-road':
          lowerThird(ctx, a, dy, 'в пути', p.text, 'средняя скорость ' + fmtN(p.avgKmh, 1) + ' км/ч');
          break;
        case 'high-point':
          lowerThird(ctx, vis(lt, dur, s.move * dur * 0.7), rise(lt, s.move * dur * 0.7), 'высшая точка дня', fmtN(p.ele) + ' м', p.km != null ? `на ${fmtN(p.km)}-м километре` : '');
          break;
        case 'season-card':
          dim(ctx, 0.5 * vis(lt, dur, 0), TR);
          centerTitle(ctx, a, dy, p.traveler || 'история путешествия', p.title || '', p.line || `${p.days} ${daysWord(p.days)} · ${fmtN(p.totalKm)} км`, 130);
          break;
        case 'progress-overview':
          lowerThird(ctx, vis(lt, dur, 0.6), rise(lt, 0.6), 'путь до сегодня', fmtN(p.totalKm) + ' км', `${p.days} ${daysWord(p.days)}${origin ? ' · от ' + origin.label : ''}`);
          break;
        case 'overview-to-detail':
          lowerThird(ctx, a, dy, 'сегодня · день ' + today.day, today.date ? new Date(today.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }) : 'новый день', route2);
          break;
        case 'route-reveal': case 'camera-follow': {
          const km = p.km * todayReveal(t);
          const d0 = s.move * dur * 0.85;   // титр — когда маршрут начинает рисоваться
          lowerThird(ctx, vis(lt, dur, d0), rise(lt, d0), single ? 'пройдено' : 'день ' + today.day, (single ? '' : '+') + fmtN(km, km < 100 ? 1 : 0) + ' км', route2 || 'новый участок');
          break;
        }
        case 'checkpoint-arrival':
          lowerThird(ctx, a, dy, p.kind === 'milestone' ? 'веха' : p.kind === 'chapter' ? 'новая глава' : 'прибытие', p.label, p.kind === 'milestone' ? 'на пути' : single ? (dateRu(today.date) || '') : 'день ' + today.day);
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
          const size = (portrait ? 96 : 84) * u; ctx.font = `700 ${size}px ${HAND}`;
          const words = ('«' + txt + '»').split(/\s+/), lines = []; let cur = '';
          for (const w of words) { const tt = cur ? cur + ' ' + w : w; if (ctx.measureText(tt).width > W - 2 * mx && cur) { lines.push(cur); cur = w; } else cur = tt; }
          lines.push(cur);
          T(ctx, 'из дневника · день ' + today.day, W / 2, H * 0.45 - lines.length * size * 0.55 - 40 * u + dy, { size: 30, weight: 700, color: S.accent, ls: 8, align: 'center' });
          lines.forEach((ln, i) => T(ctx, ln, W / 2, H * 0.45 + (i - (lines.length - 1) / 2) * size * 1.1 + dy, { size: size / u, fam: HAND, weight: 700, align: 'center', color: S.paper ? '#3b2412' : '#fffbea' }));
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
              T(ctx, fmtN(p.maxEle) + ' м', tx, PY(hi) - 34 * u, { size: 54, fam: S.fHead, weight: S.headW, align: 'center', alpha: ma });
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
          lowerThird(ctx, pa, s.recipe === 'pullback' ? (1 - smooth((su - 0.62) / 0.25)) * 26 * u : dy, journey.schematic ? 'и путь продолжается' : 'день ' + p.day, kmText(p.totalKm), journey.schematic ? (journey.totalKmNote || '') : 'путешествие продолжается →');
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

    return { draw, tilesAt, cam, duration, W, H, assetsReady, plan, events: [] };
  }

  window.Episode = { createEpisodeScene };
})();
