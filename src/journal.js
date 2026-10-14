/* «Дневник» — стиль-страница (макет V2 «скевоморфный дневник» из design/journal-tokens-v2.json).
   Без тайлов карты: настоящий трек рисуется чернильной линией на миллиметровке, данные — на рваных бумажных карточках,
   фото — в полароиде со скотчем, место — стикером, герой — Барбос (стикер из утверждённого рендера) или знак героя.
   Все координаты в u (u = min(W,H)/1080 px); отступы, шрифты и поля — из токенов V2. Ничего не выдумывается:
   нет данных — нет блока. Подключается из episode.js: Journal.create(E).draw(...) вместо слоя карты. */
(function () {
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const C = { paper: '#eee6d4', card: '#fbf7ee', ink: '#1d3a40', secondary: '#5d5446', accent: '#c4552b', green: '#1f4e5a', gold: '#d66a34', blue: '#3f7480', desk: '#1b2a30', guide: '#8a8170' };   // палитра рамок-коллажей: бумага, бирюза, жжёный оранжевый
  const ART = 'art/';
  const CELL = 0.66;   // ширина цифры в em: у всех цифр счётчика одна ячейка, число не «дрожит» (токены V2: typography.canvasNumbers)

  /* раскладки (токены V2, ед. u): [x, y, w, h] */
  const LAY = {
    v: {
      cover: { head: [164, 320, 752, 128], dest: [164, 464, 752, 216], hero: [344, 744, 440, 696], wash: [96, 660, 920, 840], tape: [232, 724, 288, 80] },
      road: { map: [96, 416, 888, 848], core: [192, 592, 696, 544], names: [164, 448, 752, 72], metric: [96, 1292, 888, 0], tape: [652, 392, 288, 80], sticker: [716, 1160, 220, 220] },
      photo: { card: [156, 396, 768, 1120], win: [188, 428, 704, 880], cap: [188, 1340, 704, 96], date: [188, 1452, 704, 56], tape: [392, 356, 288, 80] },
      arrival: { title: [164, 320, 752, 172], sticker: [196, 556, 688, 688], date: [164, 1308, 752, 56], tape: [600, 536, 288, 80] },
      elev: { metric: [164, 336, 752, 0], prof: [96, 660, 888, 752], core: [192, 756, 696, 560], cap: [164, 1444, 752, 72], tape: [196, 636, 288, 80] },
      fin: { receipt: [128, 384, 824, 1056], metric: [164, 560, 752, 0], next: [164, 900, 752, 96], hero: [196, 1056, 224, 352], compass: [644, 1072, 244, 244], tape: [232, 344, 288, 80] },
      counter: 180, spine: 64,
    },
    h: {
      cover: { head: [452, 330, 752, 128], dest: [452, 474, 752, 216], hero: [1204, 220, 412, 652], wash: [952, 100, 824, 864], tape: [1120, 200, 288, 80] },   // карточка ниже — по центру рядом с коллажем
      road: { map: [288, 156, 1280, 704], core: [480, 292, 864, 480], names: [452, 188, 960, 72], metric: [1068, 576, 680, 0], tape: [1248, 132, 288, 80], sticker: [1560, 520, 200, 200] },
      photo: { card: [620, 132, 672, 872], win: [652, 164, 608, 608], cap: [652, 804, 608, 96], date: [652, 916, 608, 56], tape: [828, 92, 288, 80] },
      arrival: { title: [452, 220, 752, 172], sticker: [948, 432, 480, 480], date: [452, 456, 432, 56], tape: [1108, 412, 288, 80] },
      elev: { metric: [452, 168, 864, 0], prof: [352, 492, 1280, 396], core: [480, 572, 1020, 260], cap: [452, 952, 1016, 72], tape: [452, 468, 288, 80] },
      fin: { receipt: [320, 192, 1280, 696], metric: [452, 268, 840, 0], next: [452, 590, 1016, 96], hero: [1352, 500, 320, 504], compass: [1148, 680, 244, 244], tape: [420, 152, 288, 80] },
      counter: 136, spine: 64,
    },
  };

  /* какой «разворот дневника» показывает кадр; соседние кадры одной семьи не перерисовывают общую страницу заново */
  const FAM = {
    'day-card': 'cover', 'trip-title': 'cover', 'season-card': 'cover',
    'route-reveal': 'road', 'camera-follow': 'road', 'weather-card': 'road', 'time-on-road': 'road', 'high-point': 'road', 'distance-counter': 'road', 'overview-to-detail': 'road',
    'progress-overview': 'jroad', 'journey-recap': 'jroad', 'day-barcode': 'barcode',
    'checkpoint-arrival': 'arrival', 'location-card': 'arrival',
    'photo-reveal': 'photo', 'highlights-reel': 'photo',
    'elevation-profile': 'elev', 'note-card': 'note',
    'day-summary': 'fin', 'pullback': 'fin', 'progress-poster': 'fin',
  };

  const imgs = new Map();
  function load(url) {
    let e = imgs.get(url);
    if (!e) { e = { ok: false, img: null }; e.p = new Promise((res) => { const im = new Image(); im.onload = () => { e.ok = true; e.img = im; res(); }; im.onerror = () => res(); im.src = url; }); imgs.set(url, e); }
    return e;
  }
  let info = null;
  const infoP = fetch(ART + 'stickers.json').then((r) => r.json()).then((j) => { info = j; }).catch(() => {});
  let flags = {};   // флаги и гербы стран (Wikimedia Commons, общественное достояние): art/flags/flags.json
  const flagsP = fetch(ART + 'flags/flags.json').then((r) => r.json()).then((j) => { flags = j; return Promise.all(Object.values(j).flatMap((f) => Object.values(f).map((x) => load(ART + x.file).p))); }).catch(() => {});
  const READY = (extra = []) => Promise.all([infoP, flagsP, load(ART + 'paper.jpg').p, load(ART + 'wash.webp').p, load(ART + 'barbos.webp').p, ...extra.map((f) => load(ART + 'pack/' + f + '.webp').p)]).then(() => (info ? Promise.all(Object.values(info.files).filter((f) => f.endsWith('.svg')).map((f) => load(ART + f).p)) : null));

  const rngOf = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  function create(E) {
    const { W, H, u, portrait, S } = E;
    const L = portrait ? LAY.v : LAY.h;
    const px = (v) => v * u;
    const box = (b) => b.map((v) => v * u);
    const HEAD = S.fHead, NUM = S.fNum, BODY = S.fBody, HAND = E.HAND;

    /* ---------- заготовленные слои (рисуем один раз, потом drawImage) ---------- */
    const cache = new Map();
    const paperPattern = (g, scale = 1) => { const e = load(ART + 'paper.jpg'); if (!e.ok) return null; const p = g.createPattern(e.img, 'repeat'); if (p.setTransform) p.setTransform(new DOMMatrix([u * scale, 0, 0, u * scale, 0, 0])); return p; };

    function pageCanvas(dark) {
      const key = 'page|' + dark; if (cache.has(key)) return cache.get(key);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
      g.fillStyle = dark ? C.desk : C.paper; g.fillRect(0, 0, W, H);
      const pat = paperPattern(g); if (pat) { g.save(); g.globalAlpha = dark ? 0.16 : 0.72; g.globalCompositeOperation = dark ? 'overlay' : 'multiply'; g.fillStyle = pat; g.fillRect(0, 0, W, H); g.restore(); }
      if (!dark) {   // кофейные круги и потёртости: бумага, которая была в дороге
        const rnd = rngOf(17 + Math.round(W)); g.save();
        for (let k = 0; k < 1; k++) { const cx = W * (0.96 + 0.06 * rnd()), cy = H * (0.9 + 0.06 * rnd()), r = (portrait ? 170 : 140) * u * (0.85 + 0.3 * rnd());   // один круг, наполовину за краем страницы
          g.lineWidth = 9 * u; g.strokeStyle = 'rgba(120,78,36,.07)'; g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.stroke(); g.lineWidth = 3 * u; g.strokeStyle = 'rgba(120,78,36,.09)'; g.beginPath(); g.arc(cx + 4 * u, cy + 3 * u, r * 0.97, 0.4, 5.6); g.stroke();
          const rg = g.createRadialGradient(cx, cy, r * 0.2, cx, cy, r); rg.addColorStop(0, 'rgba(150,100,50,.05)'); rg.addColorStop(1, 'rgba(150,100,50,0)'); g.fillStyle = rg; g.fillRect(cx - r, cy - r, 2 * r, 2 * r); }
        g.restore();
      }
      { const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, dark ? 'rgba(0,0,0,.45)' : 'rgba(70,45,15,.22)'); g.fillStyle = vg; g.fillRect(0, 0, W, H); }   // края страницы темнее — объём
      // пологие линии рельефа — как на старой карте, еле заметно
      g.save(); g.strokeStyle = dark ? 'rgba(255,244,217,.07)' : 'rgba(31,78,90,.09)'; g.lineWidth = 2 * u;
      for (let k = 0; k < 7; k++) { g.beginPath(); const y0 = H * (0.1 + k * 0.14), amp = (14 + 10 * (k % 3)) * u; for (let x = -10; x <= W + 10; x += 24 * u) { const y = y0 + Math.sin(x / (210 * u) + k * 1.7) * amp; x < 0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
      g.restore();
      // корешок: зелёная полоса с отверстиями под спираль
      const sw = px(L.spine); g.fillStyle = dark ? '#1f3b34' : C.green; g.fillRect(0, 0, sw, H);
      const gr = g.createLinearGradient(0, 0, sw, 0); gr.addColorStop(0, 'rgba(0,0,0,.28)'); gr.addColorStop(0.5, 'rgba(255,255,255,.04)'); gr.addColorStop(1, 'rgba(0,0,0,.34)'); g.fillStyle = gr; g.fillRect(0, 0, sw, H);
      g.setLineDash([14 * u, 12 * u]); g.strokeStyle = 'rgba(244,232,203,.38)'; g.lineWidth = 2 * u; g.beginPath(); g.moveTo(sw * 0.72, 0); g.lineTo(sw * 0.72, H); g.stroke(); g.setLineDash([]);
      for (let y = 96 * u; y < H; y += 192 * u) { g.beginPath(); g.arc(sw + 2 * u, y, 10 * u, 0, 6.2832); g.fillStyle = 'rgba(40,30,15,.28)'; g.fill(); g.beginPath(); g.arc(sw - 4 * u, y - 2 * u, 9 * u, 0, 6.2832); g.fillStyle = '#cfc7b0'; g.fill(); g.lineWidth = 2 * u; g.strokeStyle = 'rgba(0,0,0,.35)'; g.stroke(); }
      const sh = g.createLinearGradient(sw, 0, sw + 26 * u, 0); sh.addColorStop(0, 'rgba(40,28,10,.28)'); sh.addColorStop(1, 'rgba(40,28,10,0)'); g.fillStyle = sh; g.fillRect(sw, 0, 26 * u, H);
      cache.set(key, cv); return cv;
    }

    /* рваная карточка: неровный край, тень, фактура бумаги, по желанию — миллиметровка */
    function card(wPx, hPx, o = {}) {
      const key = ['card', Math.round(wPx), Math.round(hPx), o.seed || 1, o.fill || C.card, o.grid ? 1 : 0, o.edge == null ? 4 : o.edge].join('|'); if (cache.has(key)) return cache.get(key);
      const pad = Math.ceil(56 * u), cv = document.createElement('canvas'); cv.width = Math.ceil(wPx + 2 * pad); cv.height = Math.ceil(hPx + 2 * pad); const g = cv.getContext('2d');
      const rnd = rngOf((o.seed || 1) * 7919 + Math.round(wPx) * 31 + Math.round(hPx)), j = (o.edge == null ? 4 : o.edge) * u, step = 26 * u;
      const pts = [];
      for (let x = 0; x < wPx; x += step) pts.push([x, (rnd() - 0.5) * 2 * j]);
      for (let y = 0; y < hPx; y += step) pts.push([wPx + (rnd() - 0.5) * 2 * j, y]);
      for (let x = wPx; x > 0; x -= step) pts.push([x, hPx + (rnd() - 0.5) * 2 * j]);
      for (let y = hPx; y > 0; y -= step) pts.push([(rnd() - 0.5) * 2 * j, y]);
      const path = () => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(pad + p[0], pad + p[1]) : g.moveTo(pad + p[0], pad + p[1]))); g.closePath(); };
      g.save(); g.shadowColor = 'rgba(40,28,10,.34)'; g.shadowOffsetX = 10 * u; g.shadowOffsetY = 20 * u; g.shadowBlur = 26 * u; g.fillStyle = o.fill || C.card; path(); g.fill(); g.restore();
      g.save(); path(); g.clip();
      const pat = paperPattern(g, 0.8); if (pat) { g.globalAlpha = 0.5; g.globalCompositeOperation = 'multiply'; g.fillStyle = pat; g.fillRect(0, 0, cv.width, cv.height); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      if (o.grid) { g.strokeStyle = 'rgba(135,126,100,.28)'; g.lineWidth = 2 * u; const gs = 64 * u; g.beginPath(); for (let x = pad + gs; x < pad + wPx; x += gs) { g.moveTo(x, pad); g.lineTo(x, pad + hPx); } for (let y = pad + gs; y < pad + hPx; y += gs) { g.moveTo(pad, y); g.lineTo(pad + wPx, y); } g.stroke(); }
      const ed = g.createLinearGradient(pad, pad, pad + wPx, pad + hPx); ed.addColorStop(0, 'rgba(255,255,255,.35)'); ed.addColorStop(1, 'rgba(120,90,40,.10)'); g.fillStyle = ed; g.fillRect(pad, pad, wPx, hPx);
      g.restore();
      const out = { cv, pad }; cache.set(key, out); return out;
    }
    function drawCard(ctx, c, x, y, w, h, a = 1, rot = 0, dy = 0) {
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x + w / 2, y + h / 2 + dy); ctx.rotate((rot * Math.PI) / 180); ctx.drawImage(c.cv, -w / 2 - c.pad, -h / 2 - c.pad); ctx.restore();
    }
    function tape(ctx, b, rot, a = 1, dy = 0) {
      const [x, y, w, h] = box(b); ctx.save(); ctx.globalAlpha *= a * 0.92; ctx.translate(x + w / 2, y + h / 2 + dy); ctx.rotate((rot * Math.PI) / 180);
      ctx.shadowColor = 'rgba(40,28,10,.22)'; ctx.shadowBlur = 8 * u; ctx.shadowOffsetY = 4 * u;
      ctx.fillStyle = 'rgba(214,106,52,.82)'; ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); for (let k = 0; k <= 8; k++) ctx.lineTo(-w / 2 + (k % 2 ? 5 : 0) * u, -h / 2 + (h * k) / 8); ctx.lineTo(w / 2, h / 2); for (let k = 8; k >= 0; k--) ctx.lineTo(w / 2 - (k % 2 ? 5 : 0) * u, -h / 2 + (h * k) / 8); ctx.closePath(); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(255,236,214,.30)'; ctx.lineWidth = 2 * u; ctx.beginPath(); for (let xx = -w / 2 + 16 * u; xx < w / 2; xx += 16 * u) { ctx.moveTo(xx, -h / 2); ctx.lineTo(xx, h / 2); } ctx.stroke();
      ctx.restore();
    }
    function fitImg(ctx, im, b, a = 1, rot = 0, dy = 0, shadow = true, flip = false) {
      if (!im) return; const [x, y, w, h] = box(b), sc = Math.min(w / im.width, h / im.height), dw = im.width * sc, dh = im.height * sc;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x + w / 2, y + h / 2 + dy); ctx.rotate((rot * Math.PI) / 180); if (flip) ctx.scale(-1, 1);
      if (shadow) { ctx.shadowColor = 'rgba(40,28,10,.30)'; ctx.shadowBlur = 20 * u; ctx.shadowOffsetX = 8 * u; ctx.shadowOffsetY = 14 * u; }
      ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh); ctx.restore();
    }
    const art = (f) => { const e = load(ART + f); return e.ok ? e.img : null; };
    /* набор графики «приключение» (art/pack, 103 PNG из Obsidian → webp): подбирается по данным, не по вкусу */
    const pk = (cat, id) => art(`pack/${cat}/${id}.webp`);
    const wxId = (w) => E.wxPackId(w);   // код погоды WMO → картинка; общая функция в episode.js
    const stickerImg = (key) => (info && info.files[key] ? art(info.files[key]) : null);
    // окна рамок в долях картинки [x, y, w, h] — прозрачная область, найдена по альфа-каналу
    const FRAMES = { 'compass-map': [0.241, 0.137, 0.508, 0.643], polaroid: [0.27, 0.142, 0.489, 0.598], 'photo-frame': [0.2, 0.093, 0.583, 0.641], 'begins-here': [0.23, 0.138, 0.558, 0.604] };
    // рамка-коллаж с содержимым: inner(ctx, x, y, w, h) рисует в окне, рамка ложится сверху; cx, cy — центр, fw — ширина рамки (px)
    function framed(ctx, id, cx, cy, fw, rot, a, inner) {
      const im = pk('frame', id), n = FRAMES[id]; if (!im || !n) return null;
      const fh = (fw * im.height) / im.width, e = 0.008, wx = (n[0] - e) * fw, wy = (n[1] - e) * fh, ww = (n[2] + 2 * e) * fw, wh = (n[3] + 2 * e) * fh;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(cx, cy); ctx.rotate((rot * Math.PI) / 180); ctx.translate(-fw / 2, -fh / 2);
      ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip(); ctx.fillStyle = C.card; ctx.fillRect(wx, wy, ww, wh); inner(ctx, wx, wy, ww, wh); ctx.restore();
      ctx.shadowColor = 'rgba(30,20,8,.38)'; ctx.shadowBlur = 30 * u; ctx.shadowOffsetX = 6 * u; ctx.shadowOffsetY = 16 * u; ctx.drawImage(im, 0, 0, fw, fh);
      ctx.restore(); return { fh, top: cy - fh / 2, bottom: cy + fh / 2 };
    }

    /* ---------- текст ---------- */
    function fitFont(ctx, str, weight, size, fam, maxW) { ctx.font = `${weight} ${size}px ${fam}`; const w = ctx.measureText(str).width; if (w > maxW && maxW > 0) { size *= maxW / w; ctx.font = `${weight} ${size}px ${fam}`; } return size; }
    function text(ctx, str, x, y, o) {   // o: size(u), fam, weight, color, align, max(u), ls(em), a
      if (str == null || str === '') return 0;
      ctx.save(); ctx.globalAlpha *= o.a == null ? 1 : o.a; ctx.fillStyle = o.color || C.ink; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'alphabetic';
      const size = fitFont(ctx, str, o.weight || 400, px(o.size), o.fam || BODY, o.max ? px(o.max) : 0);
      ctx.letterSpacing = (o.ls || 0) * size + 'px'; ctx.fillText(str, x, y); ctx.restore(); return size;
    }
    const isDigit = (c) => c >= '0' && c <= '9';
    function numWidth(ctx, str, size) { let w = 0; for (const ch of str) w += isDigit(ch) ? CELL * size : ctx.measureText(ch).width; return w; }
    function drawNum(ctx, str, xRight, y, size, color, a = 1) {   // цифры — в ячейках одной ширины; число прижато вправо
      ctx.save(); ctx.globalAlpha *= a; ctx.font = `${S.numW || 700} ${size}px ${NUM}`; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
      let x = xRight - numWidth(ctx, str, size);
      for (const ch of str) { if (isDigit(ch)) { ctx.textAlign = 'center'; ctx.fillText(ch, x + (CELL * size) / 2, y); x += CELL * size; } else { ctx.textAlign = 'left'; ctx.fillText(ch, x, y); x += ctx.measureText(ch).width; } }
      ctx.restore();
    }
    const NUMUNIT = /^([+−-]?\s*[\d\s ]+(?:[.,]\d+)?)\s*(км\/ч|км|мин|м|ч)?$/;
    /* карточка с главным числом: подпись, число (+единица), пояснение. Высота — по содержанию. */
    function metricCard(ctx, b, spec, a, dy, rot, seed) {
      if (a <= 0.01 || !spec) return;
      const [x, y, w] = box(b), pad = px(32), kicker = spec.kicker ? String(spec.kicker).toUpperCase() : '', big = String(spec.big == null ? '' : spec.big), sub = spec.sub || '';
      const m = big.match(NUMUNIT), numStr = m ? m[1].replace(/\s+$/, '') : big, unit = m && m[2] ? m[2] : '';
      const wordy = !/\d/.test(big); const ctx2 = ctx; let size = px(wordy ? 100 : spec.size || L.counter); ctx2.save(); ctx2.font = `${S.numW || 700} ${size}px ${NUM}`;
      const unitSize = px(44); ctx2.font = `500 ${unitSize}px ${BODY}`; const unitW = unit ? ctx2.measureText(unit).width : 0;
      const availW = w - 2 * pad - (unit ? unitW + px(16) : 0);
      if (wordy) { ctx2.font = `${S.headW} ${size}px ${HEAD}`; const ww = ctx2.measureText(numStr).width; if (ww > availW) size *= availW / ww; }
      else { ctx2.font = `${S.numW || 700} ${size}px ${NUM}`; const nw = numWidth(ctx2, numStr, size); if (nw > availW) size *= availW / nw; }
      ctx2.restore();
      const kH = kicker ? px(32) + px(16) : 0, sH = sub ? px(44) + px(16) : 0, nH = size * 0.74;
      const h = pad * 0.9 + kH + nH + sH + pad * 0.9;
      const c = card(w, h, { seed }); drawCard(ctx, c, x, y, w, h, a, rot, dy);
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x + w / 2, y + h / 2 + dy); ctx.rotate((rot * Math.PI) / 180); ctx.translate(-w / 2, -h / 2);
      let cy = pad * 0.9;
      if (kicker) { cy += px(32) * 0.85; text(ctx, kicker, pad, cy, { size: 32, weight: 600, color: C.secondary, ls: 0.05, max: (w - 2 * pad) / u }); cy += px(16) + px(32) * 0.15; }
      const base = cy + nH; const right = w - pad - (unit ? unitW + px(16) : 0);
      if (wordy) text(ctx, numStr, pad, base, { size: size / u, fam: HEAD, weight: S.headW, color: C.green, ls: -0.02 });
      else drawNum(ctx, numStr, right, base, size, C.ink);
      if (unit) text(ctx, unit, w - pad - unitW, base, { size: 44, weight: 500, color: C.secondary, fam: BODY });
      if (sub) text(ctx, sub, pad, base + px(16) + px(44) * 0.9, { size: 44, weight: 500, color: C.secondary, max: (w - 2 * pad) / u });
      ctx.restore(); return h;
    }

    /* ---------- маршрут: эскиз настоящей геометрии в карточке-миллиметровке ---------- */
    function fitPts(sets, b) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const pts of sets) for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      const [bx, by, bw, bh] = box(b), sw = Math.max(1e-9, x1 - x0), sh = Math.max(1e-9, y1 - y0), s = Math.min(bw / sw, bh / sh), ox = bx + (bw - sw * s) / 2 - x0 * s, oy = by + (bh - sh * s) / 2 - y0 * s;
      return (p) => [p[0] * s + ox, p[1] * s + oy];
    }
    function stroke(ctx, pts, brk, F, upto, w, color, dash, a = 1) {
      if (pts.length < 2 || a <= 0.01) return; ctx.save(); ctx.globalAlpha *= a; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = w; ctx.strokeStyle = color; if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); const last = upto == null ? pts.length - 1 : upto;
      for (let i = 0; i <= last && i < pts.length; i++) { const q = F(pts[i]); (i && !(brk && brk.has(i))) ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
      return { end: () => { ctx.stroke(); ctx.restore(); } };
    }
    function headAt(pts, cum, tr) {
      const Lt = cum[cum.length - 1] * clamp(tr, 0, 1); let i = 1; while (i < cum.length - 1 && cum[i] < Lt) i++;
      const f = clamp((Lt - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]), 0, 1);
      return { i: i - 1, x: lerp(pts[i - 1][0], pts[i][0], f), y: lerp(pts[i - 1][1], pts[i][1], f) };
    }
    function heroAt(ctx, x, y, a, t, scale = 1) {   // знак героя на голове маршрута
      ctx.save(); ctx.globalAlpha *= a;
      if (E.MARK === 'unicycle' && art('barbos.webp')) { const im = art('barbos.webp'), h = 150 * u * scale, w = (im.width * h) / im.height; ctx.shadowColor = 'rgba(40,28,10,.35)'; ctx.shadowBlur = 10 * u; ctx.shadowOffsetY = 6 * u; ctx.drawImage(im, x - w / 2, y - h * 0.94, w, h); }
      else if (E.MARK) E.drawMark(ctx, E.MARK, x, y, 46 * u * scale, E.MCOL, t * 0.6);
      else { ctx.beginPath(); ctx.arc(x, y, 15 * u, 0, 6.2832); ctx.fillStyle = C.card; ctx.fill(); ctx.lineWidth = 7 * u; ctx.strokeStyle = C.accent; ctx.stroke(); }
      ctx.restore();
    }
    function sketch(ctx, coreBox, sets, tr, t, a, opts = {}) {
      const F = fitPts(sets.flatMap((s) => [s.pts]), coreBox), today = sets.find((s) => s.today) || sets[sets.length - 1];
      for (const s of sets) {
        if (s === today) continue;
        const st = stroke(ctx, s.pts, s.brk, F, null, 4 * u, C.guide, E.journey.schematic ? [14 * u, 10 * u] : null, a * 0.75); if (st) st.end();
      }
      if (tr <= 0) return;
      const hd = headAt(today.pts, today.cum, tr), q = F([hd.x, hd.y]);
      const st = stroke(ctx, today.pts, today.brk, F, hd.i, 12 * u, C.accent, E.journey.schematic ? [26 * u, 18 * u] : null, a);
      if (st) { ctx.lineTo(q[0], q[1]); ctx.shadowColor = 'rgba(163,63,40,.35)'; ctx.shadowBlur = 8 * u; st.end(); }
      const s0 = F(today.pts[0]); ctx.save(); ctx.globalAlpha *= a; ctx.beginPath(); ctx.arc(s0[0], s0[1], 16 * u, 0, 6.2832); ctx.fillStyle = C.card; ctx.fill(); ctx.lineWidth = 7 * u; ctx.strokeStyle = C.accent; ctx.stroke(); ctx.restore();
      if (opts.mark) { const m = F(opts.mark); ctx.save(); ctx.globalAlpha *= a; ctx.beginPath(); ctx.moveTo(m[0], m[1] - 34 * u); ctx.lineTo(m[0] + 26 * u, m[1] + 14 * u); ctx.lineTo(m[0] - 26 * u, m[1] + 14 * u); ctx.closePath(); ctx.fillStyle = C.ink; ctx.fill(); ctx.lineWidth = 6 * u; ctx.strokeStyle = C.card; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore(); }
      if (opts.stop) { const m = F(opts.stop), pulse = (t / 2) % 1; ctx.save(); ctx.globalAlpha *= a; ctx.beginPath(); ctx.arc(m[0], m[1], (20 + 40 * pulse) * u, 0, 6.2832); ctx.strokeStyle = C.accent; ctx.lineWidth = 4 * u; ctx.globalAlpha *= 1 - pulse; ctx.stroke(); ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(m[0], m[1], 15 * u, 0, 6.2832); ctx.fillStyle = C.card; ctx.fill(); ctx.lineWidth = 7 * u; ctx.strokeStyle = C.accent; ctx.stroke(); ctx.restore(); }
      heroAt(ctx, q[0], q[1], a, t);
    }

    /* ---------- стикеры: страна — культурный предмет как контекст; события — только по данным ---------- */
    function countryIso(name) {
      if (!name || !info) return null; const n = String(name).trim().toLowerCase();
      for (const [iso, names] of Object.entries(info.countryAliases)) if (names.some((x) => x.toLowerCase() === n)) return iso;
      return null;
    }
    const flagOf = (iso, kind) => { const f = iso && flags[iso] && flags[iso][kind]; return f ? art(f.file) : null; };
    // флаг: бумажный, с белой каймой и скотчем — приклеен к углу карточки; x, y — центр, wU — ширина в u
    function pinFlag(ctx, iso, x, y, wU, rot, a) {
      const im = flagOf(iso, 'flag'); if (!im) return; const w = px(wU), h = (w * im.height) / im.width, b = px(10);
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate((rot * Math.PI) / 180);
      ctx.shadowColor = 'rgba(30,20,8,.35)'; ctx.shadowBlur = 14 * u; ctx.shadowOffsetY = 8 * u; ctx.fillStyle = '#fbf7ee'; ctx.fillRect(-w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b);
      ctx.shadowColor = 'transparent'; ctx.drawImage(im, -w / 2, -h / 2, w, h);
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(-w / 2, -h / 2, w, h * 0.5);   // лёгкий блик бумаги
      ctx.restore(); tape(ctx, [(x - px(wU * 0.3)) / u, (y - h / 2 - px(28)) / u, wU * 0.6, 56], rot - 4, a);
    }
    // герб: печать-наклейка с тенью (только у стран, где он есть; у Турции официального герба нет)
    function stampEmblem(ctx, iso, x, y, sU, a) {
      const im = flagOf(iso, 'emblem'); if (!im) return; const sc = px(sU) / Math.max(im.width, im.height), w = im.width * sc, h = im.height * sc;
      ctx.save(); ctx.globalAlpha *= a * 0.95; ctx.shadowColor = 'rgba(30,20,8,.35)'; ctx.shadowBlur = 16 * u; ctx.shadowOffsetY = 8 * u; ctx.drawImage(im, x - w / 2, y - h / 2, w, h); ctx.restore();
    }
    function placeSticker(label, country) {
      if (/шылпык|chilpyk/i.test(label || '')) return 'uz-chilpyk';   // подтверждённое событие героя (пост 407)
      const iso = countryIso(country); return iso ? info.cultureByCountry[iso] : 'stamp-compass';
    }
    const weatherSticker = () => { const W0 = E.WX; if (!W0) return null; const id = wxId(W0); if (id && pk('wx', id)) return { pack: pk('wx', id) }; if (W0.precip >= 2) return info && info.events.rain; if (W0.wind >= 3) return info && info.events.wind; return null; };

    function wrapLines(ctx, str, weight, size, fam, maxW, maxLines) {
      ctx.save(); ctx.font = `${weight} ${size}px ${fam}`; const words = String(str).replace(/(\d)[ ]+(км|м|ч|мин|с|%|°)(?![а-яёa-z])/gi, '$1 $2').split(/ +/), lines = []; let cur = '';   // число и единица не разрываются
      for (const w of words) { const tt = cur ? cur + ' ' + w : w; if (ctx.measureText(tt).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tt; }
      lines.push(cur); ctx.restore(); return lines.length <= maxLines && lines.every((l) => { ctx.save(); ctx.font = `${weight} ${size}px ${fam}`; const ok = ctx.measureText(l).width <= maxW; ctx.restore(); return ok; }) ? lines : null;
    }
    /* ---------- сцены ---------- */
    const heroBox = (b, a, dy, rot = 0) => {
      if (E.MARK === 'unicycle' && art('barbos.webp')) fitImg(ctx0, art('barbos.webp'), b, a, rot, dy);
      else if (E.MARK && E.MARK !== 'dot') { const [x, y, w, h] = box(b), r = Math.min(w, h) * 0.42; ctx0.save(); ctx0.globalAlpha *= a; ctx0.shadowColor = 'rgba(40,28,10,.3)'; ctx0.shadowBlur = 20 * u; ctx0.shadowOffsetY = 12 * u; E.drawMark(ctx0, E.MARK, x + w / 2, y + h / 2 + dy, r, E.MCOL, 0); ctx0.restore(); }
      else fitImg(ctx0, stickerImg('stamp-compass'), b, a, rot, dy);
    };
    let ctx0 = null;   // текущий контекст для heroBox

    function cover(ctx, s, p, a, dy, lt) {
      const c = L.cover, [hx, hy, hw, hh] = box(c.head), [dx, dyy, dw, dh] = box(c.dest);
      const ct = E.coverTexts(s, p), from = ct.from, to = ct.to, hook = ct.small;
      const fcx = portrait ? W / 2 : px(1480), fcy = portrait ? px(1150) : px(560), fw = portrait ? W * 1.08 : px(900);   // в 16:9 — справа; под карточку уходит только край коллажа, не окно
      const sets = s.recipe === 'season-card' ? E.allSets() : [E.todaySet()];
      const fr = sets.length && sets[0].pts && sets[0].pts.length > 1 ? framed(ctx, 'begins-here', fcx, fcy + dy * 0.5, fw, portrait ? -1.5 : 2, a, (g, x, y, w, h) => sketch(g, [(x + w * 0.1) / u, (y + h * 0.12) / u, (w * 0.8) / u, (h * 0.76) / u], sets, 1, lt, 1)) : null;
      const wash = art('wash.webp'); if (wash && !fr) fitImg(ctx, wash, c.wash, a * 0.58, 0, dy * 0.4, false, portrait);
      // назначение: крупно в одну строку; длинное — меньше и в две строки (читаемо, не мельчит)
      let size = hook ? 100 : 180, lines = null;
      for (const sz of hook ? [100] : [180, 136, 100]) { size = sz; lines = wrapLines(ctx, to, S.headW, px(sz), HEAD, px(c.dest[2]), sz >= 136 ? 1 : 2); if (lines) break; }
      if (!lines) { lines = [to]; }
      const lh = px(size) * 1.08, first = dyy + px(size) * 0.9, last = first + (lines.length - 1) * lh;
      const pad = px(32), bx = Math.min(hx, dx) - pad, by = hy - pad, bw = Math.max(hw, dw) + 2 * pad, bh = last + px(size) * 0.3 + (E.NAME ? px(72) : 0) + pad - by;
      drawCard(ctx, card(bw, bh, { seed: 3 }), bx, by, bw, bh, a, 0, dy);
      text(ctx, from, hx, hy + hh * 0.72, { size: 100, fam: HEAD, weight: S.headW, color: C.ink, max: c.head[2], ls: -0.02, a });
      lines.forEach((ln, i) => text(ctx, ln, dx, first + i * lh, { size, fam: HEAD, weight: S.headW, color: C.green, max: c.dest[2], ls: -0.02, a }));
      if (E.NAME) text(ctx, E.NAME, dx, last + px(size) * 0.3 + px(44), { size: 56, fam: HAND, weight: 400, color: C.accent, max: c.dest[2], a: a * 0.95 });
      const ciso = countryIso(E.countryOf(s, p));
      if (ciso && flagOf(ciso, 'flag')) pinFlag(ctx, ciso, bx + bw - px(70), by + px(10) + dy, 170, 6, a);
      else tape(ctx, [bx / u + bw / u * 0.58, by / u - 36, 288, 80], -4, a, dy);
      ctx0 = ctx;
      if (!fr) heroBox(c.hero, a, dy + (1 - easeOut(lt / 0.8)) * px(30), 0);
      else if (E.MARK && E.MARK !== 'dot') heroBox(portrait ? [720, (fr.bottom / u) - 300, 280, 380] : [(fcx + fw * 0.3) / u, (fr.bottom / u) - 300, 240, 320], a, dy + (1 - easeOut(lt / 0.8)) * px(30), 4);   // знак героя — наклейкой на углу коллажа
    }

    /* ---------- рельеф: настоящие высоты, 3D-вид с маршрутом поверх (Terrain), запасной вариант — эскиз ---------- */
    const terr = { today: null, all: null }, relLoads = [];
    if (E.relief !== false && window.Terrain) {
      const fams = new Set(E.famsInPlan());
      if (fams.has('road')) relLoads.push(window.Terrain.load(E.bboxToday()).then((T) => { terr.today = T; }));
      if (fams.has('jroad')) relLoads.push(window.Terrain.load(E.bboxAll()).then((T) => { terr.all = T; }));
    }
    function reliefView(ctx, jr, sets, tr, t, a, opts, c) {
      const T = jr ? terr.all : terr.today; if (!T || !window.Terrain) return false;
      const [mx, my, mw, mh] = box(c.map), nb = box(c.names), ix = mx + px(18), iy = Math.max(my + px(18), nb[1] + nb[3] + px(14)), iw = mw - px(36), ih = my + mh - px(46) - iy;   // окно рельефа начинается под подписью маршрута
      const today = sets.find((s) => s.today) || sets[sets.length - 1], use = jr ? sets : [today];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const s of use) for (const p of s.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      const e = Math.max(x1 - x0, y1 - y0, 0.02), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const a0 = today.pts[0], a1 = today.pts[today.pts.length - 1], len = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
      const heading = len > e * 0.25 ? (Math.atan2(a1[0] - a0[0], -(a1[1] - a0[1])) * 180) / Math.PI : 0;   // линия уходит от зрителя
      const hd = tr > 0 ? headAt(today.pts, today.cum, tr) : null, follow = !jr && hd ? clamp(tr, 0, 1) : 0;
      const fovR = (38 * Math.PI) / 360, dist = (e * 1.15) / Math.tan(fovR) * (iw / ih > 1 ? 0.55 : 0.62);
      const cam = { cx: lerp(cx, hd ? hd.x : cx, 0.55 * follow), cy: lerp(cy, hd ? hd.y : cy, 0.55 * follow), dist, pitch: 60 + 8 * easeOut(t / 14), bearing: heading + 7 * Math.sin(t * 0.32), fov: 38 };
      {   // вся пройденная часть маршрута должна быть в окне: камера отъезжает, если голова ушла далеко от центра (разрывы, петли, длинные дни)
        const smp = [], upto = !jr && hd ? hd.i : Infinity;
        for (const st of use) { const step = Math.max(1, Math.floor(st.pts.length / 60)); for (let i = 0; i < st.pts.length && i <= upto; i += step) smp.push(st.pts[i]); }
        if (hd) smp.push([hd.x, hd.y]);
        for (let k = 0; k < 4; k++) {
          const Pj = window.Terrain.projector(T, cam, iw, ih); let r = 1;
          for (const q of smp) { const z = Pj(q[0], q[1]); if (!z) { r = 3; break; } r = Math.max(r, Math.abs(z[0] - iw / 2) / (iw * 0.48), Math.abs(z[1] - ih / 2) / (ih * 0.46)); }
          if (r <= 1.02) break; cam.dist *= Math.min(1.8, r);
        }
      }
      const cv = window.Terrain.render(T, cam, iw, ih); if (!cv) return false;
      ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = (T.tex && T.tex.avg) || '#b4ba94'; ctx.fillRect(ix, iy, iw, ih); ctx.drawImage(cv, ix, iy);   // фон окна — средний цвет самой текстуры: край модели не виден   // подложка окна: по углам рельефа не видно светлого пятна
      ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip(); ctx.translate(ix, iy);
      const P = window.Terrain.projector(T, cam, iw, ih); const poly = (pts, brk, upto, extra) => { ctx.beginPath(); let pen = false; const n = upto == null ? pts.length - 1 : upto; for (let i = 0; i <= n && i < pts.length; i++) { const q = P(pts[i][0], pts[i][1]); if (!q) { pen = false; continue; } (pen && !(brk && brk.has(i))) ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); pen = true; } if (extra) { const q = P(extra[0], extra[1]); if (q) ctx.lineTo(q[0], q[1]); } };
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const s of sets) if (s !== today) { poly(s.pts, s.brk, null); if (E.journey.schematic) ctx.setLineDash([14 * u, 10 * u]); ctx.strokeStyle = 'rgba(244,232,203,.85)'; ctx.lineWidth = 7 * u; ctx.stroke(); ctx.strokeStyle = 'rgba(89,80,61,.85)'; ctx.lineWidth = 3.5 * u; ctx.stroke(); ctx.setLineDash([]); }
      if (hd) {
        poly(today.pts, today.brk, hd.i, [hd.x, hd.y]); if (E.journey.schematic) ctx.setLineDash([26 * u, 18 * u]);
        ctx.strokeStyle = 'rgba(255,244,217,.92)'; ctx.lineWidth = 20 * u; ctx.stroke(); ctx.strokeStyle = C.accent; ctx.lineWidth = 12 * u; ctx.stroke(); ctx.setLineDash([]);
        const s0 = P(today.pts[0][0], today.pts[0][1]); if (s0) { ctx.beginPath(); ctx.arc(s0[0], s0[1], 16 * u, 0, 6.2832); ctx.fillStyle = C.card; ctx.fill(); ctx.lineWidth = 7 * u; ctx.strokeStyle = C.accent; ctx.stroke(); }
      }
      const mark = (pt, tri) => { const q = pt && P(pt[0], pt[1]); if (!q) return; if (tri) { ctx.beginPath(); ctx.moveTo(q[0], q[1] - 34 * u); ctx.lineTo(q[0] + 26 * u, q[1] + 14 * u); ctx.lineTo(q[0] - 26 * u, q[1] + 14 * u); ctx.closePath(); ctx.fillStyle = C.ink; ctx.fill(); ctx.lineWidth = 6 * u; ctx.strokeStyle = C.card; ctx.stroke(); } else { const pulse = (t / 2) % 1; ctx.beginPath(); ctx.arc(q[0], q[1], (20 + 40 * pulse) * u, 0, 6.2832); ctx.strokeStyle = C.accent; ctx.lineWidth = 4 * u; ctx.globalAlpha *= 1 - pulse; ctx.stroke(); ctx.globalAlpha /= Math.max(1e-3, 1 - pulse); ctx.beginPath(); ctx.arc(q[0], q[1], 15 * u, 0, 6.2832); ctx.fillStyle = C.card; ctx.fill(); ctx.lineWidth = 7 * u; ctx.strokeStyle = C.accent; ctx.stroke(); } };
      mark(opts.mark, true); mark(opts.stop, false);
      if (hd) { const q = P(hd.x, hd.y); if (q) heroAt(ctx, q[0], q[1], 1, t, 0.9); }
      ctx.restore();
      ctx.save(); ctx.globalAlpha *= a; ctx.lineWidth = px(5); ctx.strokeStyle = C.ink; ctx.strokeRect(ix, iy, iw, ih); ctx.restore();
      text(ctx, 'Рельеф: SRTM · AWS Terrain Tiles · вертикаль ×' + T.exag, mx + px(40), my + mh - px(24), { size: 24, weight: 400, color: C.secondary, a: a * 0.85, max: (mw - px(80)) / u });
      return true;
    }
    function roadScene(ctx, s, p, t, lt, dur, jr, rs) {
      const c = L.road, env = rs.env, a = env, dy = (1 - easeOut(rs.lt / 0.7)) * px(36);
      const [mx, my, mw, mh] = box(c.map);
      drawCard(ctx, card(mw, mh, { seed: 5, grid: true }), mx, my, mw, mh, a, 0, dy);
      const sets = jr ? E.allSets() : [E.todaySet()];
      const tr = jr ? easeOut(lt / (dur * 0.6)) : E.reveal(t, s);
      const ropts = { mark: s.recipe === 'high-point' && s.hp ? s.hp : null, stop: s.recipe === 'journey-recap' ? E.recapPoint(s, lt, dur) : null };
      if (!reliefView(ctx, jr, sets, tr, t, a, ropts, c)) {
        ctx.save(); ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
        sketch(ctx, c.core, sets, tr, t, a, ropts);
        ctx.restore();
      }
      text(ctx, jr ? E.journeyName() : E.routeNames(), px(c.names[0]), px(c.names[1]) + px(54), { size: 56, weight: 500, color: C.ink, max: c.names[2], a, fam: BODY });
      tape(ctx, c.tape, 3, a, dy);
      const spec = E.metric(s, p, t, lt, dur); const ma = E.vis(lt, dur); const sticker = s.recipe === 'weather-card' ? weatherSticker() : null;
      const mh2 = metricCard(ctx, c.metric, spec, ma * env, (1 - easeOut(lt / 0.6)) * px(24), -1, 11);
      const stImg = sticker && (sticker.pack || stickerImg(sticker)); if (stImg) fitImg(ctx, stImg, [c.metric[0] + c.metric[2] - 230, c.metric[1] - 210, 260, 260], ma * env, 6, 0);   // на уголке карточки, поверх текста не лежит
    }
    function arrival(ctx, s, p, a, dy, lt) {
      const c = L.arrival, [tx, ty, tw, th] = box(c.title), pad = px(32);
      const label = E.arrivalLabel(s, p), country = E.countryOf(s, p), sk = placeSticker(label, country);
      const [sx, sy, sw, sh] = box(c.sticker); const pb = [sx - px(24), sy - px(24), sw + px(48), sh + px(48)];
      const SIGNS = ['09', '10', '11', '12'], sg = sk === 'stamp-compass' ? pk('sign', SIGNS[[...String(label)].reduce((h, ch) => h + ch.charCodeAt(0), 0) % SIGNS.length]) : null;   // нет символа страны — указатель вместо пустого компаса (декор, ничего не утверждает)
      const pic = sg || stickerImg(sk), pop = (1 - easeOut(lt / 0.8)) * px(30);
      const fr = framed(ctx, 'compass-map', portrait ? W / 2 : px(1480), portrait ? sy + sh / 2 + dy : px(560) + dy, portrait ? W * 1.1 : px(900), portrait ? 1.2 : -1.5, a, (g, x, y, w, h) => {
        const wash = art('wash.webp'); if (wash) { g.save(); g.globalAlpha *= 0.45; g.drawImage(wash, x - w * 0.1, y + h * 0.2, w * 1.2, h * 0.6); g.restore(); }
        if (pic) { const sc = Math.min((w * 0.78) / pic.width, (h * 0.8) / pic.height), dw = pic.width * sc, dh = pic.height * sc; g.save(); g.globalAlpha *= easeOut(lt / 0.7); g.shadowColor = 'rgba(30,20,8,.3)'; g.shadowBlur = 18 * u; g.shadowOffsetY = 10 * u; g.drawImage(pic, x + (w - dw) / 2, y + (h - dh) / 2 + pop, dw, dh); g.restore(); }
      });
      if (!fr) {
        drawCard(ctx, card(pb[2], pb[3], { seed: 8, fill: '#f6e3b4', edge: 5 }), pb[0], pb[1], pb[2], pb[3], a, 1.5, dy);
        fitImg(ctx, pic, c.sticker, a * easeOut(lt / 0.7), sg ? 0 : -2, dy + pop);
      }
      const cw = tw + 2 * pad, ch = th + 2 * pad; drawCard(ctx, card(cw, ch, { seed: 4 }), tx - pad, ty - pad, cw, ch, a, 0, dy);
      text(ctx, label, tx, ty + th * 0.72, { size: 136, fam: HEAD, weight: S.headW, color: C.green, max: c.title[2], ls: -0.02, a });
      const iso = countryIso(country);
      if (iso) {
        const fa = a * easeOut((lt - 0.3) / 0.6);
        pinFlag(ctx, iso, tx + tw + pad - px(portrait ? 40 : 30), ty - pad + px(portrait ? 30 : 20) + dy, portrait ? 210 : 180, 7, fa);
        if (fr) stampEmblem(ctx, iso, portrait ? W - px(210) : px(1480) + px(330), fr.bottom - px(portrait ? 170 : 130) + dy, portrait ? 230 : 190, fa);
      } else tape(ctx, c.tape, -4, a, dy);
      const date = [country && sk !== 'stamp-compass' ? country : '', E.dateLine(s, p)].filter(Boolean).join(' · ');
      const dY = portrait && fr ? Math.max(box(c.date)[1], fr.bottom + px(24)) : box(c.date)[1];
      const dcard = card(box(c.date)[2] + pad, px(56) + pad, { seed: 6 }); drawCard(ctx, dcard, box(c.date)[0] - pad / 2, dY - pad / 2, box(c.date)[2] + pad, px(56) + pad, a, 0, dy);
      text(ctx, E.kindWord(s, p) + (date ? ' · ' + date : ''), box(c.date)[0], dY + px(40), { size: 44, weight: 400, color: C.secondary, max: c.date[2], a });
    }
    function photoScene(ctx, s, p, t, lt, dur) {
      const c = L.photo, ids = (p.mediaIds || []).filter((id) => E.mediaById[id]), n = ids.length; if (!n) return;
      const slot = dur / n; const k = Math.min(n - 1, Math.floor(lt / slot)), l2 = lt - k * slot, m = E.mediaById[ids[k]];
      const aIn = easeOut(l2 / 0.6), aOut = 1 - smooth((l2 - (slot - 0.5)) / 0.5), a = aIn * aOut;   // каждое фото плавно уходит, смена без резкого скачка
      const dy = (1 - easeOut(l2 / 0.7)) * px(48), rot = (k % 2 ? 1 : -1) * 2;
      const fid = k % 2 ? 'photo-frame' : 'polaroid', fimg = pk('frame', fid);
      if (fimg) {
        const fw = portrait ? W * 1.12 : px(1240), fcy = portrait ? H * 0.42 : H * 0.44, e = E.img(m.url), zoom = 1.02 + 0.05 * clamp(l2 / slot, 0, 1);
        const fr = framed(ctx, fid, W / 2 + (portrait ? 0 : -px(40)), fcy + dy, fw, rot * 0.6, a, (g, x, y, w, h) => {
          if (e.ok) { const im = e.img, sc = Math.max(w / im.width, h / im.height) * zoom; g.drawImage(im, x + (w - im.width * sc) / 2, y + (h - im.height * sc) / 2, im.width * sc, im.height * sc); }
          if (m.credit) { g.save(); g.font = `500 ${px(22)}px ${BODY}`; g.fillStyle = 'rgba(255,255,255,.92)'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 6 * u; g.fillText(m.credit, x + px(14), y + h - px(14), w - px(28)); g.restore(); }
        });
        const capY = fr.bottom + px(portrait ? 90 : 40);
        text(ctx, m.caption || E.toLabel || '', W / 2, capY + dy, { size: portrait ? 84 : 64, fam: HAND, weight: 400, color: C.ink, max: portrait ? 900 : 1200, align: 'center', a });
        text(ctx, E.photoDate(m, s), W / 2, capY + px(portrait ? 70 : 54) + dy, { size: portrait ? 42 : 34, weight: 500, color: C.secondary, max: 900, align: 'center', a });
        return;
      }
      const [cx, cy, cw, chh] = box(c.card); drawCard(ctx, card(cw, chh, { seed: 20 + k, fill: '#fffaf0', edge: 1.5 }), cx, cy, cw, chh, a, rot, dy);
      ctx.save(); ctx.translate(cx + cw / 2, cy + chh / 2 + dy); ctx.rotate((rot * Math.PI) / 180); ctx.translate(-cw / 2, -chh / 2);
      const wx = box(c.win)[0] - cx, wy = box(c.win)[1] - cy, ww = box(c.win)[2], wh = box(c.win)[3];
      ctx.globalAlpha *= a; ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
      const e = E.img(m.url); if (e.ok) { const im = e.img, sc = Math.max(ww / im.width, wh / im.height) * (1.02 + 0.05 * clamp(l2 / slot, 0, 1)); ctx.drawImage(im, wx + (ww - im.width * sc) / 2, wy + (wh - im.height * sc) / 2, im.width * sc, im.height * sc); }
      ctx.restore();
      ctx.save(); ctx.translate(cx + cw / 2, cy + chh / 2 + dy); ctx.rotate((rot * Math.PI) / 180); ctx.translate(-cw / 2, -chh / 2); ctx.globalAlpha *= a;
      const capX = box(c.cap)[0] - cx, capY = box(c.cap)[1] - cy;
      text(ctx, m.caption || E.toLabel || '', capX, capY + px(66), { size: 76, fam: HAND, weight: 400, color: C.ink, max: c.cap[2] });
      text(ctx, E.photoDate(m, s), capX, box(c.date)[1] - cy + px(40), { size: 44, weight: 400, color: C.secondary, max: c.date[2] });
      if (m.credit) text(ctx, m.credit, box(c.win)[0] - cx + px(16), box(c.win)[1] - cy + box(c.win)[3] - px(16), { size: 26, weight: 500, color: 'rgba(255,255,255,.92)', max: c.win[2] - 32 });
      ctx.restore();
      tape(ctx, c.tape, -3, a, dy);
    }
    function elevation(ctx, s, p, t, lt, dur, a, dy) {
      const c = L.elev, pr = p.profile; const [px0, py0, pw, ph] = box(c.prof);
      if (pr && pr.length >= 8) {
        drawCard(ctx, card(pw, ph, { seed: 12, grid: true }), px0, py0, pw, ph, a, 0, dy);
        const [cx, cy, cw, chh] = box(c.core), lo = Math.min(...pr), hi = Math.max(...pr), sp = Math.max(1, hi - lo);
        const X = (i) => cx + (cw * i) / (pr.length - 1), Y = (e) => cy + chh - ((e - lo) / sp) * chh;
        const g = easeOut(lt / (dur * 0.5)) * (pr.length - 1), gi = Math.floor(g), gf = g - gi;
        const ex = gi >= pr.length - 1 ? X(pr.length - 1) : lerp(X(gi), X(gi + 1), gf), ey = gi >= pr.length - 1 ? Y(pr[pr.length - 1]) : lerp(Y(pr[gi]), Y(pr[gi + 1]), gf);
        ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, dy);
        ctx.beginPath(); ctx.moveTo(cx, cy + chh); ctx.lineTo(cx, Y(pr[0])); for (let i = 1; i <= Math.min(gi, pr.length - 1); i++) ctx.lineTo(X(i), Y(pr[i])); ctx.lineTo(ex, ey); ctx.lineTo(ex, cy + chh); ctx.closePath();
        ctx.fillStyle = 'rgba(82,126,133,.30)'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx, Y(pr[0])); for (let i = 1; i <= Math.min(gi, pr.length - 1); i++) ctx.lineTo(X(i), Y(pr[i])); ctx.lineTo(ex, ey); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 12 * u; ctx.strokeStyle = C.accent; ctx.stroke();
        const mi = pr.indexOf(hi);
        if (p.maxEle != null && g >= mi) { const ma = smooth((g - mi) / 3); ctx.globalAlpha *= ma; ctx.beginPath(); ctx.arc(X(mi), Y(hi), 14 * u, 0, 6.2832); ctx.fillStyle = C.card; ctx.fill(); ctx.lineWidth = 7 * u; ctx.strokeStyle = C.accent; ctx.stroke(); }
        ctx.restore();
        tape(ctx, c.tape, -4, a, dy);
        text(ctx, `${E.fmtN(Math.round(lo))} → ${E.fmtN(Math.round(hi))} м над уровнем моря`, box(c.cap)[0], box(c.cap)[1] + px(48), { size: 44, weight: 500, color: C.secondary, max: c.cap[2], a });
      }
      metricCard(ctx, c.metric, { kicker: 'набор высоты', big: '+' + E.fmtN(p.gain) + ' м', sub: pr ? 'рельеф дня' : 'за день ' + E.today.day }, a, (1 - easeOut(lt / 0.6)) * px(24), -1, 13);
    }
    function barcode(ctx, s, p, t, lt, dur, a, dy) {
      const c = L.road, [mx, my, mw, mh] = box(c.map); drawCard(ctx, card(mw, mh, { seed: 15, grid: true }), mx, my, mw, mh, a, 0, dy);
      const days = E.days, n = days.length, bw = px(c.core[2]), bx = px(c.core[0]), by = px(c.core[1] + c.core[3]), hh = px(c.core[3]), step = bw / n, w = Math.max(3 * u, step * 0.66), mxk = E.maxKm;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, dy);
      days.forEach((d, i) => { const grow = easeOut(lt / 1.8 - (i / n) * 0.5), rest = d.km < 1, isT = d.day === E.today.day, h = rest ? 6 * u : Math.max(6 * u, (d.km / mxk) * hh * grow); ctx.fillStyle = isT ? C.accent : rest ? C.guide : 'rgba(39,78,69,.78)'; ctx.fillRect(bx + i * step + (step - w) / 2, by - h, w, h); });
      ctx.restore(); tape(ctx, c.tape, 3, a, dy);
      metricCard(ctx, c.metric, { kicker: 'день за днём', big: `${n} ${E.daysWord(n)}`, sub: 'высота столбика — километры за день' }, a * E.vis(lt, dur, 0.4), (1 - easeOut(lt / 0.6)) * px(24), -1, 17);
    }
    function noteScene(ctx, s, p, a, dy, lt) {
      const txt = '«' + (p.text || '') + '»', w = px(Math.min(880, (portrait ? 880 : 1200))), size = px(portrait ? 96 : 84); const g = ctx; g.save(); g.font = `400 ${size}px ${HAND}`;
      const words = txt.split(/\s+/), lines = []; let cur = ''; for (const wd of words) { const tt = cur ? cur + ' ' + wd : wd; if (g.measureText(tt).width > w - px(96) && cur) { lines.push(cur); cur = wd; } else cur = tt; } lines.push(cur); g.restore();
      const lh = size * 1.15, h = px(128) + lines.length * lh + px(64), x = (W - w) / 2, y = (H - h) / 2 - px(40);
      drawCard(ctx, card(w, h, { seed: 21 }), x, y, w, h, a, -1.2, dy);
      text(ctx, 'из дневника · день ' + E.today.day, x + px(48), y + px(76), { size: 32, weight: 600, color: C.secondary, ls: 0.05, a });
      lines.forEach((ln, i) => text(ctx, ln, x + px(48), y + px(128) + (i + 0.8) * lh, { size: size / u, fam: HAND, weight: 400, color: C.ink, a, max: (w - px(96)) / u }));
      tape(ctx, [x / u + 120, y / u - 30, 288, 80], -4, a, dy);
    }
    function finale(ctx, s, p, t, lt, dur, a, dy) {
      const c = L.fin, [rx, ry, rw, rh] = box(c.receipt);
      const ln = pk('land', '02'); if (ln && portrait) { const bw = W, bh = Math.min(px(520), bw * ln.height / ln.width), by = H - bh; ctx.save(); ctx.globalAlpha *= a * 0.9; ctx.drawImage(ln, 0, by, bw, bh); ctx.restore(); }   // закат над хребтами — только на высоком кадре (9:16), «путешествие продолжается"
      drawCard(ctx, card(rw, rh, { seed: 30, fill: '#f6ecd0', edge: 6 }), rx, ry, rw, rh, a, 0, dy);
      const f = E.finale(s, p, t, lt, dur);
      metricCard(ctx, c.metric, { kicker: f.kicker, big: f.big, sub: f.sub }, a, (1 - easeOut(lt / 0.6)) * px(24), 0, 31);
      const [nx, ny, nw] = box(c.next);
      ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = C.accent; ctx.lineWidth = 3 * u; ctx.setLineDash([10 * u, 10 * u]); ctx.beginPath(); ctx.moveTo(nx, ny - px(12) + dy); ctx.lineTo(nx + nw, ny - px(12) + dy); ctx.stroke(); ctx.restore();
      text(ctx, f.next, nx, ny + px(70), { size: 76, fam: HAND, weight: 400, color: C.accent, max: c.next[2], a });
      const comp = stickerImg('stamp-compass'); if (comp) fitImg(ctx, comp, c.compass, a, 8, dy);
      if (E.MARK && (E.MARK !== 'dot')) { ctx0 = ctx; heroBox(c.hero, a, dy, -3); }   // без знака героя — один компас, без дубля
      tape(ctx, c.tape, -4, a, dy);
    }

    /* ---------- кадр ---------- */
    function draw(ctx, t, s, su, lt, TR) {
      const dur = s.durationSec, fam = FAM[s.recipe] || 'road', p = s.params || {};
      const dark = fam === 'fin';
      const run = E.run(s), rlt = t - run.t0, rdur = run.t1 - run.t0;   // общая огибающая семьи: страница не «мигает», пока идут кадры одной семьи подряд
      if (dark && rlt < 0.6 && run.t0 > 0) { ctx.drawImage(pageCanvas(false), 0, 0); ctx.globalAlpha = smooth(rlt / 0.6); ctx.drawImage(pageCanvas(true), 0, 0); ctx.globalAlpha = 1; }   // тёмный финал проявляется поверх светлой страницы
      else ctx.drawImage(pageCanvas(dark), 0, 0);
      const env = clamp(Math.min(smooth(rlt / 0.5), 1 - smooth((rlt - (rdur - 0.3)) / 0.3)), 0, 1);
      const a = env, dy = (1 - easeOut(rlt / 0.7)) * px(36);
      ctx0 = ctx;
      switch (fam) {
        case 'cover': cover(ctx, s, p, a, dy, rlt); break;
        case 'road': roadScene(ctx, s, p, t, lt, dur, false, { env, lt: rlt }); break;
        case 'jroad': roadScene(ctx, s, p, t, lt, dur, true, { env, lt: rlt }); break;
        case 'arrival': arrival(ctx, s, p, a, dy, rlt); break;
        case 'photo': photoScene(ctx, s, p, t, lt, dur); break;
        case 'elev': elevation(ctx, s, p, t, rlt, rdur, a, dy); break;
        case 'barcode': barcode(ctx, s, p, t, rlt, rdur, a, dy); break;
        case 'note': noteScene(ctx, s, p, a, dy, rlt); break;
        case 'fin': finale(ctx, s, p, t, rlt, rdur, a, dy); break;
        default: roadScene(ctx, s, p, t, lt, dur, false, { env, lt: rlt });
      }
    }
    const packNeeded = () => ['land/02', 'sign/09', 'sign/10', 'sign/11', 'sign/12', 'frame/compass-map', 'frame/polaroid', 'frame/photo-frame', 'frame/begins-here'].concat(wxId(E.WX) ? ['wx/' + wxId(E.WX)] : []);
    return { draw, ready: Promise.all([READY(packNeeded()), ...relLoads]), isDark: (s) => FAM[s.recipe] === 'fin' };
  }

  window.Journal = { create, FAM };
})();
