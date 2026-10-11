/* Проигрыватель EpisodePlan: план режиссёра → кадры на 2D-холсте (векторная карта + маршрут + типографика).
   Интерфейс тот же, что у обычной сцены: draw(ctx, t, opts), tilesAt(t), duration, assetsReady — поэтому
   готовый экспорт MP4 / слоёв работает без изменений. Отрисовка рецептов отделена от решений (director.js). */
(function () {
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const smooth = (t) => t * t * (3 - 2 * t);
  const px = (lon) => ((lon + 180) / 360) * 256;
  const py = (lat) => { const s = Math.sin((clamp(lat, -85, 85) * Math.PI) / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256; };
  const fmtN = (v, d = 0) => v.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });

  const imgCache = new Map();
  function img(url) {
    let e = imgCache.get(url);
    if (!e) { e = { ok: false, img: null }; e.p = new Promise((res) => { const im = new Image(); im.onload = () => { e.ok = true; e.img = im; res(); }; im.onerror = () => res(); im.src = url; }); imgCache.set(url, e); }
    return e;
  }

  function createEpisodeScene({ journey, plan, styleId, lang = 'ru' }, W, H) {
    const S = window.RS.STYLES[styleId] || window.RS.STYLES.night;
    const u = Math.min(W, H) / 1080, portrait = H > W, mx = (portrait ? 64 : 100) * u;
    const ax = W / 2, ay = portrait ? H * 0.42 : H * 0.48;
    const days = [...journey.days].sort((a, b) => a.day - b.day);
    const today = days.find((d) => d.day === plan.episodeNumber) || days[days.length - 1];
    const P = (d) => d.line.map(([lo, la]) => [px(lo), py(la)]);
    const dayPts = days.map((d) => ({ day: d.day, km: d.km, pts: P(d) }));
    const todayPts = P(today);
    const pastPts = dayPts.filter((d) => d.day < today.day);
    const allPts = dayPts.flatMap((d) => d.pts);
    // накопленная длина прошлого (для «прорисовки» истории)
    const pastFlat = pastPts.flatMap((d) => d.pts);
    const pastCum = [0]; for (let i = 1; i < pastFlat.length; i++) pastCum.push(pastCum[i - 1] + Math.hypot(pastFlat[i][0] - pastFlat[i - 1][0], pastFlat[i][1] - pastFlat[i - 1][1]));
    const todayCum = [0]; for (let i = 1; i < todayPts.length; i++) todayCum.push(todayCum[i - 1] + Math.hypot(todayPts[i][0] - todayPts[i - 1][0], todayPts[i][1] - todayPts[i - 1][1]));
    const perDay = days.map((d) => d.km), maxKm = Math.max(1, ...perDay);
    const totalKm = perDay.reduce((a, b) => a + b, 0);
    const mediaById = Object.fromEntries((journey.media || []).map((m) => [m.id, m]));
    const cps = journey.checkpoints || [];
    const cpPos = (c) => { const d = days.find((x) => x.day === c.day); if (!d) return null; const q = d.line[d.line.length - 1]; return [px(q[0]), py(q[1])]; };

    /* ---- камера: именованные цели ---- */
    const bbox = (pts) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, y0, x1, y1 }; };
    const fit = (b, fw, fh, zMax = 14) => ({ cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, z: clamp(Math.log2(Math.min(fw / Math.max(b.x1 - b.x0, 1e-6), fh / Math.max(b.y1 - b.y0, 1e-6))), 2, zMax) });
    const CAM = {
      journey: fit(bbox(allPts), W * 0.84, H * (portrait ? 0.38 : 0.6)),
      segment: fit(bbox(todayPts), W * 0.72, H * (portrait ? 0.3 : 0.5), 13),
    };
    const endP = todayPts[todayPts.length - 1];
    CAM.end = { cx: endP[0], cy: endP[1], z: Math.min(CAM.segment.z + 1.3, 13.5) };
    CAM.journeyClose = { ...CAM.journey, z: CAM.journey.z + 0.2 };
    // зум и сдвиг согласованы: центр смещается пропорционально изменению масштаба — старт и цель не выпадают из кадра
    const lerpCam = (a, b, t) => {
      const z = lerp(a.z, b.z, t), sc = Math.pow(2, z), s0 = Math.pow(2, a.z), s1 = Math.pow(2, b.z);
      if (b.z > a.z + 0.25) { const k = ((1 - t) * s0) / sc; return { cx: b.cx - (b.cx - a.cx) * k, cy: b.cy - (b.cy - a.cy) * k, z }; }   // наезд: цель едет к центру по прямой
      if (a.z > b.z + 0.25) { const k = (t * s1) / sc; return { cx: a.cx - (a.cx - b.cx) * k, cy: a.cy - (a.cy - b.cy) * k, z }; }       // отъезд: исходная точка уходит из центра по прямой
      return { cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), z };
    };
    const flyCam = (a, b, t) => lerpCam(a, b, easeIO(t));
    const headAt = (f) => { // точка на сегменте дня по доле пути
      const L = todayCum[todayCum.length - 1] * clamp(f, 0, 1); let i = 1; while (i < todayCum.length - 1 && todayCum[i] < L) i++;
      const s = (L - todayCum[i - 1]) / Math.max(1e-9, todayCum[i] - todayCum[i - 1]); return { x: lerp(todayPts[i - 1][0], todayPts[i][0], s), y: lerp(todayPts[i - 1][1], todayPts[i][1], s), i };
    };

    /* ---- расписание кадров ---- */
    const shots = plan.beats.map((b) => ({ ...b, t0: b.startSec, t1: b.startSec + b.durationSec }));
    const duration = plan.durationSec;
    const CAMS = {
      'day-card': () => [CAM.journey, CAM.journeyClose], 'season-card': () => [CAM.journey, CAM.journeyClose],
      'progress-overview': () => [CAM.journey, CAM.journey], 'overview-to-detail': () => [CAM.journey, CAM.segment],
      'route-reveal': () => [CAM.segment, { ...CAM.segment, z: CAM.segment.z + 0.25 }], 'camera-follow': null,
      'checkpoint-arrival': () => [CAM.segment, CAM.end], 'photo-reveal': () => [CAM.end, { ...CAM.end, z: CAM.end.z + 0.2 }],
      'note-card': () => [CAM.end, CAM.end], 'location-card': () => [CAM.end, { ...CAM.end, z: CAM.end.z - 0.3 }],
      'distance-counter': () => [CAM.segment, CAM.segment], 'day-barcode': () => [CAM.segment, { ...CAM.segment, z: CAM.segment.z - 0.6 }],
      'elevation-profile': () => [CAM.segment, CAM.segment], 'pullback': () => [CAM.end, CAM.journey],
      'progress-poster': () => [CAM.journey, CAM.journey], 'journey-recap': null, 'highlights-reel': () => [CAM.journey, CAM.journeyClose],
    };
    function shotAt(t) { let i = shots.findIndex((s) => t < s.t1); if (i < 0) i = shots.length - 1; return { i, s: shots[i], u: clamp((t - shots[i].t0) / shots[i].durationSec, 0, 1), lt: t - shots[i].t0 }; }
    function camFor(s, uu) {
      if (s.recipe === 'camera-follow') {
        const h = headAt(revealOf(s, uu)), back = headAt(revealOf(s, uu) - 0.08);
        return { cx: lerp(back.x, h.x, 0.6), cy: lerp(back.y, h.y, 0.6), z: CAM.segment.z + 1.2 };
      }
      if (s.recipe === 'journey-recap') {
        const hist = s.params.history || [];
        if (!hist.length) return CAM.journey;
        const k = uu * (hist.length + 1), j = Math.floor(k), f = easeIO(k - j);
        const tgt = (n) => { if (n <= 0 || n > hist.length) return CAM.journey; const p = cpPos(hist[n - 1]); return p ? { cx: p[0], cy: p[1], z: CAM.journey.z + 1.6 } : CAM.journey; };
        return flyCam(tgt(j), tgt(j + 1), f);
      }
      const ab = (CAMS[s.recipe] || (() => [CAM.journey, CAM.journey]))();
      return s.recipe === 'pullback' ? flyCam(ab[0], ab[1], clamp(uu / 0.7, 0, 1)) : lerpCam(ab[0], ab[1], easeIO(uu));
    }
    function cam(t) {
      const { i, s, u: uu, lt } = shotAt(t);
      const c = camFor(s, uu);
      if (i > 0 && lt < 0.45) { const prev = camFor(shots[i - 1], 1); return lerpCam(prev, c, easeOut(lt / 0.45)); }
      return c;
    }
    // доля прорисовки сегмента дня на момент кадра
    function revealOf(s, uu) { return s.recipe === 'route-reveal' || s.recipe === 'camera-follow' ? easeIO(clamp(uu / 0.85, 0, 1)) : 1; }
    function todayReveal(t) {
      const idx = shots.findIndex((s) => s.recipe === 'route-reveal' || s.recipe === 'camera-follow');
      if (idx < 0) return 1;
      const s = shots[idx]; if (t < s.t0) return 0; if (t >= s.t1) return 1; return revealOf(s, (t - s.t0) / s.durationSec);
    }
    function pastReveal(t) {
      const po = shots.find((s) => s.recipe === 'progress-overview');
      const jr = shots.find((s) => s.recipe === 'journey-recap');
      const s = po || jr; if (!s) return 1;
      if (t < s.t0) return po ? 0.0 : 0; if (t >= s.t1) return 1; return easeIO(clamp((t - s.t0) / (s.durationSec * (jr ? 0.95 : 0.7)), 0, 1));
    }

    const tilesAt = (t) => {
      const c = cam(t); const out = [];
      if (S.vec) out.push(...window.VMap.tilesAt(c, ax, ay, W, H));
      return out;
    };

    /* ---- фото ---- */
    const allMediaIds = [...new Set(shots.flatMap((s) => s.params.mediaIds || []))];
    const assetsReady = Promise.all(allMediaIds.map((id) => (mediaById[id] ? img(mediaById[id].url).p : Promise.resolve())));

    /* ---- текст ---- */
    function T(ctx, str, x, y, a) {
      if (str == null || str === '') return;
      ctx.save();
      const size = (a.size || 40) * u, fam = a.fam || S.fBody, wt = a.weight || 700;
      ctx.font = `${wt} ${size}px ${fam}`; ctx.fillStyle = a.color || S.ink; ctx.textAlign = a.align || 'left'; ctx.textBaseline = a.base || 'alphabetic';
      ctx.letterSpacing = (a.ls || 0) * u + 'px'; if (a.alpha != null) ctx.globalAlpha *= a.alpha;
      if (a.shadow !== false && !S.paper) { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 20 * u; ctx.shadowOffsetY = 3 * u; }
      if (a.max) { const w = ctx.measureText(str).width; if (w > a.max * u) ctx.font = `${wt} ${size * ((a.max * u) / w)}px ${fam}`; }
      ctx.fillText(str, x, y); ctx.restore();
    }
    const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
    const panelSolid = S.panel.replace(/,\s*[\d.]+\)$/, ',0.93)');
    const HAND = '"Caveat", "Segoe Print", cursive';
    const inOut = (lt, dur, a = 0.35, b = 0.35) => smooth(clamp(lt / a, 0, 1)) * (1 - smooth(clamp((lt - (dur - b)) / b, 0, 1)));

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
      if (LY.map && S.vec) window.VMap.draw(ctx, W, H, { cx: c.cx, cy: c.cy, z: c.z, rot: 0 }, ax, ay, { ...S.vec, font: S.fBody, maxLabels: 26 }, { fills: !TR, lines: true, labels: true }, lang, u);
      if (!TR && S.paper) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(240,214,160,.25)'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }

      /* --- маршрут --- */
      if (LY.route) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const poly = (pts, upto) => { ctx.beginPath(); pts.forEach((p, i) => { if (upto != null && i > upto) return; i ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p)); }); };
        // прошлое: приглушённая «нить», прорисовывается в обзоре
        const pr = pastReveal(t), Lp = pastCum[pastCum.length - 1] * pr;
        const pullT = s.recipe === 'pullback' ? smooth(clamp((su - 0.25) / 0.6, 0, 1)) : 0;
        if (pastFlat.length > 1 && pr > 0) {
          let n = 1; while (n < pastFlat.length - 1 && pastCum[n] < Lp) n++;
          poly(pastFlat, n);
          ctx.strokeStyle = S.line.glow; ctx.globalAlpha = 0.35 + 0.5 * pullT; ctx.lineWidth = (S.line.w * 2.2) * u; ctx.stroke();
          ctx.globalAlpha = 0.75 + 0.25 * pullT; ctx.strokeStyle = S.paper ? 'rgba(124,45,18,.75)' : 'rgba(225,235,255,.78)'; ctx.lineWidth = 4.2 * u; ctx.stroke(); ctx.globalAlpha = 1;
          // границы дней — маленькие засечки
          if (c.z > CAM.journey.z + 0.8) for (const d of pastPts) { const q = d.pts[d.pts.length - 1]; ctx.beginPath(); ctx.arc(X(q), Y(q), 3 * u, 0, 6.2832); ctx.fillStyle = S.paper ? '#7c2d12' : '#dfe8ff'; ctx.fill(); }
        }
        // сегодня: яркий, с «кометой»
        const tr = todayReveal(t);
        if (tr > 0 && todayPts.length > 1) {
          const h = headAt(tr);
          poly(todayPts, h.i - 1); ctx.lineTo(X([h.x, h.y]), Y([h.x, h.y]));
          ctx.strokeStyle = S.line.glow; ctx.lineWidth = S.line.w * 3 * u; ctx.stroke();
          const g = ctx.createLinearGradient(X(todayPts[0]), Y(todayPts[0]), X([h.x, h.y]) + 1, Y([h.x, h.y]));
          S.line.stops.forEach((cc, i, a) => g.addColorStop(i / (a.length - 1), cc));
          ctx.strokeStyle = g; ctx.lineWidth = S.line.w * 1.15 * u; ctx.stroke();
          ctx.save(); ctx.shadowColor = S.head; ctx.shadowBlur = 24 * u; ctx.strokeStyle = S.head; ctx.globalAlpha = 0.9; ctx.lineWidth = S.line.w * 0.4 * u; ctx.stroke(); ctx.restore();
          // текущая позиция
          const pulse = (t * 1.4) % 1, hx = X([h.x, h.y]), hy = Y([h.x, h.y]);
          ctx.beginPath(); ctx.arc(hx, hy, (16 + 40 * pulse) * u, 0, 6.2832); ctx.fillStyle = S.headHalo; ctx.globalAlpha = 0.85 * (1 - pulse); ctx.fill(); ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(hx, hy, 15 * u, 0, 6.2832); ctx.fillStyle = S.head; ctx.fill(); ctx.lineWidth = 6 * u; ctx.strokeStyle = S.line.stops[S.line.stops.length - 1]; ctx.stroke();
        } else if (todayPts.length > 1) {
          // ещё не прорисован — «призрак» сегодняшнего пути
          poly(todayPts); ctx.setLineDash([10 * u, 12 * u]); ctx.strokeStyle = S.ghost; ctx.lineWidth = 4 * u; ctx.stroke(); ctx.setLineDash([]);
        }
        // вехи истории в обзоре и пересказе
        if ((s.recipe === 'progress-overview' || s.recipe === 'journey-recap') && LY.route) {
          (s.params.history || []).forEach((h, i, arr) => {
            const p = cpPos(h); if (!p) return;
            const a = smooth(clamp((su - (0.12 + (0.7 * i) / Math.max(1, arr.length))) / 0.12, 0, 1)) * inOut(lt, s.durationSec, 0.01, 0.3);
            if (a <= 0.01) return;
            const x = X(p), y = Y(p);
            ctx.save(); ctx.globalAlpha = a;
            ctx.beginPath(); ctx.arc(x, y, 9 * u, 0, 6.2832); ctx.fillStyle = S.accent; ctx.fill(); ctx.lineWidth = 3 * u; ctx.strokeStyle = S.head; ctx.stroke();
            ctx.font = `700 ${26 * u}px ${S.fHead}`; const txt = h.label.toUpperCase(); const tw = ctx.measureText(txt).width;
            const bx = clamp(x - tw / 2 - 14 * u, 12 * u, W - tw - 40 * u), by = y - 64 * u;
            ctx.fillStyle = panelSolid; rr(ctx, bx, by, tw + 28 * u, 44 * u, 10 * u); ctx.fill();
            ctx.fillStyle = S.ink; ctx.textBaseline = 'middle'; ctx.fillText(txt, bx + 14 * u, by + 23 * u);
            ctx.restore();
          });
        }
      }

      if (!TR) { // затемнение краёв для читаемости текста
        const sc = S.scrim.join(',');
        let g = ctx.createLinearGradient(0, 0, 0, H * 0.3); g.addColorStop(0, `rgba(${sc},.78)`); g.addColorStop(1, `rgba(${sc},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.3);
        g = ctx.createLinearGradient(0, H * 0.6, 0, H); g.addColorStop(0, `rgba(${sc},0)`); g.addColorStop(1, `rgba(${sc},.85)`); ctx.fillStyle = g; ctx.fillRect(0, H * 0.6, W, H * 0.4);
        if (S.paper) { ctx.strokeStyle = S.ink; ctx.lineWidth = 3 * u; ctx.strokeRect(30 * u, 30 * u, W - 60 * u, H - 60 * u); }
      }

      if (LY.hud) hud(ctx, t, s, su, lt, TR, X, Y);
      T(ctx, S.credit, W / 2, H - (S.paper ? 50 : 24) * u, { size: 16, weight: 500, color: S.dim, align: 'center', alpha: 0.7, shadow: false });
      ctx.restore();
    }

    /* ================= типографика и карточки рецептов ================= */
    function hud(ctx, t, s, su, lt, TR, X, Y) {
      const dur = s.durationSec, A = inOut(lt, dur), p = s.params || {};
      const scrimAll = (a) => { if (TR) return; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = `rgba(${S.scrim.join(',')},.62)`; ctx.fillRect(0, 0, W, H); ctx.restore(); };
      const topLine = () => { // постоянный ориентир: день и путешествие
        const a = s.recipe === 'day-card' || s.recipe === 'season-card' || s.recipe === 'progress-poster' ? 0 : 1;
        if (!a) return;
        T(ctx, `ДЕНЬ ${plan.episodeNumber}`, mx, (portrait ? 140 : 110) * u, { size: portrait ? 64 : 58, fam: S.fHead, weight: S.headW, ls: 3 });
        T(ctx, (journey.title || '').toUpperCase(), mx, (portrait ? 140 : 110) * u + 46 * u, { size: 26, weight: 600, color: S.accent, ls: 5, max: W / u - 2 * mx / u });
      };
      topLine();
      const cy = portrait ? H * 0.74 : H * 0.68;

      switch (s.recipe) {
        case 'day-card': case 'season-card': {
          scrimAll(0.75 * A);
          const sl = (1 - smooth(clamp(lt / 0.5, 0, 1))) * 40 * u, my = portrait ? H * 0.44 : H * 0.48;
          if (s.recipe === 'day-card') {
            T(ctx, 'ДЕНЬ', W / 2, my - 150 * u + sl, { size: 48, weight: 600, align: 'center', ls: 18, color: S.accent, alpha: A });
            T(ctx, String(p.day), W / 2, my + 70 * u + sl, { size: portrait ? 260 : 230, fam: S.fHead, weight: S.headW, align: 'center', alpha: A });
            T(ctx, (p.title || '').toUpperCase(), W / 2, my + 160 * u + sl, { size: 40, weight: 600, align: 'center', ls: 6, alpha: A, max: W / u - 160 });
            if (p.totalKm) T(ctx, `позади ${fmtN(p.totalKm)} км`, W / 2, my + 220 * u + sl, { size: 34, weight: 500, align: 'center', color: S.dim, alpha: A });
          } else {
            T(ctx, (p.traveler || 'ИСТОРИЯ ПУТЕШЕСТВИЯ').toUpperCase(), W / 2, my - 120 * u + sl, { size: 34, weight: 600, align: 'center', ls: 10, color: S.accent, alpha: A, max: W / u - 160 });
            T(ctx, (p.title || '').toUpperCase(), W / 2, my + 20 * u + sl, { size: portrait ? 110 : 100, fam: S.fHead, weight: S.headW, align: 'center', alpha: A, max: W / u - 120 });
            T(ctx, `${p.days} ${p.days % 10 === 1 && p.days % 100 !== 11 ? 'день' : 'дней'} · ${fmtN(p.totalKm)} км`, W / 2, my + 100 * u + sl, { size: 44, weight: 600, align: 'center', ls: 4, alpha: A });
          }
          break;
        }
        case 'progress-overview': {
          T(ctx, fmtN(p.totalKm) + ' км', W / 2, cy, { size: portrait ? 120 : 110, fam: S.fHead, weight: S.headW, align: 'center', alpha: A });
          T(ctx, `за ${p.days} ${p.days % 10 === 1 && p.days % 100 !== 11 ? 'день' : 'дней'} пути`, W / 2, cy + 60 * u, { size: 36, weight: 600, align: 'center', color: S.accent, alpha: A });
          break;
        }
        case 'overview-to-detail': {
          T(ctx, 'СЕГОДНЯ', W / 2, cy, { size: 64, fam: S.fHead, weight: S.headW, align: 'center', ls: 10, alpha: A });
          T(ctx, today.date ? new Date(today.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }) : '', W / 2, cy + 56 * u, { size: 34, weight: 600, align: 'center', color: S.accent, alpha: A });
          break;
        }
        case 'route-reveal': case 'camera-follow': case 'distance-counter': {
          const counting = s.recipe === 'distance-counter' ? easeOut(clamp(su / 0.7, 0, 1)) : todayReveal(t);
          const big = s.recipe === 'distance-counter';
          const km = (p.km != null ? p.km : p.newKm) * counting;
          T(ctx, '+' + fmtN(km, km < 100 ? 1 : 0) + ' км', W / 2, cy + (big ? 0 : 40 * u), { size: big ? (portrait ? 170 : 150) : 96, fam: S.fHead, weight: S.headW, align: 'center', alpha: A });
          if (big) T(ctx, `всего ${fmtN(p.totalKm)} км`, W / 2, cy + 74 * u, { size: 44, weight: 600, align: 'center', color: S.accent, alpha: A });
          else T(ctx, 'новый участок', W / 2, cy + 94 * u, { size: 32, weight: 600, align: 'center', color: S.accent, ls: 4, alpha: A });
          if (big && p.gain) T(ctx, `набор высоты +${fmtN(p.gain)} м`, W / 2, cy + 128 * u, { size: 32, weight: 500, align: 'center', color: S.dim, alpha: A });
          break;
        }
        case 'checkpoint-arrival': {
          const st = easeOut(clamp(lt / 0.5, 0, 1)), sc = 1.35 - 0.35 * st;
          ctx.save(); ctx.globalAlpha = A; ctx.translate(W / 2, cy - 20 * u); ctx.rotate(-0.06); ctx.scale(sc, sc);
          ctx.font = `${S.headW} ${(portrait ? 92 : 84) * u}px ${S.fHead}`; const txt = (p.label || '').toUpperCase(); const tw = Math.min(ctx.measureText(txt).width, W - 180 * u);
          ctx.strokeStyle = S.accent; ctx.lineWidth = 6 * u; rr(ctx, -tw / 2 - 40 * u, -110 * u, tw + 80 * u, 170 * u, 18 * u); ctx.stroke();
          T(ctx, txt, 0, 20 * u, { size: portrait ? 92 : 84, fam: S.fHead, weight: S.headW, align: 'center', max: (W - 180 * u) / u, shadow: false });
          T(ctx, p.kind === 'milestone' ? 'ВЕХА' : p.kind === 'chapter' ? 'НОВАЯ ГЛАВА' : 'ПРИБЫТИЕ', 0, -66 * u, { size: 26, weight: 700, align: 'center', color: S.accent, ls: 10, shadow: false });
          ctx.restore();
          break;
        }
        case 'photo-reveal': case 'highlights-reel': {
          const ids = p.mediaIds || [], n = ids.length;
          ids.forEach((id, i) => {
            const m = mediaById[id]; if (!m) return; const e = img(m.url); if (!e.ok) return;
            const slot = s.recipe === 'highlights-reel' ? dur / n : Math.min(dur * 0.8, 1.6 + i * 0.0);
            const st = s.recipe === 'highlights-reel' ? i * slot : i * (dur * 0.6) / Math.max(1, n);
            const lt2 = lt - st; if (lt2 < 0) return;
            const a = smooth(clamp(lt2 / 0.45, 0, 1)) * (s.recipe === 'highlights-reel' ? 1 - smooth(clamp((lt2 - slot + 0.3) / 0.3, 0, 1)) : 1) * (1 - smooth(clamp((lt - dur + 0.35) / 0.35, 0, 1)));
            if (a <= 0.01) return;
            // фото «вырастает» из точки маршрута
            const end = [X(endP), Y(endP)];
            const fw = (portrait ? 620 : 600) * u, fh = (portrait ? 500 : 470) * u, pad = 18 * u, bottom = 70 * u;
            const tx = (portrait ? W / 2 : W * 0.66) + (i - (n - 1) / 2) * 40 * u, ty = (portrait ? H * 0.43 : H * 0.48) + (i - (n - 1) / 2) * 28 * u;
            const g = easeOut(clamp(lt2 / 0.6, 0, 1));
            const cx = lerp(end[0], tx, g), cyy = lerp(end[1], ty, g), sc = lerp(0.15, 1, g);
            ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cyy); ctx.rotate(((i % 2 ? 3 : -3) * Math.PI) / 180); ctx.scale(sc, sc);
            ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 34 * u; ctx.shadowOffsetY = 12 * u;
            ctx.fillStyle = S.paper ? '#fbf3df' : '#fff'; rr(ctx, -fw / 2, -fh / 2, fw, fh, 8 * u); ctx.fill(); ctx.shadowColor = 'transparent';
            const pw = fw - 2 * pad, ph = fh - pad - bottom;
            ctx.save(); rr(ctx, -fw / 2 + pad, -fh / 2 + pad, pw, ph, 4 * u); ctx.clip();
            const im = e.img, zk = 1 + 0.06 * clamp(lt2 / dur, 0, 1), scl = Math.max(pw / im.width, ph / im.height) * zk;
            ctx.drawImage(im, -fw / 2 + pad + (pw - im.width * scl) / 2, -fh / 2 + pad + (ph - im.height * scl) / 2, im.width * scl, im.height * scl);
            ctx.restore();
            const cap = s.recipe === 'highlights-reel' ? `День ${m.day}` : (m.caption || `День ${plan.episodeNumber}`);
            T(ctx, cap, 0, fh / 2 - bottom / 2 + 12 * u, { size: 30, weight: 600, color: S.paper ? '#3b2412' : '#1b1b1b', align: 'center', fam: HAND, shadow: false, max: pw / u });
            ctx.restore();
          });
          if (p.note) { const a = smooth(clamp((lt - dur * 0.35) / 0.5, 0, 1)) * (1 - smooth(clamp((lt - dur + 0.35) / 0.35, 0, 1))); handNote(ctx, p.note, portrait ? H * 0.78 : H * 0.84, a, clamp((lt - dur * 0.35) / (dur * 0.45), 0, 1)); }
          break;
        }
        case 'note-card': {
          scrimAll(0.35 * A);
          handNote(ctx, p.text, portrait ? H * 0.56 : H * 0.55, A, clamp(lt / (dur * 0.6), 0, 1), true);
          break;
        }
        case 'location-card': {
          T(ctx, (p.label || 'ЗДЕСЬ').toUpperCase(), W / 2, cy, { size: portrait ? 96 : 90, fam: S.fHead, weight: S.headW, align: 'center', alpha: A, max: W / u - 160 });
          T(ctx, `${Math.abs(p.lat).toFixed(2)}° ${p.lat >= 0 ? 'С. Ш.' : 'Ю. Ш.'}   ${Math.abs(p.lon).toFixed(2)}° ${p.lon >= 0 ? 'В. Д.' : 'З. Д.'}`, W / 2, cy + 64 * u, { size: 34, weight: 600, align: 'center', color: S.accent, ls: 3, alpha: A });
          break;
        }
        case 'day-barcode': barcode(ctx, t, s, su, lt, A, true); break;
        case 'elevation-profile': {
          T(ctx, '+' + fmtN(p.gain) + ' м', W / 2, cy, { size: portrait ? 140 : 120, fam: S.fHead, weight: S.headW, align: 'center', alpha: A });
          T(ctx, 'набор высоты за день', W / 2, cy + 64 * u, { size: 36, weight: 600, align: 'center', color: S.accent, alpha: A });
          break;
        }
        case 'pullback': case 'progress-poster': {
          const a = s.recipe === 'pullback' ? smooth(clamp((su - 0.55) / 0.25, 0, 1)) : A;
          if (a > 0.01) {
            T(ctx, `ДЕНЬ ${p.day}`, W / 2, portrait ? H * 0.16 : H * 0.17, { size: 44, weight: 700, align: 'center', ls: 14, color: S.accent, alpha: a });
            T(ctx, fmtN(p.totalKm) + ' км', W / 2, portrait ? H * 0.78 : H * 0.84, { size: portrait ? 150 : 130, fam: S.fHead, weight: S.headW, align: 'center', alpha: a });
            T(ctx, 'путешествие продолжается →', W / 2, portrait ? H * 0.78 + 70 * u : H * 0.84 + 60 * u, { size: 38, weight: 600, align: 'center', color: S.accent, alpha: a * smooth(clamp((su - 0.75) / 0.2, 0, 1)) });
          }
          break;
        }
        case 'journey-recap': {
          const hist = p.history || [], k = su * (hist.length + 1), j = Math.floor(k);
          const h = hist[clamp(j - 1, 0, hist.length - 1)];
          if (j >= 1 && j <= hist.length && h) {
            const a = smooth(clamp((k - j) / 0.25, 0, 1)) * (1 - smooth(clamp((k - j - 0.75) / 0.25, 0, 1)));
            T(ctx, h.label.toUpperCase(), W / 2, cy, { size: portrait ? 96 : 88, fam: S.fHead, weight: S.headW, align: 'center', alpha: a, max: W / u - 160 });
            T(ctx, `ДЕНЬ ${h.day}`, W / 2, cy + 60 * u, { size: 34, weight: 700, align: 'center', color: S.accent, ls: 8, alpha: a });
          }
          break;
        }
        default: break;
      }
      // «живая полоса дней» внизу — фирменный ориентир (кроме кадров, где она главная или мешает)
      if (!['day-card', 'season-card', 'day-barcode', 'progress-poster', 'pullback'].includes(s.recipe)) barcode(ctx, t, s, su, lt, 0.9, false);
      if (s.recipe === 'pullback') barcode(ctx, t, s, su, lt, smooth(clamp((su - 0.6) / 0.3, 0, 1)), false);
    }

    function handNote(ctx, text, y, a, write, big) {
      if (!text || a <= 0.01) return;
      const size = (big ? (portrait ? 92 : 80) : (portrait ? 64 : 58)) * u;
      ctx.save(); ctx.globalAlpha = a; ctx.font = `700 ${size}px ${HAND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      // перенос по словам
      const words = ('«' + text + '»').split(/\s+/), lines = []; let cur = '';
      for (const w of words) { const tt = cur ? cur + ' ' + w : w; if (ctx.measureText(tt).width > W - 2 * mx - 40 * u && cur) { lines.push(cur); cur = w; } else cur = tt; }
      lines.push(cur);
      const total = lines.join('').length; let shown = Math.round(total * clamp(write, 0, 1));
      lines.forEach((ln, i) => {
        const part = ln.slice(0, Math.max(0, Math.min(ln.length, shown))); shown -= ln.length;
        if (!part) return;
        const yy = y + (i - (lines.length - 1) / 2) * size * 1.08;
        if (!S.paper) { ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 18 * u; }
        ctx.fillStyle = S.paper ? '#3b2412' : '#fffbea';
        // выравниваем по полной строке, а не по уже написанной части: буквы «пишутся» слева направо
        const full = ctx.measureText(ln).width; ctx.textAlign = 'left'; ctx.fillText(part, W / 2 - full / 2, yy);
      });
      ctx.restore();
    }

    function barcode(ctx, t, s, su, lt, a, hero) {
      if (a <= 0.01) return;
      const n = days.length, bw = W - 2 * mx;
      const h = hero ? (portrait ? 420 : 300) * u : 64 * u;
      const by = hero ? (portrait ? H * 0.62 : H * 0.62) : H - (portrait ? 150 : 96) * u;
      const step = bw / n, w = Math.max(2 * u, step * 0.62);
      ctx.save(); ctx.globalAlpha = a;
      days.forEach((d, i) => {
        const grow = hero ? easeOut(clamp(su * 1.6 - (i / n) * 0.9, 0, 1)) : 1;
        const isToday = d.day === today.day, rest = d.km < 1;
        const hh = rest ? 6 * u : Math.max(6 * u, (d.km / maxKm) * h) * grow;
        const x = mx + i * step + (step - w) / 2;
        ctx.fillStyle = isToday ? S.head : rest ? S.ghost : S.paper ? 'rgba(124,45,18,.7)' : 'rgba(170,200,255,.75)';
        if (isToday && !S.paper) { ctx.shadowColor = S.headHalo; ctx.shadowBlur = 18 * u; } else ctx.shadowBlur = 0;
        ctx.fillRect(x, by - hh, w, hh);
      });
      ctx.shadowBlur = 0;
      if (hero) {
        T(ctx, 'ДЕНЬ ЗА ДНЁМ', mx, by - h - 40 * u, { size: 28, weight: 700, color: S.accent, ls: 8 });
        T(ctx, `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'день' : 'дней'} · ${fmtN(totalKm)} км`, mx, by + 60 * u, { size: 44, fam: S.fHead, weight: S.headW });
        T(ctx, 'высота столбика — километры за день', mx, by + 104 * u, { size: 24, weight: 500, color: S.dim });
      }
      ctx.restore();
    }

    return { draw, tilesAt, cam, duration, W, H, assetsReady, plan, events: [] };
  }

  window.Episode = { createEpisodeScene };
})();
