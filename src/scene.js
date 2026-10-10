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

  /* ---------- стили ---------- */
  const STYLES = {
    night: {
      name: 'Ночной неон',
      bg: '#0b0f14',
      layers: [esri('dark', 'Canvas/World_Dark_Gray_Base', { filter: 'brightness(1.15) contrast(1.2)' }), L_DARK()],
      tint: { mode: 'overlay', stops: ['#5b2bd6', '#0e86c9', '#0fb5a6'] },
      ghost: 'rgba(255,255,255,.34)', ghostW: 7, ghostDash: null,
      line: { stops: ['#22d3ee', '#a78bfa', '#fb7185'], glow: 'rgba(125,211,252,.38)', w: 11 },
      head: '#ffffff', headHalo: 'rgba(125,211,252,.55)',
      ink: '#f8fafc', dim: 'rgba(226,232,240,.62)', accent: '#67e8f9',
      panel: 'rgba(8,12,20,.72)', panelLine: 'rgba(148,163,184,.28)',
      fHead: '"Oswald", "Arial Narrow", sans-serif', fBody: '"Inter", "Segoe UI", system-ui, sans-serif', headW: 700,
      scrim: [0, 0, 0], credit: 'Map © Esri, HERE, Garmin, OpenStreetMap contributors',
    },
    paper: {
      name: 'Бумажная карта',
      bg: '#e9dcc0',
      layers: [esri('topo', 'World_Topo_Map', { filter: 'sepia(.8) saturate(.8) contrast(.95) brightness(.98)', maxZ: 17 })],
      ghost: 'rgba(92,58,30,.5)', ghostW: 5, ghostDash: [4, 14],
      line: { stops: ['#9a3412', '#7c2d12'], glow: 'rgba(154,52,18,.18)', w: 9 },
      head: '#fff7e6', headHalo: 'rgba(154,52,18,.35)',
      ink: '#3b2412', dim: 'rgba(59,36,18,.65)', accent: '#9a3412',
      panel: 'rgba(247,236,211,.93)', panelLine: 'rgba(92,58,30,.55)',
      fHead: '"Playfair Display", Georgia, serif', fBody: '"Lora", Georgia, serif', headW: 800,
      scrim: [233, 220, 192], paper: true, credit: 'Map © Esri, HERE, Garmin, OpenStreetMap contributors',
    },
    sat: {
      name: 'Спутник',
      bg: '#10150f',
      layers: [esri('imagery', 'World_Imagery', { filter: 'saturate(1.1) contrast(1.05)', maxZ: 17 }), L_DARK()],
      ghost: 'rgba(255,255,255,.35)', ghostW: 6, ghostDash: null,
      line: { stops: ['#fde047', '#fb923c'], glow: 'rgba(253,224,71,.4)', w: 10 },
      head: '#ffffff', headHalo: 'rgba(253,224,71,.5)',
      ink: '#ffffff', dim: 'rgba(255,255,255,.7)', accent: '#fde047',
      panel: 'rgba(10,14,10,.7)', panelLine: 'rgba(255,255,255,.25)',
      fHead: '"Oswald", "Arial Narrow", sans-serif', fBody: '"Inter", "Segoe UI", system-ui, sans-serif', headW: 700,
      scrim: [0, 0, 0], credit: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
  };

  const I18N = {
    ru: { dist: 'ДИСТАНЦИЯ', km: 'км', speed: 'СКОРОСТЬ', kmh: 'км/ч', ele: 'ВЫСОТА', m: 'м', day: 'ДЕНЬ', start: 'СТАРТ', finish: 'ФИНИШ', total: 'ВСЕГО', gain: 'НАБОР ВЫСОТЫ', avg: 'СРЕДНЯЯ', days: 'ДНЕЙ', top: 'ВЫСШАЯ ТОЧКА', left: 'осталось', rem: 'ОСТАЛОСЬ', locale: 'ru-RU', dayWord: (n) => (n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'дня' : 'дней') },
    en: { dist: 'DISTANCE', km: 'km', speed: 'SPEED', kmh: 'km/h', ele: 'ELEVATION', m: 'm', day: 'DAY', start: 'START', finish: 'FINISH', total: 'TOTAL', gain: 'ELEVATION GAIN', avg: 'AVG SPEED', days: 'DAYS', top: 'HIGHEST POINT', left: 'left', rem: 'REMAINING', locale: 'en-GB', dayWord: (n) => (n === 1 ? 'day' : 'days') },
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
    const t0 = Math.min(2.2, D * 0.2);          // конец заставки
    const t1 = D - Math.min(4, D * 0.28);        // конец пути, начало итога
    const total = route.total;

    // положение «якоря» камеры на экране и рамка для общего плана
    const ax = W / 2, ay = portrait ? H * 0.38 : H * 0.44;
    const fitW = portrait ? W * 0.84 : W * 0.7, fitH = portrait ? H * 0.34 : H * 0.46;
    const bw = Math.max(route.bx1 - route.bx0, 1e-7), bh = Math.max(route.by1 - route.by0, 1e-7);
    const zFit = clamp(Math.log2(Math.min(fitW / bw, fitH / bh)), 2, 16);
    const zFol = clamp(zFit + 1.7, zFit, 15);
    const cx0 = (route.bx0 + route.bx1) / 2, cy0 = (route.by0 + route.by1) / 2;

    const prog = (t) => { const x = clamp((t - t0) / (t1 - t0), 0, 1); return lerp(x, smooth(x), 0.45); };
    const tOfProg = (p) => { let a = t0, b = t1; for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (prog(m) < p) a = m; else b = m; } return a; };

    function cam(t) {
      const p = prog(t), s = p * total;
      let fx = 0, fy = 0; const n = 7, w = total * 0.012;
      for (let j = 0; j < n; j++) { const q = at(route, s - j * w); fx += q.x; fy += q.y; }
      fx /= n; fy /= n;
      const a = easeIO(clamp((t - (t0 - 0.9)) / 2.0, 0, 1));
      const b = easeIO(clamp((t - t1) / 2.4, 0, 1));
      let z = lerp(zFit, zFol, a), cx = lerp(cx0, fx, a), cy = lerp(cy0, fy, a);
      z = lerp(z, zFit, b); cx = lerp(cx, cx0, b); cy = lerp(cy, cy0, b);
      return { z, cx, cy };
    }

    /* какие тайлы нужны на кадре (для догрузки перед экспортом и для отрисовки) */
    function tilesAt(t) {
      const c = cam(t), out = [];
      S.layers.forEach((layer, li) => {
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
    {
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
    const cache = {};
    function gradient(ctx, key, make) { return cache[key] || (cache[key] = make(ctx)); }

    /* ---------- рисование ---------- */
    function draw(ctx, t) {
      const c = cam(t);
      const p = prog(t), s = p * total;
      const head = at(route, s);
      const k = Math.pow(2, c.z);
      const left = c.cx * k - ax, top = c.cy * k - ay;
      const sx = (X) => X * k - left, sy = (Y) => Y * k - top;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = S.bg; ctx.fillRect(0, 0, W, H);

      // карта
      const need = tilesAt(t);
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
      if (S.tint) {
        const tg = ctx.createLinearGradient(0, 0, W * 0.4, H);
        S.tint.stops.forEach((c, i, a) => tg.addColorStop(i / (a.length - 1), c));
        ctx.globalAlpha = 0.72; ctx.globalCompositeOperation = S.tint.mode; ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
      if (S.paper) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(240,214,160,.35)'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }

      // линия маршрута
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const path = (to) => {
        ctx.beginPath(); ctx.moveTo(sx(route.X[0]), sy(route.Y[0]));
        for (let i = 1; i <= to; i++) ctx.lineTo(sx(route.X[i]), sy(route.Y[i]));
      };
      path(route.n - 1);
      ctx.strokeStyle = S.ghost; ctx.lineWidth = S.ghostW * u;
      if (S.ghostDash) ctx.setLineDash(S.ghostDash.map((d) => d * u)); ctx.stroke(); ctx.setLineDash([]);

      const hx = sx(head.x), hy = sy(head.y);
      path(head.i); ctx.lineTo(hx, hy);
      ctx.strokeStyle = S.line.glow; ctx.lineWidth = S.line.w * 2.6 * u; ctx.stroke();
      const x0 = sx(route.X[0]), y0 = sy(route.Y[0]);
      const gr = ctx.createLinearGradient(x0, y0, Math.abs(hx - x0) + Math.abs(hy - y0) < 2 ? x0 + 1 : hx, hy);
      S.line.stops.forEach((col, i, a) => gr.addColorStop(i / (a.length - 1), col));
      ctx.strokeStyle = gr; ctx.lineWidth = S.line.w * u; ctx.stroke();
      {
        const j = at(route, Math.max(0, s - total * 0.06)).i;
        ctx.beginPath(); ctx.moveTo(sx(route.X[j]), sy(route.Y[j]));
        for (let i = j + 1; i <= head.i; i++) ctx.lineTo(sx(route.X[i]), sy(route.Y[i]));
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
      label(route.X[0], route.Y[0], L.start, o.startName, 1);
      label(route.X[route.n - 1], route.Y[route.n - 1], L.finish, o.endName, smooth(clamp((p - 0.82) / 0.18, 0, 1)) * 0.85 + 0.15);

      // голова маршрута
      const pulse = (t * 1.6) % 1;
      ctx.beginPath(); ctx.arc(hx, hy, (16 + 34 * pulse) * u, 0, 6.2832);
      ctx.fillStyle = S.headHalo; ctx.globalAlpha = 0.9 * (1 - pulse); ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(hx, hy, 15 * u, 0, 6.2832);
      ctx.fillStyle = S.head; ctx.fill(); ctx.lineWidth = 6 * u; ctx.strokeStyle = S.line.stops[S.line.stops.length - 1]; ctx.stroke();

      // затемнение по краям
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

      overlay(ctx, t, p, head);
      T(ctx, S.credit, W / 2, H - (S.paper ? 54 : 26) * u, { size: 17, weight: 500, color: S.dim, align: 'center', alpha: 0.75 });
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
      const outro = smooth(clamp((t - (t1 + 0.9)) / 0.9, 0, 1));
      const topA = 1;
      if (o.title) {
        T(ctx, o.title.toUpperCase(), mx, (portrait ? 150 : 130) * u, { size: portrait ? 76 : 70, fam: S.fHead, weight: S.headW, ls: 2, max: (W / u) - (portrait ? 128 : 200), shadow: sh, alpha: topA * (1 - intro) });
        if (o.subtitle) T(ctx, o.subtitle.toUpperCase(), mx, (portrait ? 150 : 130) * u + 56 * u, { size: 30, weight: 600, color: S.accent, ls: 5, max: (W / u) - 160, shadow: sh, alpha: topA * (1 - intro) });
      }

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

      // вехи
      for (const e of events) {
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
        ctx.fillStyle = `rgba(${sc},${S.paper ? 0.55 : 0.5})`; ctx.fillRect(0, 0, W, H);
        const cy = portrait ? H * 0.42 : H * 0.46;
        const sl = (1 - intro) * -30 * u;
        T(ctx, (o.title || route.name).toUpperCase(), W / 2, cy + sl, { size: portrait ? 118 : 120, fam: S.fHead, weight: S.headW, align: 'center', ls: 4, max: (W / u) - 140, shadow: sh });
        if (o.subtitle) T(ctx, o.subtitle.toUpperCase(), W / 2, cy + 72 * u + sl, { size: 36, weight: 600, color: S.accent, align: 'center', ls: 8, max: (W / u) - 160, shadow: sh });
        T(ctx, fmt(total / 1000, total < 1e5 ? 1 : 0, L.locale) + ' ' + L.km.toUpperCase() + (route.days ? '  ·  ' + route.days + ' ' + L.dayWord(route.days).toUpperCase() : ''), W / 2, cy + 150 * u + sl, { size: 40, weight: 600, align: 'center', ls: 6, shadow: sh });
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

    return { draw, tilesAt, cam, W, H, duration: D, events, style: S };
  }

  window.RS = { createScene, STYLES, I18N, getTile, setOnTile: (f) => { onTile = f; } };
})();
