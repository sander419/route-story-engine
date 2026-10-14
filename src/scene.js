/* Сцена: камера, тайлы карты, маршрут, оформление. draw(ctx, t) рисует кадр на момент t секунд. */
(function () {
  const { at } = window.RouteLib;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = (t) => t * t * (3 - 2 * t);

  /* ---------- тайлы ---------- */
  const esri = (id, path, extra = {}) => ({
    id: 'esri-' + id,
    px: 256,
    zi: (z) => Math.ceil(z),
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/${path}/MapServer/tile/${z}/${y}/${x}`,
    maxZ: 16,
    ...extra,
  });
  const labelsZi = (z) => Math.ceil(z - 0.7);
  const L_DARK = () => esri('darkref', 'Canvas/World_Dark_Gray_Reference', { zi: labelsZi });

  const tiles = new Map();
  let onTile = () => {};
  function getTile(layer, z, x, y, load) {
    const key = layer.id + '/' + z + '/' + x + '/' + y;
    let e = tiles.get(key);
    if (!e && load) {
      e = { ok: false, done: false, img: null, fail: 0, p: null };
      tiles.set(key, e);
      e.p = new Promise((res) => {
        const attempt = () => {
          const im = new Image();
          im.crossOrigin = 'anonymous';
          im.onload = () => { e.img = im; e.ok = true; e.done = true; onTile(); res(); };
          im.onerror = () => { if (++e.fail < 3) setTimeout(attempt, 400 * e.fail); else { e.done = true; res(); } };
          im.src = layer.url(z, x, y);
        };
        attempt();
      });
    }
    return e || null;
  }

  /* ---------- картинки (фото остановок) ---------- */
  const imgs = new Map();
  function loadImg(url) {
    let e = imgs.get(url);
    if (!e) {
      e = { img: null, ok: false };
      e.p = new Promise((res) => {
        const im = new Image();
        im.onload = () => { e.img = im; e.ok = true; onTile(); res(); };
        im.onerror = () => res();
        im.src = url;
      });
      imgs.set(url, e);
    }
    return e;
  }

  /* ---------- стили ---------- */
  const STYLES = {
    journal: {
      name: 'Дневник',
      bg: '#f4e8cb', journal: true, vec: null,
      ghost: 'rgba(135,126,100,.5)', ghostW: 5, ghostDash: [4, 14],
      line: { stops: ['#c9552f', '#a33f28'], glow: 'rgba(255,244,217,.9)', w: 9 },
      head: '#fff4d9', headHalo: 'rgba(163,63,40,.35)',
      ink: '#203c36', dim: 'rgba(32,60,54,.68)', accent: '#a33f28',
      panel: 'rgba(255,244,217,.93)', panelLine: 'rgba(135,126,100,.55)',
      fHead: '"Yeseva One", "RS Geologica", Georgia, serif', headW: 400, fNum: '"RS Geologica Num", "RS Geologica", system-ui, sans-serif', numW: 700, fBody: '"RS Geologica", "Segoe UI", system-ui, sans-serif',
      scrim: [244, 232, 203], paper: true, credit: '',
    },
    paper: {
      name: 'Атлас',
      bg: '#efe6d2',
      vec: { water: '#bcd3d6', waterLine: '#8fb0b3', park: 'rgba(170,180,120,.26)', urban: 'rgba(190,160,110,.2)', road: 'rgba(120,90,50,.3)', rail: 'rgba(120,90,50,.25)', border: 'rgba(120,70,40,.5)', label: '#2a1c12', halo: 'rgba(239,230,210,.92)', peak: '#7c2d12' },
      ghost: 'rgba(92,58,30,.5)', ghostW: 5, ghostDash: [4, 14],
      line: { stops: ['#e8590c', '#b02a0c'], glow: 'rgba(255,250,238,.95)', w: 9 },
      head: '#fffaf0', headHalo: 'rgba(176,42,12,.35)',
      ink: '#2a1c12', dim: 'rgba(42,28,18,.68)', accent: '#b02a0c',
      panel: 'rgba(247,236,211,.93)', panelLine: 'rgba(92,58,30,.55)',
      fHead: '"Yeseva One", "RS Geologica", Georgia, serif', headW: 400, fNum: '"RS Geologica Num", "RS Geologica", system-ui, sans-serif', numW: 700, fBody: '"RS Geologica", "Segoe UI", system-ui, sans-serif', 
      scrim: [239, 230, 210], paper: true, credit: 'Map © OpenFreeMap, OpenStreetMap contributors',
    },
    night: {
      name: 'Полночь',
      bg: '#0a1428',
      bgGrad: ['#0d1b36', '#0a1730', '#0b1e3a'],
      vec: { water: 'rgba(3,7,16,.86)', waterLine: 'rgba(110,160,220,.38)', park: 'rgba(40,90,100,.16)', urban: 'rgba(255,255,255,.05)', road: 'rgba(150,180,230,.26)', rail: 'rgba(150,180,230,.2)', border: 'rgba(160,185,230,.42)', label: '#f4f8ff', halo: 'rgba(5,10,32,.88)', peak: '#ffd27a' },
      ghost: 'rgba(255,255,255,.34)', ghostW: 7, ghostDash: null,
      line: { stops: ['#ffe08a', '#ffad42', '#ff6b35'], glow: 'rgba(255,160,70,.42)', w: 10 },
      head: '#ffffff', headHalo: 'rgba(255,190,110,.55)',
      ink: '#f6f8fc', dim: 'rgba(226,232,240,.66)', accent: '#ffb454',
      panel: 'rgba(8,12,20,.72)', panelLine: 'rgba(148,163,184,.28)',
      fHead: '"RS DINish", "RS Geologica", "Arial Narrow", sans-serif', headW: 700, fNum: '"RS DINish", "RS Geologica", sans-serif', numW: 700, fBody: '"RS Geologica", "Segoe UI", system-ui, sans-serif',
      scrim: [4, 8, 18], credit: 'Map © OpenFreeMap, OpenStreetMap contributors',
    },
    editorial: {   // «Журнал V3»: токены выбранного направления (бумага #F1EEE6, чернила #222725, акцент #C23E28); векторная карта движка, без фото и ИИ-иллюстраций
      name: 'Журнал V3',
      bg: '#f1eee6',
      vec: { water: '#d6dbd4', waterLine: '#a9b3a8', park: 'rgba(93,96,89,.10)', urban: 'rgba(34,39,37,.05)', road: 'rgba(34,39,37,.22)', rail: 'rgba(34,39,37,.18)', border: 'rgba(194,62,40,.45)', label: '#222725', halo: 'rgba(241,238,230,.92)', peak: '#5d6059' },
      ghost: 'rgba(93,96,89,.45)', ghostW: 5, ghostDash: [4, 14],
      line: { stops: ['#c23e28', '#c23e28'], glow: 'rgba(241,238,230,.95)', w: 9 },
      head: '#f1eee6', headHalo: 'rgba(194,62,40,.4)',
      ink: '#222725', dim: 'rgba(34,39,37,.66)', accent: '#c23e28',
      panel: 'rgba(241,238,230,.94)', panelLine: 'rgba(34,39,37,.35)',
      fHead: '"RS Geologica", "Segoe UI", system-ui, sans-serif', headW: 700, fNum: '"RS Geologica Num", "RS Geologica", system-ui, sans-serif', numW: 700, fBody: '"RS DINish", "RS Geologica", system-ui, sans-serif',
      scrim: [241, 238, 230], paper: true, credit: 'Map © OpenFreeMap, OpenStreetMap contributors',
    },
    navigator: {
      name: 'Навигатор',
      bg: '#090e1a', bgGrad: ['#090e1a', '#0c1630', '#160d2c'], navigator: true,
      ghost: 'rgba(67,231,255,.34)', ghostW: 5, ghostDash: [8, 16],
      line: { stops: ['#43e7ff', '#f05de1'], glow: 'rgba(67,231,255,.4)', w: 10 },
      head: '#e9f9ff', headHalo: 'rgba(240,93,225,.5)',
      ink: '#e9f9ff', dim: 'rgba(185,227,245,.72)', accent: '#43e7ff',
      panel: 'rgba(9,14,26,.78)', panelLine: 'rgba(67,231,255,.4)',
      fHead: '"RS DINish", "RS Geologica", "Arial Narrow", sans-serif', headW: 700, fNum: '"RS Geologica Num", "RS Geologica", system-ui, sans-serif', numW: 700, fBody: '"RS Geologica", "Segoe UI", system-ui, sans-serif',
      scrim: [9, 14, 26], credit: '',
    },
  };

  const I18N = {
    ru: { dist: 'ДИСТАНЦИЯ', km: 'км', speed: 'СКОРОСТЬ', kmh: 'км/ч', ele: 'ВЫСОТА', m: 'м', day: 'ДЕНЬ', start: 'СТАРТ', finish: 'ФИНИШ', total: 'ВСЕГО', gain: 'НАБОР ВЫСОТЫ', avg: 'СРЕДНЯЯ', days: 'ДНЕЙ', top: 'ВЫСШАЯ ТОЧКА', left: 'осталось', rem: 'ОСТАЛОСЬ', when: 'КОГДА', countries: 'СТРАН', passed: 'ПРОЙДЕНО', byAuthor: 'по словам автора', stops: 'ОСТАНОВОК', approx: 'примерное место', locale: 'ru-RU', dayWord: (n) => (n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'дня' : 'дней') },
    en: { dist: 'DISTANCE', km: 'km', speed: 'SPEED', kmh: 'km/h', ele: 'ELEVATION', m: 'm', day: 'DAY', start: 'START', finish: 'FINISH', total: 'TOTAL', gain: 'ELEVATION GAIN', avg: 'AVG SPEED', days: 'DAYS', top: 'HIGHEST POINT', left: 'left', rem: 'REMAINING', when: 'WHEN', countries: 'COUNTRIES', passed: 'COVERED', byAuthor: 'per the author', stops: 'STOPS', approx: 'approximate place', locale: 'en-GB', dayWord: (n) => (n === 1 ? 'day' : 'days') },
  };

  const fmt = (v, d = 0, loc = 'ru-RU') => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });

  let noise = null;
  function noisePattern(ctx) {
    if (!noise) {
      noise = document.createElement('canvas'); noise.width = noise.height = 256;
      const c = noise.getContext('2d'), id = c.createImageData(256, 256);
      let s = 12345;
      for (let i = 0; i < id.data.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const v = 90 + (s >>> 24) % 120; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
      c.putImageData(id, 0, 0);
    }
    return ctx.createPattern(noise, 'repeat');
  }

  /* ---------- сцена ---------- */
  function createScene(route, styleId, o, W, H) {
    const S = STYLES[styleId] || STYLES.night;
    const u = Math.min(W, H) / 1080;
    const portrait = H > W;
    const L = I18N[o.lang] || I18N.ru;
    const D = o.duration;
    const J = o.journey || null;                 // режим «весь путь»: остановки вместо одного трека
    let t0 = Math.min(2.2, D * 0.2);             // конец заставки
    let t1 = D - Math.min(4, D * 0.28);          // конец пути, начало итога
    if (J) { t0 = Math.min(2.2, D * 0.14); t1 = D - (J.noOutro ? 1.0 : Math.min(4.5, D * 0.15)); }
    const total = route.total;

    // положение «якоря» камеры на экране и рамка для общего плана
    const ax = J && !portrait ? W * 0.36 : W / 2, ay = portrait ? H * (J ? 0.275 : 0.38) : H * 0.44;
    const fitW = portrait ? W * 0.84 : W * (J ? 0.58 : 0.7), fitH = portrait ? H * (J ? 0.26 : 0.34) : H * 0.46;
    const bw = Math.max(route.bx1 - route.bx0, 1e-7), bh = Math.max(route.by1 - route.by0, 1e-7);
    const zFit = clamp(Math.log2(Math.min(fitW / bw, fitH / bh)), 2, 16);
    const zFol = clamp(zFit + 1.7, zFit, 15);
    const cx0 = (route.bx0 + route.bx1) / 2, cy0 = (route.by0 + route.by1) / 2;

    // режим «весь путь»: на каждой остановке пауза, между ними переезд (чем дальше — тем дольше)
    const jt = { arr: [], leave: [], z: [] };
    const jpos = [];
    const kmShown = [];
    if (J) {
      const st = J.stops, n = st.length;
      const legW = [];
      for (let i = 1; i < n; i++) legW.push(0.8 + Math.sqrt(Math.max(0, st[i].s - st[i - 1].s) / 1e6) * 0.5);
      const dw = 1.55, sumW = legW.reduce((a, b) => a + b, 0) + n * dw, sc = (t1 - t0) / sumW;
      let c = t0;
      for (let i = 0; i < n; i++) { if (i > 0) c += legW[i - 1] * sc; jt.arr.push(c); c += dw * sc; jt.leave.push(c); }
      st.forEach((q) => jpos.push(at(route, q.s)));
      st.forEach((q, i) => {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (let j = Math.max(0, i - 1); j <= Math.min(n - 1, i + 1); j++) { x0 = Math.min(x0, jpos[j].x); x1 = Math.max(x1, jpos[j].x); y0 = Math.min(y0, jpos[j].y); y1 = Math.max(y1, jpos[j].y); }
        const z = Math.log2(Math.min(fitW / Math.max(x1 - x0, 1e-7), fitH / Math.max(y1 - y0, 1e-7)));
        jt.z.push(clamp(z - 0.15, 3.6, 8.2));
      });
      let last = null;
      st.forEach((q) => { if (q.km != null) last = q.km; kmShown.push(last); });
    }
    const jSeg = (t) => {                         // где мы: на остановке i или в пути между i и i+1
      const n = jt.arr.length;
      if (t <= jt.arr[0]) return { i: 0, leg: false, u: 0 };
      for (let i = 0; i < n - 1; i++) {
        if (t < jt.arr[i + 1]) {
          if (t <= jt.leave[i]) return { i, leg: false, u: 0 };
          return { i, leg: true, u: easeIO((t - jt.leave[i]) / (jt.arr[i + 1] - jt.leave[i])) };
        }
      }
      return { i: n - 1, leg: false, u: 0 };
    };
    const jS = (t) => { const g = jSeg(t); return g.leg ? lerp(J.stops[g.i].s, J.stops[g.i + 1].s, g.u) : J.stops[g.i].s; };
    const jZ = (t) => { const g = jSeg(t); return g.leg ? lerp(jt.z[g.i], jt.z[g.i + 1], g.u) : jt.z[g.i]; };
    // фото автора на маршруте дня: на каждом — короткая пауза движения
    const PH = !J && Array.isArray(o.photos) ? o.photos.filter((q) => q && q.url && q.s >= 0 && q.s <= total).map((q, i) => ({ ...q, tilt: i % 2 ? 2.4 : -2.4, e: loadImg(q.url) })).sort((a, b) => a.s - b.s) : [];
    const pk = { T: [], S: [] };
    if (PH.length) {
      const span = t1 - t0; let dw = 1.9; if (PH.length * dw > span * 0.5) dw = (span * 0.5) / PH.length;
      const travel = span - PH.length * dw; let tc = t0, s0 = 0;
      pk.T.push(t0); pk.S.push(0);
      for (const q of PH) { tc += ((q.s - s0) / total) * travel; pk.T.push(tc); pk.S.push(q.s); q.arr = tc; tc += dw; pk.T.push(tc); pk.S.push(q.s); q.leave = tc; s0 = q.s; }
      pk.T.push(t1); pk.S.push(total);
    }
    const phS = (t) => {
      if (t <= pk.T[0]) return 0;
      for (let i = 0; i < pk.T.length - 1; i++) if (t < pk.T[i + 1]) { const a = pk.S[i], b = pk.S[i + 1]; return a === b ? a : lerp(a, b, easeIO((t - pk.T[i]) / (pk.T[i + 1] - pk.T[i]))); }
      return total;
    };
    const prog = (t) => { if (J) return jS(t) / total; if (PH.length) return phS(t) / total; const x = clamp((t - t0) / (t1 - t0), 0, 1); return lerp(x, smooth(x), 0.45); };
    const tOfProg = (p) => { let a = t0, b = t1; for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (prog(m) < p) a = m; else b = m; } return a; };

    function cam(t) {
      const p = prog(t), s = p * total;
      let fx = 0, fy = 0; const n = 7, w = total * (J ? 0.004 : 0.012);
      for (let j = 0; j < n; j++) { const q = at(route, s - j * w); fx += q.x; fy += q.y; }
      fx /= n; fy /= n;
      const a = easeIO(clamp((t - (t0 - 0.9)) / 2.0, 0, 1));
      const b = J && J.noOutro ? 0 : easeIO(clamp((t - t1) / 2.4, 0, 1));
      let z = lerp(zFit, J ? jZ(t) : zFol, a), cx = lerp(cx0, fx, a), cy = lerp(cy0, fy, a);
      z = lerp(z, zFit, b); cx = lerp(cx, cx0, b); cy = lerp(cy, cy0, b);
      return { z, cx, cy };
    }

    /* какие тайлы нужны на кадре (для догрузки перед экспортом и для отрисовки) */
    function tilesAt(t) {
      const c = cam(t), out = [];
      if (S.vec) out.push(...window.VMap.tilesAt(c, ax, ay, W, H));
      (S.layers || []).forEach((layer, li) => {
        const zi = clamp(layer.zi(c.z), 1, layer.maxZ || 19);
        const k = Math.pow(2, c.z), ts = 256 * Math.pow(2, c.z - zi);
        const left = c.cx * k - ax, top = c.cy * k - ay;
        const n = 1 << zi;
        const x0 = Math.floor(left / ts), x1 = Math.floor((left + W) / ts);
        const y0 = Math.floor(top / ts), y1 = Math.floor((top + H) / ts);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
          if (ty < 0 || ty >= n) continue;
          out.push({ layer, li, z: zi, x: ((tx % n) + n) % n, y: ty, sx: tx * ts - left, sy: ty * ts - top, ts });
        }
      });
      return out;
    }

    /* события-«вехи» */
    const events = [];
    if (!J) {
      const km = total / 1000;
      const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
      const stp = steps.find((s) => km / s <= 5.5 && km / s >= 2) || steps.find((s) => km / s <= 6) || km;
      for (let m = stp; m < km - stp * 0.35; m += stp) events.push({ p: m / km, kind: 'km', big: fmt(m, 0, L.locale) + ' ' + L.km.toUpperCase(), sub: L.left + ' ' + fmt(km - m, km - m < 10 ? 1 : 0, L.locale) + ' ' + L.km });
      if (route.dayArr) {
        for (let i = 1; i < route.n; i++) if (route.dayArr[i] !== route.dayArr[i - 1]) events.push({ p: route.D[i] / total, kind: 'day', big: L.day + ' ' + route.dayArr[i], sub: dateStr(route.t[i], route.lon[i]) });
      }
      if (route.ele && route.stats.maxE - route.stats.minE > 120) {
        events.push({ p: route.D[route.stats.maxI] / total, kind: 'top', big: fmt(route.stats.maxE, 0, L.locale) + ' ' + L.m.toUpperCase(), sub: L.top });
      }
      events.sort((a, b) => a.p - b.p);
      // не лепим вехи друг на друга
      const keep = []; let lastP = -1;
      for (const e of events) { if (e.p - lastP > 0.07 || e.kind === 'day') { keep.push(e); lastP = e.p; } }
      events.length = 0; keep.forEach((e) => { e.t = tOfProg(e.p); events.push(e); });
    }

    function dateStr(ms, lon) {
      const d = new Date(ms + (lon / 15) * 3600e3);
      return d.toLocaleDateString(L.locale, { day: 'numeric', month: 'long', timeZone: 'UTC' });
    }

    /* профиль высот */
    const prof = [];
    if (route.ele && o.showEle) {
      const N = 140; let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < N; i++) { const e = at(route, (i / (N - 1)) * total).ele; prof.push(e); mn = Math.min(mn, e); mx = Math.max(mx, e); }
      const pad = Math.max(10, (mx - mn) * 0.12);
      prof.min = mn - pad; prof.max = mx + pad;
    }

    const places = (o.places || []).filter((q) => q && q.name && q.s > 0 && q.s < total).map((q) => { const a = at(route, q.s); return { s: q.s, name: q.name, x: a.x, y: a.y }; });
    const panelSolid = S.panel.replace(/,\s*[\d.]+\)$/, ',0.95)');
    let curTR = false;                 // идёт экспорт прозрачных слоёв: без затемнения кадра
    const photos = J ? J.stops.map((q) => (q.photo ? loadImg(q.photo) : null)) : [];
    const assetsReady = Promise.all([...photos.filter(Boolean).map((e) => e.p), ...PH.map((q) => q.e.p)]);
    const cache = {};
    function gradient(ctx, key, make) { return cache[key] || (cache[key] = make(ctx)); }

    /* ---------- рисование ---------- */
    function draw(ctx, t, opts) {
      const LY = (opts && opts.layers) || { map: true, route: true, hud: true };
      const TR = !!(opts && opts.transparent);
      curTR = TR;
      const c = cam(t);
      const p = prog(t), s = p * total;
      const head = at(route, s);
      const k = Math.pow(2, c.z);
      const left = c.cx * k - ax, top = c.cy * k - ay;
      const sx = (X) => X * k - left, sy = (Y) => Y * k - top;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (TR) ctx.clearRect(0, 0, W, H);
      else if (S.bgGrad) { const bg = ctx.createLinearGradient(0, 0, W * 0.5, H); S.bgGrad.forEach((cc, i, a) => bg.addColorStop(i / (a.length - 1), cc)); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }
      else { ctx.fillStyle = S.bg; ctx.fillRect(0, 0, W, H); }

      // карта: растр (если есть) + векторные слои
      const need = (LY.map && S.layers) ? tilesAt(t).filter((q) => !q.vec) : [];
      for (const q of need) {
        const e = getTile(q.layer, q.z, q.x, q.y, true);
        ctx.filter = q.layer.filter || 'none';
        const x = Math.floor(q.sx), y = Math.floor(q.sy), w = Math.ceil(q.sx + q.ts) - x, h = Math.ceil(q.sy + q.ts) - y;
        if (e.ok) ctx.drawImage(e.img, x, y, w, h);
        else {
          for (let dz = 1; dz <= 3; dz++) {
            const pe = getTile(q.layer, q.z - dz, q.x >> dz, q.y >> dz, false);
            if (pe && pe.ok) {
              const size = q.layer.px / (1 << dz);
              ctx.drawImage(pe.img, (q.x - ((q.x >> dz) << dz)) * size, (q.y - ((q.y >> dz) << dz)) * size, size, size, x, y, w, h);
              break;
            }
          }
        }
      }
      ctx.filter = 'none';
      if (LY.map && S.navigator) window.NavigatorGrid.draw(ctx, W, H, u);
      if (LY.map && S.vec) window.VMap.draw(ctx, W, H, { cx: c.cx, cy: c.cy, z: c.z, rot: 0 }, ax, ay, { ...S.vec, font: S.fBody }, { fills: !TR && !S.layers, lines: true, labels: true }, o.lang, u);
      if (S.tint && !TR) {
        const tg = ctx.createLinearGradient(0, 0, W * 0.4, H);
        S.tint.stops.forEach((c, i, a) => tg.addColorStop(i / (a.length - 1), c));
        ctx.globalAlpha = 0.72; ctx.globalCompositeOperation = S.tint.mode; ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
      if (S.paper && !TR && S.layers) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(240,214,160,.35)'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }

      if (LY.route) {
      // линия маршрута
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const path = (to) => {
        ctx.beginPath(); ctx.moveTo(sx(route.X[0]), sy(route.Y[0]));
        for (let i = 1; i <= to; i++) (route.brk && route.brk[i] ? ctx.moveTo : ctx.lineTo).call(ctx, sx(route.X[i]), sy(route.Y[i]));
      };
      path(route.n - 1);
      ctx.strokeStyle = S.ghost; ctx.lineWidth = S.ghostW * u;
      const gd = J ? [10, 16] : S.ghostDash;
      if (gd) ctx.setLineDash(gd.map((d) => d * u)); ctx.stroke(); ctx.setLineDash([]);

      const hx = sx(head.x), hy = sy(head.y);
      path(head.i); ctx.lineTo(hx, hy);
      ctx.strokeStyle = S.line.glow; ctx.lineWidth = S.line.w * 2.6 * u; ctx.stroke();
      const x0 = sx(route.X[0]), y0 = sy(route.Y[0]);
      const gr = ctx.createLinearGradient(x0, y0, Math.abs(hx - x0) + Math.abs(hy - y0) < 2 ? x0 + 1 : hx, hy);
      S.line.stops.forEach((col, i, a) => gr.addColorStop(i / (a.length - 1), col));
      ctx.strokeStyle = gr; ctx.lineWidth = S.line.w * u; if (J) ctx.setLineDash([34 * u, 22 * u]); ctx.stroke(); ctx.setLineDash([]);
      {
        const j = at(route, Math.max(0, s - total * 0.06)).i;
        ctx.beginPath(); ctx.moveTo(sx(route.X[j]), sy(route.Y[j]));
        for (let i = j + 1; i <= head.i; i++) (route.brk && route.brk[i] ? ctx.moveTo : ctx.lineTo).call(ctx, sx(route.X[i]), sy(route.Y[i]));
        ctx.lineTo(hx, hy);
        ctx.save(); ctx.shadowColor = S.head; ctx.shadowBlur = 26 * u;
        ctx.strokeStyle = S.head; ctx.globalAlpha = 0.9; ctx.lineWidth = S.line.w * 0.42 * u; ctx.stroke(); ctx.restore();
      }

      // старт / финиш
      const label = (X, Y, kind, name, reach) => {
        const x = sx(X), y = sy(Y);
        if (x < -200 || x > W + 200 || y < -200 || y > H + 200) return;
        ctx.save();
        ctx.globalAlpha = reach;
        ctx.fillStyle = S.ink; ctx.strokeStyle = S.accent; ctx.lineWidth = 5 * u;
        ctx.beginPath(); ctx.arc(x, y, 13 * u, 0, 6.2832); ctx.fill(); ctx.stroke();
        const txt = (name ? name : kind).toUpperCase();
        ctx.font = `${S.headW} ${30 * u}px ${S.fHead}`; ctx.letterSpacing = 3 * u + 'px';
        const tw = ctx.measureText(txt).width, pad = 18 * u, bh2 = 54 * u;
        const bx = clamp(x - tw / 2 - pad, 12 * u, W - tw - pad * 2 - 12 * u), by = y - 36 * u - bh2;
        ctx.fillStyle = S.panel; ctx.strokeStyle = S.panelLine; ctx.lineWidth = 2 * u;
        rr(ctx, bx, by, tw + pad * 2, bh2, 14 * u); ctx.fill(); ctx.stroke();
        ctx.fillStyle = S.ink; ctx.textBaseline = 'middle'; ctx.fillText(txt, bx + pad, by + bh2 / 2 + 1 * u);
        ctx.restore();
      };
      for (const pl of places) {
        const r = smooth(clamp((s - pl.s) / (total * 0.012), 0, 1));
        if (r > 0.01) label(pl.x, pl.y, '', pl.name, r);
      }
      if (J) {
        J.stops.forEach((q, i) => {
          const x = sx(jpos[i].x), y = sy(jpos[i].y);
          const seen = t >= jt.arr[i] - 0.05;
          ctx.beginPath(); ctx.arc(x, y, (seen ? 11 : 8) * u, 0, 6.2832);
          if (seen && q.precision !== 'region') { ctx.fillStyle = S.accent; ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = S.head; ctx.stroke(); }
          else { ctx.fillStyle = seen ? S.panel : 'rgba(0,0,0,0)'; ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = seen ? S.accent : S.ghost; ctx.stroke(); }
        });
      } else {
        label(route.X[0], route.Y[0], L.start, o.startName, 1);
        label(route.X[route.n - 1], route.Y[route.n - 1], L.finish, o.endName, smooth(clamp((p - 0.82) / 0.18, 0, 1)) * 0.85 + 0.15);
      }

      // голова маршрута
      const pulse = (t * 1.6) % 1;
      ctx.beginPath(); ctx.arc(hx, hy, (16 + 34 * pulse) * u, 0, 6.2832);
      ctx.fillStyle = S.headHalo; ctx.globalAlpha = 0.9 * (1 - pulse); ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(hx, hy, 15 * u, 0, 6.2832);
      ctx.fillStyle = S.head; ctx.fill(); ctx.lineWidth = 6 * u; ctx.strokeStyle = S.line.stops[S.line.stops.length - 1]; ctx.stroke();
      }

      // затемнение по краям (только в обычном видео, не в слоях для монтажа)
      if (!TR) {
      const sc = S.scrim.join(',');
      let g = ctx.createLinearGradient(0, 0, 0, H * 0.32); g.addColorStop(0, `rgba(${sc},${S.paper ? 0.85 : 0.82})`); g.addColorStop(1, `rgba(${sc},0)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.32);
      g = ctx.createLinearGradient(0, H * (portrait ? 0.52 : 0.62), 0, H); g.addColorStop(0, `rgba(${sc},0)`); g.addColorStop(1, `rgba(${sc},${S.paper ? 0.8 : 0.85})`);
      ctx.fillStyle = g; ctx.fillRect(0, H * (portrait ? 0.52 : 0.62), W, H);
      if (S.paper) {
        ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.16; ctx.fillStyle = noisePattern(ctx); ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = S.ink; ctx.lineWidth = 3 * u; ctx.strokeRect(30 * u, 30 * u, W - 60 * u, H - 60 * u);
        ctx.lineWidth = 1.2 * u; ctx.strokeRect(40 * u, 40 * u, W - 80 * u, H - 80 * u);
      }
      }

      if (LY.hud) {
      overlay(ctx, t, p, head);
      if (J && J.note) T(ctx, J.note, (portrait ? 64 : 100) * u, (portrait ? 268 : 238) * u, { size: portrait ? 26 : 22, weight: 700, color: S.accent, ls: 2, max: W / u - (portrait ? 128 : 1000), shadow: S.paper ? null : 'rgba(0,0,0,.5)' });
      T(ctx, S.credit, W / 2, H - (S.paper ? 54 : 26) * u, { size: 17, weight: 500, color: S.dim, align: 'center', alpha: 0.75 });
      }
      ctx.restore();
    }

    function rr(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    function T(ctx, str, x, y, a) {
      ctx.save();
      const size = (a.size || 40) * u;
      ctx.font = `${a.weight || 700} ${size}px ${a.fam || S.fBody}`;
      ctx.fillStyle = a.color || S.ink; ctx.textAlign = a.align || 'left'; ctx.textBaseline = a.base || 'alphabetic';
      ctx.letterSpacing = (a.ls || 0) * u + 'px';
      if (a.alpha != null) ctx.globalAlpha *= a.alpha;
      if (a.shadow) { ctx.shadowColor = a.shadow; ctx.shadowBlur = 18 * u; ctx.shadowOffsetY = 3 * u; }
      if (a.max) { const w = ctx.measureText(str).width; if (w > a.max * u) ctx.font = `${a.weight || 700} ${size * (a.max * u / w)}px ${a.fam || S.fBody}`; }
      ctx.fillText(str, x, y);
      ctx.restore();
    }

    function overlay(ctx, t, p, head) {
      const sh = S.paper ? null : 'rgba(0,0,0,.45)';
      const mx = (portrait ? 64 : 100) * u;
      // верхний блок — название
      const intro = 1 - smooth(clamp((t - 0.9) / (t0 - 0.9), 0, 1));
      const outro = J && J.noOutro ? 0 : smooth(clamp((t - (t1 + 0.9)) / 0.9, 0, 1));
      const topA = 1;
      if (o.title) {
        T(ctx, o.title.toUpperCase(), mx, (portrait ? 150 : 130) * u, { size: portrait ? 76 : 70, fam: S.fHead, weight: S.headW, ls: 2, max: (W / u) - (portrait ? 128 : 200), shadow: sh, alpha: topA * (1 - intro) });
        if (o.subtitle) T(ctx, o.subtitle.toUpperCase(), mx, (portrait ? 150 : 130) * u + 56 * u, { size: 30, weight: 600, color: S.accent, ls: 5, max: (W / u) - 160, shadow: sh, alpha: topA * (1 - intro) });
      }

      if (J) { jOverlay(ctx, t, intro, outro, mx, sh); return; }
      // стат-панель
      const cells = [];
      if (route.speed && o.showSpeed) cells.push({ l: L.speed, v: fmt(head.speed, 0, L.locale), u: L.kmh });
      if (route.ele && o.showEle) cells.push({ l: L.ele, v: fmt(head.ele, 0, L.locale), u: L.m });
      if (cells.length + (head.day ? 1 : 0) < 3) { const rem = Math.max(0, total - p * total) / 1000; cells.push({ l: L.rem, v: fmt(rem, rem < 100 ? 1 : 0, L.locale), u: L.km }); }
      const panelA = (1 - intro) * (1 - outro);
      ctx.save(); ctx.globalAlpha = panelA;
      const pw = W - 2 * mx, ph = portrait ? 400 * u : 250 * u;
      const px0 = mx, py0 = portrait ? H - 330 * u - ph : H - 90 * u - ph;
      ctx.fillStyle = S.panel; ctx.strokeStyle = S.panelLine; ctx.lineWidth = 2 * u;
      rr(ctx, px0, py0, pw, ph, 28 * u); ctx.fill(); ctx.stroke();
      const pad = 40 * u;
      const distKm = (p * total) / 1000;
      const dTxt = fmt(distKm, distKm < 100 ? 1 : 0, L.locale);
      const day = head.day;

      if (portrait) {
        T(ctx, L.dist, px0 + pad, py0 + 66 * u, { size: 26, weight: 600, color: S.dim, ls: 5 });
        T(ctx, dTxt, px0 + pad, py0 + 188 * u, { size: 150, fam: S.fHead, weight: S.headW });
        ctx.font = `${S.headW} ${150 * u}px ${S.fHead}`; const dw = ctx.measureText(dTxt).width;
        T(ctx, L.km, px0 + pad + dw + 16 * u, py0 + 188 * u, { size: 52, fam: S.fHead, weight: 600, color: S.accent });
        if (day) {
          T(ctx, L.day, px0 + pw - pad, py0 + 66 * u, { size: 26, weight: 600, color: S.dim, ls: 5, align: 'right' });
          T(ctx, String(day), px0 + pw - pad, py0 + 150 * u, { size: 96, fam: S.fHead, weight: S.headW, align: 'right' });
          T(ctx, dateStr(head.t, head.lon), px0 + pw - pad, py0 + 190 * u, { size: 30, weight: 500, color: S.dim, align: 'right' });
        }
        profile(ctx, px0 + pad, py0 + 222 * u, pw - 2 * pad, 84 * u, p);
        cells.forEach((cl, i) => {
          const x = px0 + pad + (i * (pw - 2 * pad)) / Math.max(1, cells.length);
          T(ctx, cl.l, x, py0 + ph - 62 * u, { size: 22, weight: 600, color: S.dim, ls: 4 });
          T(ctx, cl.v, x, py0 + ph - 20 * u, { size: 50, fam: S.fHead, weight: S.headW });
          ctx.font = `${S.headW} ${50 * u}px ${S.fHead}`; const vw = ctx.measureText(cl.v).width;
          T(ctx, cl.u, x + vw + 10 * u, py0 + ph - 20 * u, { size: 28, weight: 500, color: S.accent });
        });
        if (!cells.length && !route.ele) { /* только дистанция и день — панель остаётся лаконичной */ }
      } else {
        T(ctx, L.dist, px0 + pad, py0 + 58 * u, { size: 24, weight: 600, color: S.dim, ls: 5 });
        T(ctx, dTxt, px0 + pad, py0 + 178 * u, { size: 128, fam: S.fHead, weight: S.headW });
        ctx.font = `${S.headW} ${128 * u}px ${S.fHead}`; const dw = ctx.measureText(dTxt).width;
        T(ctx, L.km, px0 + pad + dw + 14 * u, py0 + 178 * u, { size: 46, fam: S.fHead, weight: 600, color: S.accent });
        let cx = px0 + pad + 520 * u;
        const all = [];
        if (day) all.push({ l: L.day, v: String(day), u: dateStr(head.t, head.lon) });
        cells.forEach((cl) => all.push(cl));
        all.forEach((cl) => {
          T(ctx, cl.l, cx, py0 + 58 * u, { size: 22, weight: 600, color: S.dim, ls: 4 });
          T(ctx, cl.v, cx, py0 + 140 * u, { size: 72, fam: S.fHead, weight: S.headW });
          ctx.font = `${S.headW} ${72 * u}px ${S.fHead}`; const vw = ctx.measureText(cl.v).width;
          T(ctx, cl.u, cx, py0 + 190 * u, { size: 28, weight: 500, color: S.accent });
          cx += Math.max(vw, 150 * u) + 70 * u;
        });
        profile(ctx, Math.max(cx, px0 + pad + 760 * u), py0 + 44 * u, px0 + pw - pad - Math.max(cx, px0 + pad + 760 * u), ph - 88 * u, p);
      }
      ctx.restore();

      // фото автора: «полароид» с подписью
      let phActive = false;
      for (const q of PH) {
        if (!q.e.ok || t < q.arr - 0.05 || t > q.leave + 0.4) continue;
        const a = smooth(clamp((t - q.arr) / 0.3, 0, 1)) * (1 - smooth(clamp((t - q.leave) / 0.4, 0, 1)));
        if (a <= 0.01) continue;
        phActive = true;
        const fw = (portrait ? 610 : 640) * u, fh = 480 * u, bottom = 80 * u, pad = 18 * u;
        const cx = portrait ? W / 2 : W - mx - fw / 2 - 20 * u, cy = portrait ? H * 0.135 + fh / 2 : 160 * u + fh / 2;
        ctx.save(); ctx.globalAlpha = a * (1 - intro) * (1 - outro);
        ctx.translate(cx, cy + (1 - a) * 34 * u); ctx.rotate(((q.tilt * (0.5 + 0.5 * a)) * Math.PI) / 180);
        ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 30 * u; ctx.shadowOffsetY = 10 * u;
        ctx.fillStyle = S.paper ? '#fbf3df' : '#ffffff'; rr(ctx, -fw / 2, -fh / 2, fw, fh, 8 * u); ctx.fill();
        ctx.shadowColor = 'transparent';
        const pw_ = fw - 2 * pad, ph_ = fh - pad - bottom;
        ctx.save(); rr(ctx, -fw / 2 + pad, -fh / 2 + pad, pw_, ph_, 4 * u); ctx.clip();
        const im = q.e.img, k = clamp((t - q.arr) / Math.max(0.1, q.leave - q.arr), 0, 1), zk = 1 + 0.08 * k;
        const scl = Math.max(pw_ / im.width, ph_ / im.height) * zk, dw = im.width * scl, dh = im.height * scl;
        ctx.drawImage(im, -fw / 2 + pad + (pw_ - dw) / 2, -fh / 2 + pad + (ph_ - dh) / 2, dw, dh);
        ctx.restore();
        const kmTxt = fmt(q.s / 1000, q.s < 1e5 ? 1 : 0, L.locale) + ' ' + L.km;
        const ink = S.paper ? '#3b2412' : '#1b1b1b';
        if (q.caption) {
          T(ctx, q.caption, -fw / 2 + pad + 6 * u, fh / 2 - bottom / 2 + 12 * u, { size: 32, weight: 600, color: ink, max: (pw_ - 150 * u) / u, fam: S.fBody });
          T(ctx, kmTxt, fw / 2 - pad - 6 * u, fh / 2 - bottom / 2 + 12 * u, { size: 24, weight: 600, color: '#888', align: 'right' });
        } else T(ctx, kmTxt, 0, fh / 2 - bottom / 2 + 12 * u, { size: 30, weight: 600, color: ink, align: 'center' });
        ctx.restore();
      }

      // вехи (не поверх фото)
      for (const e of events) {
        if (phActive) break;
        const dt = t - e.t;
        if (dt < 0 || dt > 2.0) continue;
        const a = smooth(clamp(dt / 0.25, 0, 1)) * (1 - smooth(clamp((dt - 1.5) / 0.5, 0, 1)));
        const yy = (portrait ? H * 0.205 : H * 0.28) + (1 - smooth(clamp(dt / 0.3, 0, 1))) * 24 * u;
        ctx.save(); ctx.globalAlpha = a * panelA;
        ctx.font = `${S.headW} ${(portrait ? 92 : 84) * u}px ${S.fHead}`; ctx.letterSpacing = 3 * u + 'px';
        const w1 = ctx.measureText(e.big).width; ctx.font = `600 ${30 * u}px ${S.fBody}`; ctx.letterSpacing = 4 * u + 'px';
        const w2 = ctx.measureText(e.sub.toUpperCase()).width;
        const bw2 = Math.max(w1, w2) + 90 * u, bh2 = 190 * u;
        ctx.fillStyle = S.panel; ctx.strokeStyle = S.accent; ctx.lineWidth = 3 * u;
        rr(ctx, W / 2 - bw2 / 2, yy, bw2, bh2, 26 * u); ctx.fill(); ctx.stroke();
        T(ctx, e.big, W / 2, yy + 100 * u, { size: portrait ? 92 : 84, fam: S.fHead, weight: S.headW, align: 'center', ls: 3 });
        T(ctx, e.sub.toUpperCase(), W / 2, yy + 152 * u, { size: 30, weight: 600, color: S.accent, align: 'center', ls: 4 });
        ctx.restore();
      }

      // заставка
      if (intro > 0.01) {
        ctx.save(); ctx.globalAlpha = intro;
        const sc = S.scrim.join(',');
        if (!curTR) { ctx.fillStyle = `rgba(${sc},${S.paper ? 0.72 : 0.7})`; ctx.fillRect(0, 0, W, H); }
        const cy = portrait ? H * 0.42 : H * 0.46;
        const sl = (1 - intro) * -30 * u;
        T(ctx, (o.title || route.name).toUpperCase(), W / 2, cy + sl, { size: portrait ? 118 : 120, fam: S.fHead, weight: S.headW, align: 'center', ls: 4, max: (W / u) - 140, shadow: sh });
        if (o.subtitle) T(ctx, o.subtitle.toUpperCase(), W / 2, cy + 72 * u + sl, { size: 36, weight: 600, color: S.accent, align: 'center', ls: 8, max: (W / u) - 160, shadow: sh });
        T(ctx, fmt(total / 1000, total < 1e5 ? 1 : 0, L.locale) + ' ' + L.km.toUpperCase() + (route.days ? '  ·  ' + route.days + ' ' + L.dayWord(route.days).toUpperCase() : ''), W / 2, cy + 150 * u + sl, { size: 40, weight: 600, align: 'center', ls: 6, shadow: sh });
        if (o.note) wrapText(ctx, '«' + o.note + '»', W - 220 * u, `italic 500 ${38 * u}px ${S.fBody}`, 3).forEach((ln, k) => T(ctx, ln, W / 2, cy + 236 * u + k * 50 * u + sl, { size: 38, weight: 'italic 500', align: 'center', shadow: sh, fam: S.fBody }));
        ctx.restore();
      }

      // итог
      if (outro > 0.01) {
        ctx.save(); ctx.globalAlpha = outro;
        const w = Math.min(pw, 900 * u), h = (portrait ? 560 : 420) * u;
        const x = W / 2 - w / 2, y = portrait ? H * 0.69 - h / 2 : H * 0.5 - h / 2 + 40 * u;
        const yy = y + (1 - outro) * 30 * u;
        ctx.fillStyle = S.panel; ctx.strokeStyle = S.accent; ctx.lineWidth = 3 * u; rr(ctx, x, yy, w, h, 32 * u); ctx.fill(); ctx.stroke();
        T(ctx, (o.title || route.name).toUpperCase(), W / 2, yy + 80 * u, { size: 44, fam: S.fHead, weight: S.headW, align: 'center', ls: 3, max: w / u - 80 });
        T(ctx, L.total, W / 2, yy + 140 * u, { size: 24, weight: 600, color: S.dim, align: 'center', ls: 6 });
        T(ctx, fmt(total / 1000, total < 1e5 ? 1 : 0, L.locale) + ' ' + L.km, W / 2, yy + 260 * u, { size: portrait ? 150 : 140, fam: S.fHead, weight: S.headW, align: 'center' });
        const st = [];
        if (route.days) st.push([L.days, String(route.days)]);
        if (route.ele && o.showEle && route.stats.gain > 0) st.push([L.gain, '+' + fmt(route.stats.gain, 0, L.locale) + ' ' + L.m]);
        if (route.stats.avg && o.showSpeed) st.push([L.avg, fmt(route.stats.avg, 1, L.locale) + ' ' + L.kmh]);
        const colW = (w - 80 * u) / Math.max(1, st.length);
        st.forEach(([l, v], i) => {
          const cxx = x + 40 * u + colW * (i + 0.5);
          T(ctx, l, cxx, yy + h - 130 * u + (portrait ? 40 * u : 0), { size: 20, weight: 600, color: S.dim, align: 'center', ls: 3 });
          T(ctx, v, cxx, yy + h - 70 * u + (portrait ? 40 * u : 0), { size: 46, fam: S.fHead, weight: S.headW, align: 'center', max: colW / u - 20 });
        });
        if (o.startName && o.endName) T(ctx, `${o.startName}  →  ${o.endName}`.toUpperCase(), W / 2, yy + h - 28 * u, { size: 24, weight: 600, color: S.accent, align: 'center', ls: 4, max: w / u - 60 });
        ctx.restore();
      }
    }

    function wrapText(ctx, text, maxW, font, maxLines) {
      ctx.save(); ctx.font = font;
      const words = String(text).split(/\s+/); const lines = []; let cur = '';
      for (const w of words) { const tt = cur ? cur + ' ' + w : w; if (ctx.measureText(tt).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tt; }
      if (cur) lines.push(cur);
      ctx.restore();
      if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s,.;:]*$/, '') + '…'; }
      return lines;
    }

    function jOverlay(ctx, t, intro, outro, mx, sh) {
      const st = J.stops, n = st.length, g = jSeg(t);
      const panelA = (1 - intro) * (1 - outro);
      const i = g.i, ca = smooth(clamp((t - jt.arr[i]) / 0.35, 0, 1)) * (1 - smooth(clamp((t - jt.leave[i]) / 0.3, 0, 1)));
      const pw = W - 2 * mx, ph = 230 * u, py0 = portrait ? H - 330 * u - ph : H - 120 * u - ph;
      // карточка остановки (с фото, если оно есть)
      if (ca > 0.01 && t >= jt.arr[0] && outro < 0.5) {
        const q = st[i], ph0 = photos[i], hasPh = !!(ph0 && ph0.ok);
        const cw = portrait ? pw : (hasPh ? 920 : 720) * u;
        const chh = portrait ? (hasPh ? 648 : 380) * u : (hasPh ? 440 : 470) * u;
        const cx = portrait ? mx : W - mx - cw, cy = (portrait ? py0 - 28 * u - chh : H * 0.205) + (1 - ca) * 26 * u;
        ctx.save(); ctx.globalAlpha = ca * (1 - outro);
        ctx.fillStyle = panelSolid; ctx.strokeStyle = S.accent; ctx.lineWidth = 3 * u;
        rr(ctx, cx, cy, cw, chh, 28 * u); ctx.fill(); ctx.stroke();
        let tx = cx + 40 * u, ty = cy, tw = cw - 80 * u;
        if (hasPh) {
          const inset = 16 * u;
          const px_ = cx + inset, py_ = cy + inset;
          const pw_ = portrait ? cw - 2 * inset : 360 * u - inset, ph_ = portrait ? 300 * u - inset : chh - 2 * inset;
          ctx.save(); rr(ctx, px_, py_, pw_, ph_, 20 * u); ctx.clip();
          const im = ph0.img, k0 = clamp((t - jt.arr[i]) / (jt.leave[i] - jt.arr[i]), 0, 1), zoomK = 1 + 0.09 * k0;
          const sc = Math.max(pw_ / im.width, ph_ / im.height) * zoomK, dw = im.width * sc, dh = im.height * sc;
          ctx.drawImage(im, px_ + (pw_ - dw) / 2, py_ + (ph_ - dh) * (0.45 - 0.1 * k0), dw, dh);
          const gg = ctx.createLinearGradient(0, py_ + ph_ - 60 * u, 0, py_ + ph_); gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(1, 'rgba(0,0,0,0.55)');
          ctx.fillStyle = gg; ctx.fillRect(px_, py_ + ph_ - 60 * u, pw_, 60 * u);
          T(ctx, ('Фото @wahrider · пост ' + q.photoPost).toUpperCase(), px_ + 16 * u, py_ + ph_ - 16 * u, { size: 15, weight: 600, color: '#fff', ls: 2 });
          ctx.restore();
          if (portrait) { ty = cy + 300 * u; } else { tx = cx + 360 * u + 36 * u; tw = cw - 360 * u - 36 * u - 36 * u; }
        }
        const compact = hasPh && portrait;
        T(ctx, (q.country + (q.precision === 'region' ? '  ·  ≈' : '')).toUpperCase(), tx, ty + (compact ? 50 : 62) * u, { size: 24, weight: 600, color: S.accent, ls: 5, max: tw / u });
        T(ctx, q.name, tx, ty + (compact ? 128 : 150) * u, { size: hasPh && !portrait ? 62 : (compact ? 76 : (portrait ? 84 : 76)), fam: S.fHead, weight: S.headW, max: tw / u });
        T(ctx, q.dateLabel, tx, ty + (compact ? 172 : 200) * u, { size: compact ? 30 : 34, weight: 600, color: S.dim, max: tw / u });
        const fs = compact ? 31 : (hasPh ? 30 : 34), lh = compact ? 42 : (hasPh ? 40 : 46);
        const font = `500 ${fs * u}px ${S.fBody}`;
        wrapText(ctx, q.fact, tw, font, portrait ? (compact ? 3 : 3) : (hasPh ? 5 : 5)).forEach((ln, k) => T(ctx, ln, tx, ty + (compact ? 222 : 256) * u + k * lh * u, { size: fs, weight: 500, fam: S.fBody }));
        ctx.restore();
      }
      // нижняя панель: когда / страны / пройдено + лента остановок
      ctx.save(); ctx.globalAlpha = panelA;
      ctx.fillStyle = S.panel; ctx.strokeStyle = S.panelLine; ctx.lineWidth = 2 * u;
      rr(ctx, mx, py0, pw, ph, 28 * u); ctx.fill(); ctx.stroke();
      const dispI = g.leg && g.u > 0.5 ? g.i + 1 : g.i;
      const seen = new Set(); for (let k = 0; k <= dispI; k++) seen.add(st[k].country);
      const all = new Set(st.map((x) => x.country));
      // число меняется только там, где автор назвал новую цифру; на переезде показываем последнюю названную (без выдуманных промежуточных)
      let km = kmShown[g.i];
      if (!g.leg && st[g.i].km != null && g.i > 0 && kmShown[g.i - 1] != null) km = lerp(kmShown[g.i - 1], st[g.i].km, smooth(clamp((t - jt.arr[g.i]) / 0.8, 0, 1)));
      const cells = [{ l: L.when, v: st[dispI].dateLabel, small: true }, { l: L.countries, v: seen.size + ' / ' + all.size }];
      if (km != null) cells.push({ l: L.passed, v: fmt(km, 0, L.locale), u: L.km });
      const colW = (pw - 80 * u) / cells.length;
      cells.forEach((cl, k) => {
        const x = mx + 40 * u + k * colW;
        T(ctx, cl.l, x, py0 + 52 * u, { size: 22, weight: 600, color: S.dim, ls: 4 });
        T(ctx, cl.v, x, py0 + 118 * u, { size: cl.small ? 40 : 66, fam: S.fHead, weight: S.headW, max: colW / u - 40 });
        if (cl.u) { ctx.font = `${S.headW} ${66 * u}px ${S.fHead}`; const vw = ctx.measureText(cl.v).width; T(ctx, cl.u, x + vw + 12 * u, py0 + 118 * u, { size: 30, weight: 500, color: S.accent }); T(ctx, L.byAuthor.toUpperCase(), x, py0 + 150 * u, { size: 17, weight: 600, color: S.dim, ls: 3 }); }
      });
      // номер этапа вместо ленты точек: «где мы» без шкалы прогресса
      T(ctx, 'ЭТАП ' + (dispI + 1) + ' ИЗ ' + n, mx + pw - 40 * u, py0 + ph - 34 * u, { size: 22, weight: 600, color: S.dim, align: 'right', ls: 4 });
      ctx.restore();
      // заставка
      if (intro > 0.01) {
        ctx.save(); ctx.globalAlpha = intro;
        const sc = S.scrim.join(',');
        if (!curTR) { ctx.fillStyle = `rgba(${sc},${S.paper ? 0.72 : 0.7})`; ctx.fillRect(0, 0, W, H); }
        const cy = portrait ? H * 0.42 : H * 0.46, sl = (1 - intro) * -30 * u;
        T(ctx, (o.title || route.name).toUpperCase(), W / 2, cy + sl, { size: portrait ? 118 : 120, fam: S.fHead, weight: S.headW, align: 'center', ls: 4, max: (W / u) - 140, shadow: sh });
        if (o.subtitle) T(ctx, o.subtitle.toUpperCase(), W / 2, cy + 72 * u + sl, { size: 36, weight: 600, color: S.accent, align: 'center', ls: 8, max: (W / u) - 160, shadow: sh });
        if (J.introLine) T(ctx, J.introLine, W / 2, cy + 150 * u + sl, { size: 40, weight: 600, align: 'center', ls: 6, shadow: sh, max: (W / u) - 160 });
        ctx.restore();
      }
      // итог пути
      if (outro > 0.01 && J.summary) {
        const sm = J.summary;
        ctx.save(); ctx.globalAlpha = outro;
        const w = Math.min(pw, 900 * u), h = (portrait ? 560 : 520) * u, x = W / 2 - w / 2;
        const y = (portrait ? H * 0.66 - h / 2 : H * 0.5 - h / 2 + 20 * u) + (1 - outro) * 30 * u;
        ctx.fillStyle = panelSolid; ctx.strokeStyle = S.accent; ctx.lineWidth = 3 * u; rr(ctx, x, y, w, h, 32 * u); ctx.fill(); ctx.stroke();
        T(ctx, (o.title || route.name).toUpperCase(), W / 2, y + 80 * u, { size: 44, fam: S.fHead, weight: S.headW, align: 'center', ls: 3, max: w / u - 80 });
        T(ctx, L.passed, W / 2, y + 118 * u, { size: 24, weight: 600, color: S.dim, align: 'center', ls: 6 });
        T(ctx, sm.big, W / 2, y + 255 * u, { size: portrait ? 150 : 140, fam: S.fHead, weight: S.headW, align: 'center', max: w / u - 80 });
        T(ctx, sm.note, W / 2, y + 305 * u, { size: 24, weight: 600, color: S.accent, align: 'center', ls: 2, max: w / u - 80 });
        const cs = sm.cells || [], colW = (w - 80 * u) / Math.max(1, cs.length);
        cs.forEach(([l, v], k) => {
          const cxx = x + 40 * u + colW * (k + 0.5);
          T(ctx, l, cxx, y + h - 115 * u, { size: 20, weight: 600, color: S.dim, align: 'center', ls: 3 });
          T(ctx, v, cxx, y + h - 55 * u, { size: 46, fam: S.fHead, weight: S.headW, align: 'center', max: colW / u - 20 });
        });
        ctx.restore();
      }
    }

    function profile(ctx, x, y, w, h, p) {
      if (!prof.length || w < 60 * u || h < 30 * u) return;
      const n = prof.length, X = (i) => x + (i / (n - 1)) * w, Y = (e) => y + h - ((e - prof.min) / (prof.max - prof.min)) * h;
      const path = (to) => { ctx.beginPath(); ctx.moveTo(X(0), y + h); for (let i = 0; i <= to; i++) ctx.lineTo(X(i), Y(prof[i])); };
      ctx.save();
      path(n - 1); ctx.lineTo(X(n - 1), y + h); ctx.closePath();
      ctx.fillStyle = S.panelLine; ctx.globalAlpha *= 0.55; ctx.fill(); ctx.globalAlpha /= 0.55;
      const hi = p * (n - 1), lo = Math.floor(hi);
      ctx.save(); ctx.beginPath(); ctx.rect(x - 4, y - 10 * u, (X(hi) - x) + 4, h + 20 * u); ctx.clip();
      path(n - 1); ctx.lineTo(X(n - 1), y + h); ctx.closePath();
      const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, S.accent); g.addColorStop(1, 'rgba(255,255,255,0.05)');
      ctx.globalAlpha *= 0.85; ctx.fillStyle = g; ctx.fill(); ctx.restore();
      const e = lerp(prof[lo], prof[Math.min(n - 1, lo + 1)], hi - lo);
      ctx.beginPath(); ctx.arc(X(hi), Y(e), 8 * u, 0, 6.2832); ctx.fillStyle = S.ink; ctx.fill();
      ctx.restore();
    }

    return { draw, tilesAt, cam, W, H, duration: D, events, style: S, assetsReady, photos: PH };
  }

  window.RS = { createScene, STYLES, I18N, getTile, setOnTile: (f) => { onTile = f; } };
})();
