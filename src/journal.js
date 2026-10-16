/* «Дневник»: фильм о дороге. Единые поля и типографика, реальные высоты,
   крупные фотографии и плавные переходы между главами. Все координаты в u.
   Данные и сценарий приходят из episode.js; отсутствующие факты не добавляются. */
(function () {
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const DEFAULT_C = { paper: '#162822', card: '#162822', ink: '#fff7e8', secondary: '#b9c7ba', accent: '#f48145', green: '#fff7e8', gold: '#bd552f', blue: '#718e91', desk: '#25332f', guide: '#abb4ab' };   // палитра рамок-коллажей: бумага, бирюза, жжёный оранжевый
  const ART = 'art/';
  const CELL = 0.66;   // ширина цифры в em: у всех цифр счётчика одна ячейка, число не «дрожит» (токены V2: typography.canvasNumbers)

  /* раскладки (токены V2, ед. u): [x, y, w, h] */
  const LAY = {
    v: {
      cover: { head: [164, 320, 752, 128], dest: [164, 464, 752, 216], hero: [344, 744, 440, 696], wash: [96, 660, 920, 840], tape: [232, 724, 288, 80] },
      road: { map: [0, 180, 1080, 1160], core: [120, 340, 840, 850], names: [86, 190, 908, 72], metric: [54, 1380, 972, 0], tape: [652, 238, 288, 80], sticker: [716, 1160, 220, 220] },
      photo: { card: [156, 396, 768, 1120], win: [188, 428, 704, 880], cap: [188, 1340, 704, 96], date: [188, 1452, 704, 56], tape: [392, 356, 288, 80] },
      arrival: { title: [164, 320, 752, 172], sticker: [196, 556, 688, 688], date: [164, 1308, 752, 56], tape: [600, 536, 288, 80] },
      elev: { metric: [164, 336, 752, 0], prof: [96, 660, 888, 752], core: [192, 756, 696, 560], cap: [164, 1444, 752, 72], tape: [196, 636, 288, 80] },
      fin: { receipt: [128, 384, 824, 1056], metric: [164, 560, 752, 0], next: [164, 900, 752, 96], hero: [196, 1056, 224, 352], compass: [644, 1072, 244, 244], tape: [232, 344, 288, 80] },
      counter: 180, spine: 64,
    },
    h: {
      cover: { head: [190, 330, 760, 128], dest: [190, 474, 760, 216], hero: [1204, 220, 412, 652], wash: [952, 100, 824, 864], tape: [1120, 200, 288, 80] },   // карточка ниже — по центру рядом с коллажем
      road: { map: [0, 172, 1360, 860], core: [120, 300, 1120, 640], names: [86, 198, 1180, 72], metric: [1390, 350, 470, 0], tape: [890, 126, 288, 80], sticker: [1560, 520, 200, 200] },
      photo: { card: [620, 132, 672, 872], win: [652, 164, 608, 608], cap: [652, 804, 608, 96], date: [652, 916, 608, 56], tape: [828, 92, 288, 80] },
      arrival: { title: [452, 220, 752, 172], sticker: [948, 432, 480, 480], date: [452, 456, 432, 56], tape: [1108, 412, 288, 80] },
      elev: { metric: [200, 140, 700, 0], prof: [140, 360, 1640, 600], core: [260, 460, 1400, 400], cap: [260, 900, 1400, 60], tape: [1300, 336, 288, 80] },
      fin: { receipt: [320, 192, 1280, 696], metric: [452, 268, 840, 0], next: [452, 590, 1016, 96], hero: [1352, 500, 320, 504], compass: [1148, 680, 244, 244], tape: [420, 152, 288, 80] },
      counter: 136, spine: 64,
    },
  };

  /* какой «разворот дневника» показывает кадр; соседние кадры одной семьи не перерисовывают общую страницу заново */
  const FAM = {
    'day-card': 'cover', 'trip-title': 'cover', 'season-card': 'cover',
    'route-reveal': 'road', 'camera-follow': 'road', 'weather-card': 'road', 'time-on-road': 'road', 'high-point': 'road', 'distance-counter': 'road', 'overview-to-detail': 'road',
    'progress-overview': 'jroad', 'journey-recap': 'jroad', 'day-barcode': 'barcode',
    'checkpoint-arrival': 'photo', 'location-card': 'photo',
    'photo-reveal': 'photo', 'highlights-reel': 'photo',
    'elevation-profile': 'road', 'note-card': 'note',
    'day-summary': 'fin', 'pullback': 'fin', 'progress-poster': 'fin',
  };

  const imgs = new Map();
  function load(url) {
    let e = imgs.get(url);
    if (!e) { e = { ok: false, img: null }; e.p = new Promise((res) => { const im = new Image(); im.onload = () => { e.ok = true; e.img = im; res(); }; im.onerror = () => res(); im.src = url; }); imgs.set(url, e); }
    return e;
  }
  let info = null;
  const infoP = window.StyleIcons.legacyEnabled ? fetch(ART + 'stickers.json').then((r) => r.json()).then((j) => { info = j; }).catch(() => {}) : Promise.resolve();
  const READY = (extraFn) => !window.StyleIcons.legacyEnabled ? Promise.all([window.Flags.ready(), load(ART + 'barbos.webp').p]) : Promise.all([infoP, window.Flags.ready()]).then(() => Promise.all([load(ART + 'paper.jpg').p, load(ART + 'wash.webp').p, load(ART + 'barbos.webp').p, ...extraFn().map((f) => load(ART + 'pack/' + f + '.webp').p)])).then(() => (info ? Promise.all(Object.values(info.files).filter((f) => f.endsWith('.svg')).map((f) => load(ART + f).p)) : null));

  const rngOf = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  function create(E) {
    const { W, H, u, portrait, S } = E, AP = window.Appearance.normalize(E.appearance);
    const C = { ...DEFAULT_C, paper: AP.bg, card: AP.bg, ink: AP.text, secondary: AP.muted, accent: AP.accent, green: AP.text, guide: AP.muted, route: AP.route };
    const L = portrait ? LAY.v : LAY.h;
    const px = (v) => v * u;
    const box = (b) => b.map((v) => v * u);
    /* характер стиля: шрифт цифр, вид линии маршрута, форма фото-меток, детали обложки; раскладка и камера у всех общие */
    const CHARS = {
      paper: { num: '"Yeseva One", "RS Geologica Num", serif', numW: 400, route: 'ink', halo: 'rgba(255,246,220,.9)', pins: 'polaroid', grain: true },
      night: { num: '"RS DINish", "RS Geologica Num", sans-serif', numW: 700, route: 'glow', halo: null, pins: 'circle', glass: true },
      magazine: { num: '"RS Geologica Num", "RS Geologica", sans-serif', numW: 800, route: 'square', halo: 'rgba(241,238,230,.95)', pins: 'square', circle: true },
      trail: { num: '"Prata", "RS Geologica Num", serif', numW: 400, route: 'dash', halo: 'rgba(20,34,25,.75)', pins: 'arch', stamp: true },
    };
    const CH = CHARS[S.char] || CHARS.paper;
    const HEAD = S.fHead, NUM = CH.num, NUMW = CH.numW, BODY = S.fBody, HAND = S.fBody, HW = S.headW;

    /* ---------- заготовленные слои (рисуем один раз, потом drawImage) ---------- */
    const cache = new Map();
    const paperPattern = (g, scale = 1) => { const e = load(ART + 'paper.jpg'); if (!e.ok) return null; const p = g.createPattern(e.img, 'repeat'); if (p.setTransform) p.setTransform(new DOMMatrix([u * scale, 0, 0, u * scale, 0, 0])); return p; };

    function pageCanvas(dark) {
      const key = 'page|' + dark; if (cache.has(key)) return cache.get(key);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d'); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
      cache.set(key, cv); return cv;
    }

    /* рваная карточка: неровный край, тень, фактура бумаги, по желанию — миллиметровка */
    function card(wPx, hPx, o = {}) {
      const key = ['card', Math.round(wPx), Math.round(hPx)].join('|'); if (cache.has(key)) return cache.get(key);
      const cv = document.createElement('canvas'); cv.width = Math.ceil(wPx); cv.height = Math.ceil(hPx);
      const g = cv.getContext('2d'); g.fillStyle = C.paper; g.fillRect(0, 0, wPx, hPx);
      const out = { cv, pad: 0 }; cache.set(key, out); return out;
    }
    let flat = false;   // экран дороги — карта во весь кадр, текст поверх затемнения, без карточек и рамок
    let factInk = null;   // временная перекраска только фактов на полосе «Журнала», палитра C не меняется
    function drawCard(ctx, c, x, y, w, h, a = 1, rot = 0, dy = 0) {
      if (flat) return;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x + w / 2, y + h / 2 + dy); ctx.rotate(0); ctx.drawImage(c.cv, -w / 2 - c.pad, -h / 2 - c.pad); ctx.restore();
    }
    function tape(ctx, b, rot, a = 1, dy = 0) {
      // Декоративный скотч заменён свободным полем; вызовы сохраняют совместимость сцен.
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
    function framed(ctx, id, cx, cy, fw, rot, a, inner, over) {
      const im = pk('frame', id), n = FRAMES[id]; if (!im || !n) return null;
      const fh = (fw * im.height) / im.width, e = 0.008, wx = (n[0] - e) * fw, wy = (n[1] - e) * fh, ww = (n[2] + 2 * e) * fw, wh = (n[3] + 2 * e) * fh;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(cx, cy); ctx.rotate((rot * Math.PI) / 180); ctx.translate(-fw / 2, -fh / 2);
      ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip(); ctx.fillStyle = C.card; ctx.fillRect(wx, wy, ww, wh); inner(ctx, wx, wy, ww, wh); ctx.restore();
      ctx.shadowColor = 'rgba(30,20,8,.38)'; ctx.shadowBlur = 30 * u; ctx.shadowOffsetX = 6 * u; ctx.shadowOffsetY = 16 * u; ctx.drawImage(im, 0, 0, fw, fh);
      ctx.shadowColor = 'transparent'; if (over) over(ctx, fw, fh);
      ctx.restore(); return { fh, top: cy - fh / 2, bottom: cy + fh / 2 };
    }

    /* ---------- текст ---------- */
    function fitFont(ctx, str, weight, size, fam, maxW) { ctx.font = `${weight} ${size}px ${fam}`; const w = ctx.measureText(str).width; if (w > maxW && maxW > 0) { size *= maxW / w; ctx.font = `${weight} ${size}px ${fam}`; } return size; }
    /* свои надписи путешественника: замена стандартного текста по началу строки («набор высоты» → «подъём»); крупные тексты (названия, подписи к фото) не трогаем */
    const LBL = Object.entries(E.labels || {}).filter(([k, v]) => k && typeof v === 'string' && v.trim()).map(([k, v]) => [k.toLowerCase(), v.trim()]).sort((a, b) => b[0].length - a[0].length);
    const relabel = (str) => {
      if (!LBL.length || typeof str !== 'string') return str; const low = str.toLowerCase();
      for (const [k, v] of LBL) if (low.startsWith(k) && (low.length === k.length || !/[a-zа-яё0-9]/i.test(low[k.length]))) { const head = str.slice(0, k.length), up = head === head.toUpperCase() && /[A-ZА-ЯЁ]/.test(head); return (up ? v.toUpperCase() : v) + str.slice(k.length); }
      return str;
    };
    /* свой логотип: в шапке вместо имени и/или в углу обложки и финала */
    const LOGO = E.logo && E.logo.url ? E.img(E.logo.url) : null;
    function drawLogo(ctx, x, y, maxW, maxH, align, a) {
      if (!LOGO || !LOGO.ok) return false; const im = LOGO.img, sc = Math.min(maxW / im.width, maxH / im.height), w = im.width * sc, h = im.height * sc;
      ctx.save(); ctx.globalAlpha *= a == null ? 1 : a; ctx.drawImage(im, align === 'right' ? x - w : x, y, w, h); ctx.restore(); return true;
    }
    const logoEnds = (ctx, a, minY = 0) => {
      if (!LOGO || !LOGO.ok || E.logo.where === 'header') return;
      const y = Math.max(H - px(portrait ? 330 : 250), minY), h = Math.min(px(portrait ? 160 : 150), H - px(60) - y);
      if (h > 0) drawLogo(ctx, W - px(86), y, px(portrait ? 380 : 420), h, 'right', a);
    };
    function text(ctx, str, x, y, o) {   // o: size(u), fam, weight, color, align, max(u), ls(em), a
      if (str == null || str === '') return 0; if (o.size <= 58) str = relabel(str);
      ctx.save(); ctx.globalAlpha *= o.a == null ? 1 : o.a; ctx.fillStyle = o.color || C.ink; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'alphabetic';
      const size = fitFont(ctx, str, o.weight || 400, px(o.size), o.fam || BODY, o.max ? px(o.max) : 0);
      ctx.letterSpacing = (o.ls || 0) * size + 'px'; ctx.fillText(str, x, y); ctx.restore(); return size;
    }
    const isDigit = (c) => c >= '0' && c <= '9';
    function numWidth(ctx, str, size) { let w = 0; for (const ch of str) w += isDigit(ch) ? CELL * size : ctx.measureText(ch).width; return w; }
    function drawNum(ctx, str, xRight, y, size, color, a = 1) {   // цифры — в ячейках одной ширины; число прижато вправо
      ctx.save(); ctx.globalAlpha *= a; ctx.font = `${NUMW} ${size}px ${NUM}`; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
      let x = xRight - numWidth(ctx, str, size);
      for (const ch of str) { if (isDigit(ch)) { ctx.textAlign = 'center'; ctx.fillText(ch, x + (CELL * size) / 2, y); x += CELL * size; } else { ctx.textAlign = 'left'; ctx.fillText(ch, x, y); x += ctx.measureText(ch).width; } }
      ctx.restore();
    }
    const NUMUNIT = /^([+−-]?\s*[\d\s ]+(?:[.,]\d+)?)\s*(км\/ч|км|мин|м|ч)?$/;
    /* карточка с главным числом: подпись, число (+единица), пояснение. Высота — по содержанию. */
    function metricCard(ctx, b, spec, a, dy, rot, seed) {
      if (a <= 0.01 || !spec) return; rot = 0;
      const [x, y, w] = box(b), pad = px(32), kicker = spec.kicker ? String(spec.kicker).toUpperCase() : '', big = String(spec.big == null ? '' : spec.big), sub = spec.sub || '';
      const m = big.match(NUMUNIT), numStr = m ? m[1].replace(/\s+$/, '') : big, unit = m && m[2] ? m[2] : '';
      const wordy = !/\d/.test(big); const ctx2 = ctx; let size = px(wordy ? 100 : spec.size || L.counter); ctx2.save(); ctx2.font = `${NUMW} ${size}px ${NUM}`;
      const unitSize = px(44); ctx2.font = `500 ${unitSize}px ${BODY}`; const unitW = unit ? ctx2.measureText(unit).width : 0;
      const availW = w - 2 * pad - (unit ? unitW + px(16) : 0);
      if (wordy) { ctx2.font = `${S.headW} ${size}px ${HEAD}`; const ww = ctx2.measureText(numStr).width; if (ww > availW) size *= availW / ww; }
      else { ctx2.font = `${NUMW} ${size}px ${NUM}`; const nw = numWidth(ctx2, numStr, size); if (nw > availW) size *= availW / nw; }
      ctx2.restore();
      const kH = kicker ? px(38) + px(16) : 0, sH = sub ? px(44) + px(16) : 0, nH = size * 0.74;
      const h = pad * 0.9 + kH + nH + sH + pad * 0.9;
      const c = card(w, h, { seed }); drawCard(ctx, c, x, y, w, h, a, rot, dy);
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x + w / 2, y + h / 2 + dy); ctx.rotate((rot * Math.PI) / 180); ctx.translate(-w / 2, -h / 2);
      let cy = pad * 0.9;
      if (kicker) { cy += px(38) * 0.85; text(ctx, kicker, pad, cy, { size: 38, weight: 600, color: factInk || C.secondary, ls: 0.05, max: (w - 2 * pad) / u }); cy += px(16) + px(32) * 0.15; }
      const base = cy + nH; const right = w - pad - (unit ? unitW + px(16) : 0);
      if (wordy) text(ctx, numStr, pad, base, { size: size / u, fam: HEAD, weight: S.headW, color: factInk || C.green, ls: -0.02 });
      else drawNum(ctx, numStr, right, base, size, factInk || C.ink);
      if (unit) text(ctx, unit, w - pad - unitW, base, { size: 44, weight: 500, color: factInk || C.secondary, fam: BODY });
      if (sub) text(ctx, sub, pad, base + px(16) + px(44) * 0.9, { size: 44, weight: 500, color: factInk || C.secondary, max: (w - 2 * pad) / u });
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
      if (CH.glass) {   // мягкий свет под значком, его форма остаётся прежней
        const r = px(80) * scale, g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, window.Appearance.rgba(AP.route, .34)); g.addColorStop(.4, window.Appearance.rgba(AP.route, .18)); g.addColorStop(1, window.Appearance.rgba(AP.route, 0));
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      if (E.MARK === 'unicycle' && art('barbos.webp')) { const im = art('barbos.webp'), h = 150 * u * scale, w = (im.width * h) / im.height; ctx.shadowColor = 'rgba(40,28,10,.35)'; ctx.shadowBlur = 10 * u; ctx.shadowOffsetY = 6 * u; ctx.drawImage(im, x - w / 2, y - h * 0.94, w, h); }
      else if (E.MARK) E.drawMark(ctx, E.MARK, x, y, 46 * u * scale, E.MCOL, t * 0.6);
      else { ctx.beginPath(); ctx.arc(x, y, 15 * u, 0, 6.2832); ctx.fillStyle = C.card; ctx.fill(); ctx.lineWidth = 7 * u; ctx.strokeStyle = C.accent; ctx.stroke(); }
      ctx.restore();
    }
    let T0 = 0;   // время кадра для покачивания меток
    function trackDeco(ctx, proj, tr, a, box) {
      if (!E.notes.length && !E.pins.length) return; const [bx, by, bw, bh] = box;
      E.pins.forEach((q, i) => {   // фото рядом с местом на маршруте: у каждой свой разброс, наклон и лёгкое покачивание; не у края кадра
        if (!q.e.ok) return; const pa = a * smooth((tr - q.f) / 0.03), pt = proj(E.ptAtF(q.f)); if (!pt || pa <= 0.01) return;
        const im = q.e.img, s0 = px(portrait ? 128 : 108), fr = px(9), h1 = Math.sin(i * 12.9898 + 4.1) * 43758.5453, rnd = h1 - Math.floor(h1), side = i % 2 ? 1 : -1;
        const ang = (side > 0 ? 0 : Math.PI) + (rnd - 0.5) * 1.5, dist = px(portrait ? 190 : 170) + rnd * px(90), tt = (T0 || 0);
        let x = pt[0] + Math.cos(ang) * dist + Math.sin(tt * 0.9 + i * 1.7) * px(4), y = pt[1] + Math.sin(ang) * dist * 0.8 + Math.sin(tt * 1.3 + i) * px(5);
        const m = s0 / 2 + fr + px(30); x = Math.max(bx + m, Math.min(bx + bw - m, x)); y = Math.max(by + m, Math.min(by + bh - m, y));
        const rot = (rnd - 0.5) * 0.2 + Math.sin(tt * 0.8 + i * 2.3) * 0.018, sc0 = 0.75 + 0.25 * pa;
        ctx.save(); ctx.globalAlpha *= pa; ctx.strokeStyle = C.accent; ctx.lineWidth = px(CH.pins === 'arch' ? 2 : 3); ctx.setLineDash(CH.pins === 'arch' ? [px(6), px(8)] : [px(8), px(7)]); ctx.beginPath(); ctx.moveTo(pt[0], pt[1]); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.globalAlpha *= pa; ctx.translate(x, y); ctx.rotate(CH.pins === 'circle' ? 0 : rot); ctx.scale(sc0, sc0);
        const sc = Math.max(s0 / im.width, s0 / im.height), fill = () => ctx.drawImage(im, -(im.width * sc) / 2, -(im.height * sc) / 2, im.width * sc, im.height * sc);
        if (CH.pins === 'circle') {   // «Ночь»: круглая метка со свечением
          ctx.shadowColor = AP.accent; ctx.shadowBlur = 24 * u; ctx.beginPath(); ctx.arc(0, 0, s0 / 2 + fr * 0.6, 0, 6.2832); ctx.fillStyle = AP.accent; ctx.fill(); ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
          ctx.beginPath(); ctx.arc(0, 0, s0 / 2 - fr * 0.3, 0, 6.2832); ctx.clip(); fill();
        } else if (CH.pins === 'square') {   // «Журнал»: квадрат с жёсткой тенью без размытия
          ctx.fillStyle = AP.text; ctx.fillRect(-s0 / 2 - fr + px(9), -s0 / 2 - fr + px(9), s0 + 2 * fr, s0 + 2 * fr); ctx.fillStyle = AP.bg; ctx.fillRect(-s0 / 2 - fr, -s0 / 2 - fr, s0 + 2 * fr, s0 + 2 * fr);
          ctx.beginPath(); ctx.rect(-s0 / 2, -s0 / 2, s0, s0); ctx.clip(); fill();
        } else if (CH.pins === 'arch') {   // «Тропа»: арка
          const r = s0 / 2, top = -s0 * 0.62, bot = s0 * 0.62, path = (d) => { ctx.beginPath(); ctx.moveTo(-r - d, bot + d); ctx.lineTo(-r - d, top + r); ctx.arc(0, top + r, r + d, Math.PI, 0); ctx.lineTo(r + d, bot + d); ctx.closePath(); };
          ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 12 * u; path(fr); ctx.fillStyle = AP.text; ctx.fill(); ctx.shadowColor = 'transparent'; path(0); ctx.clip(); fill();
        } else {   // «Бумага»: полароид с липкой лентой
          ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14 * u; ctx.shadowOffsetY = 5 * u; ctx.fillStyle = '#fffaf0';
          // Маленькие неровности только по белому краю; рисунок постоянный, при движении не дрожит.
          const edge = [[-s0 / 2 - fr, -s0 / 2 - fr], [s0 / 2 + fr, -s0 / 2 - fr], [s0 / 2 + fr, s0 / 2 + 2 * fr], [-s0 / 2 - fr, s0 / 2 + 2 * fr]], rand = rngOf(730 + i);
          ctx.beginPath(); ctx.moveTo(...edge[0]);
          for (let j = 0; j < 4; j++) {
            const v = edge[j], z = edge[(j + 1) % 4], dx = z[0] - v[0], dy = z[1] - v[1], len = Math.hypot(dx, dy), n = Math.ceil(len / px(10));
            for (let k = 1; k <= n; k++) { const d = k === n ? 0 : (rand() - .5) * px(4); ctx.lineTo(v[0] + dx * k / n - dy / len * d, v[1] + dy * k / n + dx / len * d); }
          }
          ctx.closePath(); ctx.fill(); ctx.shadowColor = 'transparent';
          ctx.save(); ctx.beginPath(); ctx.rect(-s0 / 2, -s0 / 2, s0, s0); ctx.clip(); fill(); ctx.restore();
          ctx.fillStyle = 'rgba(224,168,124,.85)'; ctx.save(); ctx.rotate(0.1); ctx.fillRect(-px(34), -s0 / 2 - fr - px(16), px(68), px(26)); ctx.restore();
        }
        ctx.restore();
        ctx.save(); ctx.globalAlpha *= pa; ctx.beginPath(); ctx.arc(pt[0], pt[1], px(9), 0, 6.2832); ctx.fillStyle = C.card; ctx.fill(); ctx.lineWidth = px(5); ctx.strokeStyle = C.accent; ctx.stroke(); ctx.restore();
      });
      E.notes.forEach((n, i) => {
        const na = a * E.noteAlpha(i, tr), pt = proj(E.ptAtF(n.f)); if (!pt || na <= 0.01) return;
        const size = px(portrait ? 58 : 48); ctx.save(); ctx.font = `400 ${size}px ${HAND}`; const tw = Math.min(ctx.measureText(n.text).width, bw - px(80)); ctx.restore();
        const cw = tw + px(56), ch = size * 1.6, right = pt[0] < bx + bw / 2;
        const cx0 = Math.max(bx + px(10), Math.min(bx + bw - cw - px(10), right ? pt[0] + px(30) : pt[0] - px(30) - cw)), cy0 = Math.max(by + px(10), pt[1] - px(130) - ch);
        ctx.save(); ctx.globalAlpha *= na; ctx.setLineDash([px(9), px(8)]); ctx.strokeStyle = C.accent; ctx.lineWidth = px(4); ctx.beginPath(); ctx.moveTo(pt[0], pt[1]); ctx.lineTo(right ? cx0 + px(30) : cx0 + cw - px(30), cy0 + ch); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(pt[0], pt[1], px(11), 0, 6.2832); ctx.fillStyle = C.accent; ctx.fill(); ctx.lineWidth = px(5); ctx.strokeStyle = C.card; ctx.stroke(); ctx.restore();
        drawCard(ctx, card(cw, ch, { seed: 40 + i, edge: 3 }), cx0, cy0, cw, ch, na, right ? -1.5 : 1.5, 0);
        text(ctx, n.text, cx0 + px(28), cy0 + ch * 0.66, { size: size / u, fam: HAND, weight: 400, color: C.ink, max: tw / u, a: na });
        tape(ctx, [(cx0 + cw * 0.5 - px(50)) / u, (cy0 - px(18)) / u, 100, 40], right ? -6 : 6, na);
      });
    }
    function sketch(ctx, coreBox, sets, tr, t, a, opts = {}) {
      const fitBox = opts.deco && E.pins.length ? [coreBox[0] + coreBox[2] * 0.22, coreBox[1], coreBox[2] * 0.56, coreBox[3]] : coreBox;
      const F = fitPts(sets.flatMap((s) => [s.pts]), fitBox), today = sets.find((s) => s.today) || sets[sets.length - 1];
      for (const s of sets) {
        if (s === today) continue;
        const st = stroke(ctx, s.pts, s.brk, F, null, 4 * u, C.guide, E.journey.schematic ? [14 * u, 10 * u] : null, a * 0.75); if (st) st.end();
      }
      if (tr <= 0) return;
      const hd = headAt(today.pts, today.cum, tr), q = F([hd.x, hd.y]);
      const st = stroke(ctx, today.pts, today.brk, F, hd.i, 12 * u, C.route, E.journey.schematic ? [26 * u, 18 * u] : null, a);
      if (st) { ctx.lineTo(q[0], q[1]); ctx.shadowColor = 'rgba(163,63,40,.35)'; ctx.shadowBlur = 8 * u; st.end(); }
      const s0 = F(today.pts[0]); ctx.save(); ctx.globalAlpha *= a; ctx.beginPath(); ctx.arc(s0[0], s0[1], 16 * u, 0, 6.2832); ctx.fillStyle = C.card; ctx.fill(); ctx.lineWidth = 7 * u; ctx.strokeStyle = C.accent; ctx.stroke(); ctx.restore();
      if (opts.mark) { const m = F(opts.mark); ctx.save(); ctx.globalAlpha *= a; ctx.beginPath(); ctx.moveTo(m[0], m[1] - 34 * u); ctx.lineTo(m[0] + 26 * u, m[1] + 14 * u); ctx.lineTo(m[0] - 26 * u, m[1] + 14 * u); ctx.closePath(); ctx.fillStyle = C.ink; ctx.fill(); ctx.lineWidth = 6 * u; ctx.strokeStyle = C.card; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore(); }
      if (opts.stop) { const m = F(opts.stop), pulse = (t / 2) % 1; ctx.save(); ctx.globalAlpha *= a; ctx.beginPath(); ctx.arc(m[0], m[1], (20 + 40 * pulse) * u, 0, 6.2832); ctx.strokeStyle = C.accent; ctx.lineWidth = 4 * u; ctx.globalAlpha *= 1 - pulse; ctx.stroke(); ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(m[0], m[1], 15 * u, 0, 6.2832); ctx.fillStyle = C.card; ctx.fill(); ctx.lineWidth = 7 * u; ctx.strokeStyle = C.accent; ctx.stroke(); ctx.restore(); }
      heroAt(ctx, q[0], q[1], a, t);
      if (opts.deco) trackDeco(ctx, (pp) => F(pp), tr, a, box(coreBox));
    }

    /* ---------- стикеры: страна — культурный предмет как контекст; события — только по данным ---------- */
    const countryIso = (name) => window.Flags.iso(name);   // общий модуль src/flags.js
    const flagOf = (iso, kind) => (E.showFlags ? window.Flags.img(iso, kind) : null);
    // флаг: бумажный, с белой каймой и скотчем — приклеен к углу карточки; x, y — центр, wU — ширина в u
    function pinFlag(ctx, iso, x, y, wU, rot, a) {
      const im = flagOf(iso, 'flag'); if (!im) return;
      const w = px(Math.min(wU, 72)), h = w * im.height / im.width;
      ctx.save(); ctx.globalAlpha *= a; ctx.drawImage(im, x - w / 2, y - h / 2, w, h); ctx.restore();
    }
    // герб: печать-наклейка с тенью (только у стран, где он есть; у Турции официального герба нет)
    function stampEmblem(ctx, iso, x, y, sU, a) {
      const im = flagOf(iso, 'emblem'); if (!im) return; const sc = px(sU) / Math.max(im.width, im.height), w = im.width * sc, h = im.height * sc;
      ctx.save(); ctx.globalAlpha *= a * 0.95; ctx.shadowColor = 'rgba(30,20,8,.35)'; ctx.shadowBlur = 16 * u; ctx.shadowOffsetY = 8 * u; ctx.drawImage(im, x - w / 2, y - h / 2, w, h); ctx.restore();
    }
    // Лёгкая строка метаданных: без плашки и рамки, ниже названия места.
    function countryBand(ctx, country, a, onPhoto = false, topU = 162) {
      const iso = countryIso(country), flag = flagOf(iso, 'flag'); if (!flag) return;
      const emblem = flagOf(iso, 'emblem'), x = px(86), y = px(topU), h = px(48), ink = onPhoto ? AP.photoText : AP.text;
      ctx.save(); ctx.font = `600 ${px(34)}px ${BODY}`;
      const labelW = Math.min(ctx.measureText(country).width, W - px(emblem ? 330 : 260));
      ctx.globalAlpha *= a;
      const fw = Math.min(px(58), px(40) * flag.width / flag.height), fh = fw * flag.height / flag.width;
      ctx.drawImage(flag,x,y+(h-fh)/2,fw,fh);
      text(ctx,country,x+px(76),y+px(35),{ size:34,weight:600,color:ink,max:labelW/u });
      if (emblem) {
        const ex = x+px(76)+labelW+px(44), ey = y+h/2;
        const scale = px(44)/Math.max(emblem.width,emblem.height), ew = emblem.width*scale, eh = emblem.height*scale;
        ctx.drawImage(emblem,ex-ew/2,ey-eh/2,ew,eh);
      }
      ctx.restore();
    }
    function placeSticker(label, country) {
      if (/шылпык|chilpyk/i.test(label || '')) return 'uz-chilpyk';   // подтверждённое событие героя (пост 407)
      const iso = countryIso(country); return (iso && info.cultureByCountry[iso]) || 'stamp-compass';   // страна без своего стикера (флаг есть у 249 стран, стикеры — у 9)
    }
    const weatherSticker = () => { const icon = E.weatherIcon(); return icon ? { pack:icon } : null; };

    function wrapLines(ctx, str, weight, size, fam, maxW, maxLines) {
      ctx.save(); ctx.font = `${weight} ${size}px ${fam}`; const words = String(str).replace(/(\d)[ ]+(км|м|ч|мин|с|%|°)(?![а-яёa-z])/gi, '$1 $2').replace(/(^|\s)(на|в|к|с|и|по|у|до|от|за|о) /gi, '$1$2 ').split(/ +/), lines = []; let cur = '';   // единицы и короткие предлоги не остаются на отдельной строке
      for (const w of words) { const tt = cur ? cur + ' ' + w : w; if (ctx.measureText(tt).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tt; }
      lines.push(cur); ctx.restore(); return lines.length <= maxLines && lines.every((l) => { ctx.save(); ctx.font = `${weight} ${size}px ${fam}`; const ok = ctx.measureText(l).width <= maxW; ctx.restore(); return ok; }) ? lines : null;
    }
    /* ---------- сцены ---------- */
    const heroBox = (b, a, dy, rot = 0) => {
      const uImg = E.uni() || art('barbos.webp');   // реалистичный рендер уницикла (art/unicycle-real.webp)
      if (E.MARK === 'unicycle' && uImg) fitImg(ctx0, uImg, b, a, rot, dy);
      else if (E.MARK && E.MARK !== 'dot') { const [x, y, w, h] = box(b), r = Math.min(w, h) * 0.42; ctx0.save(); ctx0.globalAlpha *= a; ctx0.shadowColor = 'rgba(40,28,10,.3)'; ctx0.shadowBlur = 20 * u; ctx0.shadowOffsetY = 12 * u; E.drawMark(ctx0, E.MARK, x + w / 2, y + h / 2 + dy, r, E.MCOL, 0); ctx0.restore(); }
      else fitImg(ctx0, stickerImg('stamp-compass'), b, a, rot, dy);
    };
    let ctx0 = null;   // текущий контекст для heroBox

    function imageShade(ctx, a = 1) {
      ctx.save(); ctx.globalAlpha *= a;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, window.Appearance.rgba(AP.shade,.84)); g.addColorStop(.3, window.Appearance.rgba(AP.shade,.12));
      g.addColorStop(.55, window.Appearance.rgba(AP.shade,.06)); g.addColorStop(1, window.Appearance.rgba(AP.shade,.94));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    function dateStamp(ctx, s, p, x, y, maxW, a) {   // только настоящая дата маршрута, без выдуманных дат у схемы героя
      if (!CH.grain || E.journey.schematic || !E.today.date || !Number.isFinite(Date.parse(E.today.date))) return false;
      const label = E.dateLine(s, p); if (!label) return false;
      ctx.save(); ctx.globalAlpha *= a; ctx.font = `500 ${px(36)}px ${BODY}`;
      const w = Math.min(px(maxW), ctx.measureText(label).width + px(56)), h = px(90);
      ctx.translate(x + w / 2, y - px(12)); ctx.rotate(-.035); ctx.strokeStyle = AP.muted; ctx.lineWidth = px(2);
      ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2 + px(6), -h / 2 + px(6), w - px(12), h - px(12));
      text(ctx, label, 0, px(12), { size: 36, weight: 500, color: AP.muted, align: 'center', max: w / u - 36 });
      ctx.restore(); return true;
    }
    function cover(ctx, s, p, a, dy, lt) {   // обложка: название и главные цифры трека; самого трека здесь нет — он на следующем экране
      const ct = E.coverTexts(s, p), x = px(86), tw = portrait ? 908 : 1700, f = (d, len = 0.6) => a * smooth(clamp((lt - d) / len, 0, 1));
      ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = AP.bg; ctx.fillRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, window.Appearance.rgba(AP.accent, 0.0)); g.addColorStop(1, window.Appearance.rgba(AP.accent, 0.16)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
      if (CH.circle) { ctx.save(); ctx.globalAlpha *= f(0.1, 0.8); ctx.fillStyle = AP.accent; ctx.beginPath(); ctx.arc(W - px(10), px(portrait ? 250 : 200), px(portrait ? 360 : 320), 0, 6.2832); ctx.fill(); ctx.restore(); }
      if (CH.stamp && E.today && E.today.day != null) {
        ctx.save(); ctx.globalAlpha *= f(1.0, 0.5); ctx.translate(W - px(portrait ? 230 : 300), portrait ? H - px(470) : H / 2); ctx.rotate(-0.21); ctx.strokeStyle = AP.accent; ctx.lineWidth = px(7); ctx.beginPath(); ctx.arc(0, 0, px(118), 0, 6.2832); ctx.stroke(); ctx.lineWidth = px(3); ctx.beginPath(); ctx.arc(0, 0, px(98), 0, 6.2832); ctx.stroke();
        text(ctx, E.manualSet ? 'ТОЧЕК' : 'ДЕНЬ', 0, -px(18), { size: 34, weight: 600, ls: .14, color: AP.accent, align: 'center' }); text(ctx, String(E.today.day), 0, px(52), { size: 78, fam: HEAD, weight: HW, color: AP.accent, align: 'center' }); ctx.restore();
      }
      const km = p && p.km ? Math.round(p.km) : null, items = [km ? [km + ' км', 'дистанция'] : null, p && p.time ? [p.time, 'в пути'] : null, p && p.gain ? ['+' + p.gain + ' м', 'набор высоты'] : null, p && p.maxEle ? [p.maxEle + ' м', 'высшая точка'] : null].filter(Boolean).slice(0, 4);
      const top = px(portrait ? 300 : 230);
      text(ctx, ct.from, x, top, { size: 46, weight: 500, max: tw, color: AP.muted, a: f(0.1) });
      let size = ct.small ? 132 : portrait ? 170 : 150, lines;
      const shelf = !items.length ? 100 : portrait ? (items.length - 1) * 215 + 196 : 252;
      const limit = H / u - (LOGO && E.logo.where !== 'header' ? 160 : portrait ? 160 : 100) - shelf;
      // Длинная фраза переносится, а не сжимается в одну мелкую строку; снизу остаётся место для цифр и логотипа.
      for (;;) {
        lines = wrapLines(ctx, ct.to, HW, px(size), HEAD, px(tw), portrait ? 5 : 3);
        const bottom = top / u + size + 40 + size * 1.04 * ((lines || []).length - 1) + (portrait ? 130 : 110);
        if ((lines && bottom <= limit) || size <= 60) break;
        size = Math.max(60, size - 6);
      }
      const titleY = top + px(size + 40), ls = lines || [ct.to];
      ls.forEach((ln, i) => text(ctx, ln, x, titleY + i * px(size * 1.04), { size, weight: HW, fam: HEAD, max: tw, ls: -.035, color: AP.text, a: f(0.3) }));
      const fy = titleY + px(size * 1.04) * (ls.length - 1) + px(portrait ? 130 : 110);
      ctx.save(); ctx.globalAlpha *= f(0.6); ctx.fillStyle = AP.accent; ctx.fillRect(x, fy - px(60), px(100), px(10)); ctx.restore();
      if (!items.length) { if (!dateStamp(ctx, s, p, x, fy + px(40), tw, f(.7))) text(ctx, E.dateLine(s, p), x, fy + px(40), { size: 54, weight: 600, color: AP.text, max: tw, a: f(0.7) }); logoEnds(ctx, f(0.7)); return; }
      items.forEach(([v, l], i) => {
        const d = 0.7 + i * 0.18, cw = portrait ? 0 : (px(1700) / items.length), X = portrait ? x : x + i * cw, Y = portrait ? fy + px(i * 215) : fy + px(60);
        text(ctx, v, X, Y + px(110), { size: portrait ? 118 : 104, weight: 700, fam: NUM, max: portrait ? tw : cw / u - 30, color: AP.text, a: f(d) });
        text(ctx, l.toUpperCase(), X, Y + px(portrait ? 164 : 160), { size: 36, weight: 600, ls: .12, color: AP.accent, max: portrait ? tw : cw / u - 30, a: f(d + 0.1) });
      });
      if (!dateStamp(ctx, s, p, x, H - px(portrait ? 150 : 90), tw, f(1.1))) text(ctx, E.dateLine(s, p), x, H - px(portrait ? 150 : 90), { size: 40, color: AP.muted, max: tw, a: f(1.1) });
      // Логотип начинается ниже последней подписи; высота ограничена свободным полем до низа.
      logoEnds(ctx, f(1.1), fy + px(portrait ? (items.length - 1) * 215 + 196 : 252));
    }

    /* ---------- рельеф: настоящие высоты, 3D-вид с маршрутом поверх (Terrain), запасной вариант — эскиз ---------- */
    const terr = { today: null, all: null }, relLoads = [];
    if (E.relief !== false && window.Terrain) {
      const fams = new Set(E.famsInPlan());
      if (fams.has('road')) relLoads.push(window.Terrain.load(E.bboxToday(), { land: AP.land, water: AP.water }).then((T) => { terr.today = T; }));
      if (fams.has('jroad')) relLoads.push(window.Terrain.load(E.bboxAll(), { land: AP.land, water: AP.water }).then((T) => { terr.all = T; }));
    }
    /* плоская карта (та же векторная, что была в «Атласе» и «Полуночи»): интерфейс как у Terrain — projector и render */
    let flatCv = null;
    const flatApi = {
      projector: (T, cam) => { const k = Math.pow(2, cam.fz); return (x, y) => [cam.fax + (x - cam.cx) * k, cam.fay + (y - cam.cy) * k]; },
      render: (T, cam, w, h) => {
        if (!window.VMap) return null; if (!flatCv) flatCv = document.createElement('canvas'); if (flatCv.width !== w || flatCv.height !== h) { flatCv.width = w; flatCv.height = h; }
        const g = flatCv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = AP.land; g.fillRect(0, 0, w, h);
        const close = cam.fz >= 9.6, mix = (c, k) => window.Appearance.rgba(c, k);
        window.VMap.draw(g, w, h, { cx: cam.cx, cy: cam.cy, z: cam.fz, rot: 0 }, cam.fax, cam.fay, { water: AP.water, waterLine: mix(AP.text, 0.28), park: mix('#ffffff', 0.16), urban: mix('#000000', 0.07), road: close ? mix(AP.text, 0.32) : null, rail: close ? mix(AP.text, 0.22) : null, border: mix(AP.accent, 0.55), label: AP.text, halo: mix(AP.bg, 0.8), font: BODY, noWaterways: cam.fz < 7.5 }, { fills: true, lines: true, labels: false }, 'ru', u);
        return flatCv;
      },
    };
    function reliefView(ctx, jr, sets, tr, t, a, opts, c) {
      const FL = !!opts.flat, T = FL ? { tex: { avg: AP.land } } : jr ? terr.all : terr.today; if (!T || (!FL && !window.Terrain)) return false;   // FL — плоская векторная карта (VMap) вместо 3D-рельефа
      const MAP = FL ? flatApi : window.Terrain;
      const [mx, my, mw, mh] = box(c.map), nb = box(c.names), Z = opts.bleed;   // bleed: зона [x0,y0,x1,y1] в пикселях, где должен уместиться маршрут; карта рисуется на весь кадр
      const iw = FL ? W : Z ? W + 2 * Math.abs((Z[0] + Z[2]) / 2 - W / 2) : mw - px(36), ih = FL ? H : Z ? H + 2 * Math.abs((Z[1] + Z[3]) / 2 - H / 2) : my + mh - px(46) - Math.max(my + px(18), nb[1] + nb[3] + px(14)), ix = FL ? 0 : Z ? (Z[0] + Z[2]) / 2 - iw / 2 : mx + px(18), iy = FL ? 0 : Z ? (Z[1] + Z[3]) / 2 - ih / 2 : Math.max(my + px(18), nb[1] + nb[3] + px(14));   // окно рельефа начинается под подписью маршрута
      const today = sets.find((s) => s.today) || sets[sets.length - 1], use = jr ? sets : [today];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const s of use) for (const p of s.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      const e = Math.max(x1 - x0, y1 - y0, 0.02), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const a0 = today.pts[0], a1 = today.pts[today.pts.length - 1], len = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
      const heading = len > e * 0.25 ? (Math.atan2(a1[0] - a0[0], -(a1[1] - a0[1])) * 180) / Math.PI : 0;   // линия уходит от зрителя
      const hd = tr > 0 ? headAt(today.pts, today.cum, tr) : null, follow = !jr && hd ? clamp(tr, 0, 1) : 0;
      const amp = opts.amp || 0, intro = 1 - smooth(clamp((opts.lt != null ? opts.lt : t) / 5, 0, 1)), fovR = (38 * Math.PI) / 360, dist = (e * 1.15) / Math.tan(fovR) * (iw / ih > 1 ? 0.55 : 0.62);
      const cam = { cx: lerp(cx, hd ? hd.x : cx, 0.55 * follow), cy: lerp(cy, hd ? hd.y : cy, 0.55 * follow), dist, pitch: (opts.bleed ? 50 : 62) + 6 * easeOut(t / 14) - 22 * amp * intro, bearing: heading + 9 * Math.sin(t * 0.17) - 22 * amp * intro, fov: 38, fade: opts.bleed ? 0.2 : 0.05 };   // въезд: из высоты и сбоку — вниз и к маршруту, дальше медленный облёт
      if (FL) { const zw = Z[2] - Z[0], zh = Z[3] - Z[1]; cam.cx = cx; cam.cy = cy; cam.fax = (Z[0] + Z[2]) / 2; cam.fay = (Z[1] + Z[3]) / 2; cam.fz = Math.min(15, Math.max(3, Math.log2(Math.min(zw * 0.8 / Math.max(x1 - x0, 1e-6), zh * 0.8 / Math.max(y1 - y0, 1e-6))))) + 0.3 * smooth(opts.prog || 0); }
      if (!FL) {   // вся пройденная часть маршрута должна быть в окне: камера отъезжает, если голова ушла далеко от центра (разрывы, петли, длинные дни)
        const smp = [], upto = !jr && hd ? hd.i : Infinity;
        for (const st of use) { const step = Math.max(1, Math.floor(st.pts.length / 60)); for (let i = 0; i < st.pts.length && i <= upto; i += step) smp.push(st.pts[i]); }
        if (hd) smp.push([hd.x, hd.y]);
        for (let k = 0; k < 4; k++) {
          const Pj = window.Terrain.projector(T, cam, iw, ih); let r = 1;
          for (const q of smp) { const z = Pj(q[0], q[1]); if (!z) { r = 3; break; } r = Math.max(r, Math.abs(z[0] - iw / 2) / (Z ? (Z[2] - Z[0]) * 0.46 : iw * (!jr && E.pins.length ? 0.30 : opts.deco === false ? 0.40 : 0.48)), Math.abs(z[1] - ih / 2) / (Z ? (Z[3] - Z[1]) * 0.46 : ih * 0.46)); }
          if (r <= 1) break; cam.dist *= Math.min(1.8, r);
        }
      }
      cam.dist *= 1 + 0.35 * amp * intro;
      const cv = MAP.render(T, cam, iw, ih); if (!cv) return false;
      ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = FL ? AP.land : Z ? AP.shade : (T.tex && T.tex.avg) || '#b4ba94'; if (Z || FL) ctx.fillRect(0, 0, W, H); else ctx.fillRect(ix, iy, iw, ih); ctx.drawImage(cv, ix, iy);   // фон окна — средний цвет самой текстуры: край модели не виден   // подложка окна: по углам рельефа не видно светлого пятна
      ctx.beginPath(); if (Z || FL) ctx.rect(0, 0, W, H); else ctx.rect(ix, iy, iw, ih); ctx.clip(); ctx.translate(ix, iy);
      const P = MAP.projector(T, cam, iw, ih); const poly = (pts, brk, upto, extra) => { ctx.beginPath(); let pen = false; const n = upto == null ? pts.length - 1 : upto; for (let i = 0; i <= n && i < pts.length; i++) { const q = P(pts[i][0], pts[i][1]); if (!q) { pen = false; continue; } (pen && !(brk && brk.has(i))) ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); pen = true; } if (extra) { const q = P(extra[0], extra[1]); if (q) ctx.lineTo(q[0], q[1]); } };
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const s of sets) if (s !== today) { poly(s.pts, s.brk, null); if (E.journey.schematic) ctx.setLineDash([14 * u, 10 * u]); ctx.strokeStyle = 'rgba(244,232,203,.85)'; ctx.lineWidth = 7 * u; ctx.stroke(); ctx.strokeStyle = 'rgba(89,80,61,.85)'; ctx.lineWidth = 3.5 * u; ctx.stroke(); ctx.setLineDash([]); }
      if (hd) {
        poly(today.pts, today.brk, hd.i, [hd.x, hd.y]); const rw = AP.routeW; if (E.journey.schematic) ctx.setLineDash([26 * u, 18 * u]); else if (CH.route === 'dash') ctx.setLineDash([30 * u * rw, 22 * u * rw]);
        ctx.lineCap = CH.route === 'square' ? 'butt' : 'round';
        if (CH.halo) { ctx.strokeStyle = CH.halo; ctx.lineWidth = 20 * u * rw; ctx.stroke(); }
        if (CH.route === 'glow') { ctx.shadowColor = AP.route; ctx.shadowBlur = 28 * u; }
        ctx.strokeStyle = C.route; ctx.lineWidth = (CH.route === 'square' ? 15 : 12) * u * rw; ctx.stroke(); ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.setLineDash([]); ctx.lineCap = 'round';
        const s0 = P(today.pts[0][0], today.pts[0][1]); if (s0) { ctx.beginPath(); ctx.arc(s0[0], s0[1], 16 * u, 0, 6.2832); ctx.fillStyle = C.card; ctx.fill(); ctx.lineWidth = 7 * u; ctx.strokeStyle = C.accent; ctx.stroke(); }
      }
      const mark = (pt, tri) => { const q = pt && P(pt[0], pt[1]); if (!q) return; if (tri) { ctx.beginPath(); ctx.moveTo(q[0], q[1] - 34 * u); ctx.lineTo(q[0] + 26 * u, q[1] + 14 * u); ctx.lineTo(q[0] - 26 * u, q[1] + 14 * u); ctx.closePath(); ctx.fillStyle = C.ink; ctx.fill(); ctx.lineWidth = 6 * u; ctx.strokeStyle = C.card; ctx.stroke(); } else { const pulse = (t / 2) % 1; ctx.beginPath(); ctx.arc(q[0], q[1], (20 + 40 * pulse) * u, 0, 6.2832); ctx.strokeStyle = C.accent; ctx.lineWidth = 4 * u; ctx.globalAlpha *= 1 - pulse; ctx.stroke(); ctx.globalAlpha /= Math.max(1e-3, 1 - pulse); ctx.beginPath(); ctx.arc(q[0], q[1], 15 * u, 0, 6.2832); ctx.fillStyle = C.card; ctx.fill(); ctx.lineWidth = 7 * u; ctx.strokeStyle = C.accent; ctx.stroke(); } };
      mark(opts.mark, true); mark(opts.stop, false);
      if (hd) { const q = P(hd.x, hd.y); if (q) heroAt(ctx, q[0], q[1], 1, t, 0.9); }
      if (!jr && opts.deco !== false) { T0 = t; trackDeco(ctx, (pp) => P(pp[0], pp[1]), tr, 1, Z ? [Z[0], Z[1], Z[2] - Z[0], Z[3] - Z[1]] : [0, 0, iw, ih]); }
      ctx.restore();
      if (Z) return true;
      ctx.save(); ctx.globalAlpha *= a; ctx.lineWidth = px(1); ctx.strokeStyle = 'rgba(37,51,47,.12)'; ctx.strokeRect(ix, iy, iw, ih); ctx.restore();
      text(ctx, 'AWS Terrain Tiles · высоты ×' + T.exag, mx + px(40), my + mh - px(24), { size: 24, weight: 400, color: C.secondary, a: a * 0.85, max: (mw - px(80)) / u });
      return true;
    }
    const xf = (l, len = 0.6) => [1 - smooth(l / (len * 0.45)), smooth((l - len * 0.45) / (len * 0.55))];   // смена карточки: старая уходит, затем приходит новая — тексты не лежат друг на друге
    const roadZone = () => (portrait ? [px(60), px(300), W - px(60), H - px(620)] : [px(60), px(230), px(1330), H - px(150)]);
    function flatTiles() {   // плитки плоской карты для предзагрузки перед экспортом: камеры дороги по сегодняшнему маршруту и по всему пути
      if (!window.VMap) return []; const Z = roadZone(), out = [];
      for (const b of [E.bboxToday(), E.bboxAll()]) { if (!b) continue; const fz = Math.min(15, Math.max(3, Math.log2(Math.min((Z[2] - Z[0]) * 0.8 / Math.max(b.x1 - b.x0, 1e-6), (Z[3] - Z[1]) * 0.8 / Math.max(b.y1 - b.y0, 1e-6))))); for (const dz of [0, 0.3]) out.push(...window.VMap.tilesAt({ cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, z: fz + dz, rot: 0 }, (Z[0] + Z[2]) / 2, (Z[1] + Z[3]) / 2, W, H)); }
      return out;
    }
    function roadScene(ctx, s, p, t, lt, dur, jr, rs) {
      const c = L.road, env = rs.env, a = env;
      const zone = roadZone();   // сюда должен поместиться маршрут: не под заголовком и не под панелью
      const sets = E.manualSet ? [E.manualSet] : jr ? E.allSets() : [E.todaySet()];
      const tr = E.manualSet ? E.manualProgress(lt / dur) : jr ? easeOut(lt / (dur * 0.6)) : s.recipe === 'route-reveal' ? smooth(lt / (dur * 0.9)) : E.reveal(t, s);
      const ropts = { lt: 99, bleed: zone, mark: s.recipe === 'high-point' && s.hp ? s.hp : null, stop: !E.manualSet && s.recipe === 'journey-recap' ? E.recapPoint(s, lt, dur) : null };
      const run = E.run(s); let flatUsed = false; const ok = (E.relief !== false && reliefView(ctx, jr, sets, tr, t, a, ropts, c)) || (flatUsed = true, reliefView(ctx, jr, sets, tr, t, a, { ...ropts, flat: true, prog: (t - run.t0) / Math.max(0.1, run.t1 - run.t0) }, c));
      if (!ok) {
        const [mx, my, mw, mh] = box(c.map); drawCard(ctx, card(mw, mh, { seed: 5, grid: true }), mx, my, mw, mh, a, 0, 0);
        ctx.save(); ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip(); sketch(ctx, c.core, sets, tr, t, a, { ...ropts, deco: !jr }); ctx.restore();
      }
      if (ok) {   // мягкое затемнение под текстом: карта остаётся фоном, текст читается
        ctx.save(); ctx.globalAlpha *= a;
        const sh = (x0, y0, x1, y1, k) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, window.Appearance.rgba(AP.bg, k)); g.addColorStop(1, window.Appearance.rgba(AP.bg, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
        sh(0, 0, 0, px(portrait ? 520 : 340), 0.94);
        if (portrait) sh(0, H, 0, H - px(900), 0.97); else { sh(W, 0, W - px(820), 0, 0.97); sh(0, H, 0, H - px(240), 0.8); }
        ctx.restore();
      }
      if (ok && CH.glass) {   // «Ночь»: стеклянная плашка под цифрами
        const gx = portrait ? px(40) : W - px(560), gy = portrait ? H - px(560) : px(250), gw = portrait ? W - px(80) : px(520), gh = portrait ? px(470) : px(580);
        ctx.save(); ctx.globalAlpha *= a; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(gx, gy, gw, gh, px(34)); else ctx.rect(gx, gy, gw, gh); ctx.fillStyle = window.Appearance.rgba(AP.bg, 0.6); ctx.fill(); ctx.lineWidth = px(2); ctx.strokeStyle = window.Appearance.rgba(AP.accent, 0.3); ctx.stroke(); ctx.restore();
      }
      if (S.char === 'magazine') {   // полоса занимает зону фактов: снизу в вертикали, справа в горизонтали
        ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = AP.text;
        if (portrait) ctx.fillRect(0, px(c.metric[1] - 32), W, H - px(c.metric[1] - 32));
        else ctx.fillRect(px(c.metric[0] - 24), px(250), W - px(c.metric[0] - 24), H - px(250));
        ctx.restore();
      }
      if (CH.stamp) {   // «Тропа»: тонкая линия отделяет карту от цифр
        ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = window.Appearance.rgba(AP.text, .35); ctx.lineWidth = px(2);
        ctx.beginPath(); ctx.moveTo(px(c.metric[0] + 32), px(c.metric[1] - 20)); ctx.lineTo(px(c.metric[0] + c.metric[2] - 32), px(c.metric[1] - 20)); ctx.stroke(); ctx.restore();
      }
      flat = !!ok || S.char === 'magazine';
      text(ctx, jr ? E.journeyName() : E.routeNames(), px(c.names[0]), px(portrait ? 205 : 175), { size: portrait ? 68 : 64, weight: 600, color: C.ink, max: c.names[2], a, fam: BODY });
      if (!ok) tape(ctx, c.tape, 3, a, 0);
      const prev = s.t0 > E.run(s).t0 ? E.at(s.t0 - 0.0001) : null, [oa, ia] = prev ? xf(lt) : [0, 1];
      factInk = S.char === 'magazine' ? AP.bg : null;
      try {
        if (prev && oa > 0.01) roadFact(ctx, prev.s, prev.s.params || {}, s.t0 - 0.0001, prev.lt, prev.s.durationSec, env * oa);
        roadFact(ctx, s, p, t, lt, dur, ia * env);
      } finally { factInk = null; flat = false; }
      if (ok) { const T = jr ? terr.all : terr.today; text(ctx, flatUsed ? 'Карта © OpenStreetMap, OpenFreeMap' : T ? 'Рельеф: AWS Terrain Tiles · высоты ×' + T.exag : '', px(60), H - px(36), { size: 28, weight: 400, color: portrait && S.char === 'magazine' ? AP.bg : C.secondary, a: a * 0.8, max: (W - px(120)) / u }); }
    }
    function roadFact(ctx, s, p, t, lt, dur, a) {
      const c = L.road;
      if (s.recipe === 'journey-recap' && s.stops && s.stops.length) {
        // Подпись следующей вехи меняется так же плавно, как положение маркера.
        const slot = dur / (s.stops.length + .6), k = Math.min(s.stops.length - 1, Math.floor(lt / slot)), dt = lt - k * slot;
        if (k > 0 && dt < .6) {
          const [oa, ia] = xf(dt), prev = E.metric(s, p, t - dt - .0001, k * slot - .0001, dur);
          if (oa > 0.01) metricCard(ctx, c.metric, prev, a * oa, 0, 0, 11); a *= ia;
        }
      }
      if (s.recipe === 'elevation-profile') {
        const [x, y, w] = c.metric;
        elevation(ctx, s, p, t, lt, dur, a, 0, { small: true, metric: c.metric, prof: [x, y + 220, w, 150], core: [x + 40, y + 240, w - 80, 110], cap: [x + 32, y + 392, w - 64, 48], tape: [x + w - 240, y + 210, 180, 50] });
        return;
      }
      const spec = E.metric(s, p, t, lt, dur), sticker = s.recipe === 'weather-card' ? weatherSticker() : null;
      const mh2 = metricCard(ctx, c.metric, spec, a, 0, -1, 11);
      const stImg = sticker && (sticker.pack || stickerImg(sticker)); if (stImg) fitImg(ctx, stImg, [c.metric[0] + c.metric[2] - 150, c.metric[1] - 130, 120, 120], a, 6, 0);
      // На странице дороги знак путешественника остаётся только на маршруте.   // уницикл под карточкой километров, справа — не на тексте
    }
    function styleDetail(ctx, x, y, wU, ink, a) {   // одна подпись характера: чернила, свет, журнальная полоса или туристический штамп
      const w = px(wU); ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.strokeStyle = ctx.fillStyle = ink;
      if (CH.pins === 'polaroid') {
        ctx.lineWidth = px(4); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0);
        for (let i = 1; i <= 24; i++) ctx.lineTo(w * i / 24, px(Math.sin(i * 2.3) * 1.8));
        ctx.stroke(); ctx.globalAlpha *= .45; ctx.beginPath(); ctx.moveTo(px(8), px(8)); ctx.lineTo(w * .7, px(9)); ctx.stroke();
      } else if (CH.pins === 'circle') {
        ctx.shadowColor = ink; ctx.shadowBlur = px(14); ctx.lineWidth = px(3); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(w-px(22),0); ctx.stroke(); ctx.beginPath(); ctx.arc(w-px(7),0,px(7),0,6.2832); ctx.fill();
      } else if (CH.pins === 'square') {
        ctx.fillRect(0,-px(7),w*.8,px(14)); ctx.fillRect(w-px(14),-px(7),px(14),px(14));
      } else {
        ctx.lineWidth = px(2); ctx.beginPath(); ctx.moveTo(0,px(12)); ctx.lineTo(0,0); ctx.arc(px(12),0,px(12),Math.PI,0); ctx.lineTo(px(24),px(12)); ctx.closePath();
        ctx.moveTo(px(42),0); ctx.lineTo(w,0); ctx.moveTo(w,-px(7)); ctx.lineTo(w,px(7)); ctx.stroke();
      }
      ctx.restore();
    }
    function arrival(ctx, s, p, a, dy, lt) {
      countryBand(ctx,E.countryOf(s,p),a);
      const label = E.arrivalLabel(s, p) || E.toLabel || E.routeNames();
      const x = px(86), y = portrait ? px(480) : px(380), width = W / u - 172;
      text(ctx, E.kindWord(s, p).toUpperCase(), x, y - px(100), { size: 38, color: C.accent, ls: .1, a });
      let size = 140, lines;
      while (!(lines = wrapLines(ctx, label, HW, px(size), HEAD, px(width), 3)) && size > 60) size -= 8;
      (lines || [label]).forEach((ln, i) => text(ctx, ln, x, y + i * px(size * 1.15), { size, fam: HEAD, weight: HW, max: width, a }));
      styleDetail(ctx, x, y + px(75 + (lines || [label]).length * size), 280, AP.text, a);
      text(ctx, E.dateLine(s, p), x, y + px(140 + (lines || [label]).length * size), { size: 36, color: C.secondary, max: width, a });
      if (E.stk(1)) fitImg(ctx, E.stk(1), [W / u - 200, H / u - 300, 110, 110], a, 0, 0, false);
    }
    function photoScene(ctx, s, p, t, lt, dur, withPlace = false) {
      const c = L.photo, ids = (p.mediaIds || []).filter((id) => E.mediaById[id]), n = ids.length; if (!n) return;
      const slot = dur / n, k = Math.min(n - 1, Math.floor(lt / slot)), l2 = lt - k * slot, a = k > 0 ? smooth(l2 / Math.min(0.6, slot * 0.4)) : 1;
      if (k > 0 && a < 1) photoCard(ctx, s, E.mediaById[ids[k - 1]], slot, slot, 1 - a, withPlace);
      photoCard(ctx, s, E.mediaById[ids[k]], l2, slot, a, withPlace);
    }
    function photoCard(ctx, s, m, l2, slot, a, withPlace) {
      const e = E.img(m.url); ctx.save(); ctx.globalAlpha *= a;
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
      if (e.ok) {
        const im = e.img, zoom = 1.015 + .025 * smooth(l2 / slot), sc = Math.max(W / im.width, H / im.height) * zoom;
        ctx.drawImage(im, (W - im.width * sc) / 2, (H - im.height * sc) / 2, im.width * sc, im.height * sc);
      }
      imageShade(ctx);
      const x = px(86), max = W - 2 * x, cap = m.caption || E.toLabel || '';
      let size = px(portrait ? 76 : 64), lines;
      while (!(lines = wrapLines(ctx, cap, 600, size, BODY, max, 3)) && size > px(30)) size *= .9;
      const captionY = H - px(portrait ? 330 : 300) - ((lines || [cap]).length - 1) * size * 1.15;
      (lines || [cap]).forEach((ln, i) => text(ctx, ln, x, captionY + i * size * 1.15, { size: size / u, weight: 600, color: AP.photoText, max: max / u }));
      styleDetail(ctx, x, H - px(portrait ? 255 : 245), 280, AP.photoText, 1);
      text(ctx, E.photoDate(m, s), x, H - px(190), { size: 38, color: AP.photoText, max: (max - px(portrait ? 0 : 170)) / u });
      if (m.credit) text(ctx, m.credit, x, H - px(112), { size: 30, color: AP.photoText, max: (max - px(170)) / u });
      ctx.restore();
    }
    function elevation(ctx, s, p, t, lt, dur, a, dy, layout = L.elev) {
      const c = layout, pr = p.profile; const [px0, py0, pw, ph] = box(c.prof);
      if (pr && pr.length >= 8) {
        drawCard(ctx, card(pw, ph, { seed: 12, grid: true }), px0, py0, pw, ph, a, 0, dy);
        const [cx, cy, cw, chh] = box(c.core), lo = Math.min(...pr), hi = Math.max(...pr), sp = Math.max(1, hi - lo);
        const X = (i) => cx + (cw * i) / (pr.length - 1), Y = (e) => cy + chh - ((e - lo) / sp) * chh;
        const g = easeOut(lt / (dur * 0.5)) * (pr.length - 1), gi = Math.floor(g), gf = g - gi;
        const ex = gi >= pr.length - 1 ? X(pr.length - 1) : lerp(X(gi), X(gi + 1), gf), ey = gi >= pr.length - 1 ? Y(pr[pr.length - 1]) : lerp(Y(pr[gi]), Y(pr[gi + 1]), gf);
        ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, dy);
        ctx.beginPath(); ctx.moveTo(cx, cy + chh); ctx.lineTo(cx, Y(pr[0])); for (let i = 1; i <= Math.min(gi, pr.length - 1); i++) ctx.lineTo(X(i), Y(pr[i])); ctx.lineTo(ex, ey); ctx.lineTo(ex, cy + chh); ctx.closePath();
        ctx.fillStyle = window.Appearance.rgba(factInk || AP.route, .18); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx, Y(pr[0])); for (let i = 1; i <= Math.min(gi, pr.length - 1); i++) ctx.lineTo(X(i), Y(pr[i])); ctx.lineTo(ex, ey); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = (c.small ? 6 : 12) * u; ctx.strokeStyle = factInk || C.accent; ctx.stroke();
        const mi = pr.indexOf(hi);
        if (p.maxEle != null && g >= mi) { const ma = smooth((g - mi) / 3); ctx.globalAlpha *= ma; ctx.beginPath(); ctx.arc(X(mi), Y(hi), 14 * u, 0, 6.2832); ctx.fillStyle = factInk ? AP.text : C.card; ctx.fill(); ctx.lineWidth = 7 * u; ctx.strokeStyle = factInk || C.accent; ctx.stroke(); }
        ctx.restore();
        tape(ctx, c.tape, -4, a, dy);
        text(ctx, `${E.fmtN(Math.round(lo))} → ${E.fmtN(Math.round(hi))} м над уровнем моря`, box(c.cap)[0], box(c.cap)[1] + px(c.small ? 32 : 48), { size: c.small ? 32 : 44, weight: 500, color: factInk || C.secondary, max: c.cap[2], a });
      }
      metricCard(ctx, c.metric, { kicker: 'набор высоты', big: '+' + E.fmtN(p.gain) + ' м', sub: pr ? c.small ? '' : 'рельеф дня' : 'за день ' + E.today.day, size: c.small ? 110 : L.counter }, a, c.small ? 0 : (1 - easeOut(lt / 0.6)) * px(24), -1, 13);
    }
    function barcode(ctx, s, p, t, lt, dur, a, dy) {
      const c = L.road, [mx, my, mw, mh] = box(c.map); drawCard(ctx, card(mw, mh, { seed: 15, grid: true }), mx, my, mw, mh, a, 0, dy);
      const days = E.days, n = days.length, bw = px(c.core[2]), bx = px(c.core[0]), by = px(c.core[1] + c.core[3]), hh = px(c.core[3]), step = bw / n, w = Math.max(3 * u, step * 0.66), mxk = E.maxKm;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, dy);
      days.forEach((d, i) => { const grow = easeOut(lt / 1.8 - (i / n) * 0.5), rest = d.km < 1, isT = d.day === E.today.day, h = rest ? 6 * u : Math.max(6 * u, (d.km / mxk) * hh * grow); ctx.fillStyle = isT ? C.accent : rest ? C.guide : window.Appearance.rgba(AP.muted,.78); ctx.fillRect(bx + i * step + (step - w) / 2, by - h, w, h); });
      ctx.restore(); tape(ctx, c.tape, 3, a, dy);
      metricCard(ctx, c.metric, { kicker: 'день за днём', big: `${n} ${E.daysWord(n)}`, sub: 'высота столбика — километры за день' }, a * E.vis(lt, dur, 0.4), (1 - easeOut(lt / 0.6)) * px(24), -1, 17);
    }
    function noteScene(ctx, s, p, a, dy, lt) {
      const txt = '«' + (p.text || '') + '»', w = px(Math.min(880, (portrait ? 880 : 1200))), size = px(portrait ? 96 : 84); const g = ctx; g.save(); g.font = `400 ${size}px ${HAND}`;
      const words = txt.split(/\s+/), lines = []; let cur = ''; for (const wd of words) { const tt = cur ? cur + ' ' + wd : wd; if (g.measureText(tt).width > w - px(96) && cur) { lines.push(cur); cur = wd; } else cur = tt; } lines.push(cur); g.restore();
      const lh = size * 1.15, h = px(128) + lines.length * lh + px(64), x = (W - w) / 2, y = (H - h) / 2 - px(40);
      drawCard(ctx, card(w, h, { seed: 21 }), x, y, w, h, a, -1.2, dy);
      text(ctx, 'из дневника · день ' + E.today.day, x + px(48), y + px(76), { size: 38, weight: 600, color: C.secondary, ls: 0.05, a });
      lines.forEach((ln, i) => text(ctx, ln, x + px(48), y + px(128) + (i + 0.8) * lh, { size: size / u, fam: HAND, weight: 400, color: C.ink, a, max: (w - px(96)) / u }));
      tape(ctx, [x / u + 120, y / u - 30, 288, 80], -4, a, dy);
    }
    function finale(ctx, s, p, t, lt, dur, a, dy) {
      const f = E.finale(s, p, t, lt, dur), x = px(86), width = W / u - 172, ink = AP.finalText;
      ctx.save(); ctx.fillStyle = AP.finalBg; ctx.fillRect(0, 0, W, H); ctx.restore();
      text(ctx, s.recipe === 'day-summary' ? 'ПРОЙДЕНО ЗА ДЕНЬ' : 'ВСЕГО ЗА ПУТЕШЕСТВИЕ', x, px(portrait ? 350 : 270), { size: 38, weight: 600, color: ink, ls: .07, a });
      const match = String(f.big).match(/^(.*?)\s*(км)$/), number = match ? match[1] : f.big;
      text(ctx, number, x, px(portrait ? 760 : 620), { size: portrait ? 330 : 390, fam: NUM, weight: 700, color: ink, max: width, ls: -.045, a });
      if (match) text(ctx, match[2], x, px(portrait ? 880 : 750), { size: 92, weight: 600, color: ink, a });
      text(ctx, f.kicker, x, px(portrait ? 1040 : 870), { size: 42, max: portrait ? width : 1100, color: ink, a });
      text(ctx, f.sub, x, px(portrait ? 1130 : 945), { size: 38, max: portrait ? width : 1100, color: ink, a });
      styleDetail(ctx, x, px(portrait ? 1210 : 1000), 280, ink, a);
      logoEnds(ctx, a);
      if (portrait) {
        const sets = E.allSets(), b = [86, 1280, 908, 230], F = fitPts(sets.map(q => q.pts), b);
        for (const q of sets) { const st = stroke(ctx, q.pts, q.brk, F, null, px(5), ink, E.journey.schematic ? [px(16), px(12)] : null, a * .7); if (st) st.end(); }
      }
    }

    /* шапка страницы: «День 47» от руки слева, дата справа, тонкая линия — как в бумажном дневнике; держится весь ролик, не мигает */
    function pageHeader(ctx, s, p, dark, t) {
      const onPhoto = FAM[s.recipe] === 'photo' && E.run(s).shots.some(q => ['photo-reveal', 'highlights-reel'].includes(q.recipe) && (q.params.mediaIds || []).some(id => E.mediaById[id]));
      const x = px(86), y = px(portrait ? 126 : 94), right = W - x, fin = FAM[s.recipe] === 'fin', ink = fin ? AP.finalText : onPhoto ? AP.photoText : C.ink;
      if (LOGO && LOGO.ok && E.logo.where !== 'ends') drawLogo(ctx, x, y - px(46), px(portrait ? 320 : 360), px(60), 'left', 1); else text(ctx, E.NAME || 'ROUTE STORY', x, y, { size: 36, weight: 500, max: portrait ? 470 : 900, color: ink });
      text(ctx, E.journey.schematic ? 'ИСТОРИЯ ПУТИ' : 'ДЕНЬ ' + E.today.day, right, y, { size: 34, weight: 500, align: 'right', max: 390, color: ink });
      ctx.save(); ctx.strokeStyle = window.Appearance.rgba(ink, .24); ctx.lineWidth = px(1); ctx.beginPath(); ctx.moveTo(x, y + px(34)); ctx.lineTo(right, y + px(34)); ctx.stroke(); ctx.restore();
    }
    /* ---------- кадр ---------- */
    function memories(ctx, s, p, t, lt, dur, a, dy, run) {
      const ph = run.shots.find((q) => q.recipe === 'photo-reveal' || q.recipe === 'highlights-reel');
      if (!ph || !(ph.params.mediaIds || []).some((id) => E.mediaById[id])) { arrival(ctx, s, p, a, dy, t - run.t0); return; }
      const ar = run.shots.find((q) => q.recipe === 'checkpoint-arrival' || q.recipe === 'location-card');
      photoScene(ctx, ph, ph.params, t, t - run.t0, run.t1 - run.t0, !!ar);
      const label = ar ? E.arrivalLabel(ar, ar.params) : portrait ? 'Моменты пути' : null;
      const x = px(86), y = portrait ? px(300) : px(260), width = W / u - 172;
      let countryTop = 180;
      if (label) {
        let size = portrait ? 100 : 90, lines;
        while (size > 32) {
          lines = wrapLines(ctx, label, HW, px(size), HEAD, px(width), portrait ? 1 : 3);
          if (lines && (portrait || y / u + (lines.length - 1) * size * 1.17 + size * .3 + 80 <= 540)) break;
          size -= 4;
        }
        (lines || [label]).forEach((ln, i) => text(ctx, ln, x, y + i * px(size * 1.17), { size, fam: HEAD, weight: HW, max: width, color: AP.photoText, a }));
        countryTop = y / u + ((lines || [label]).length - 1) * size * 1.17 + size * .3 + 32;
      }
      countryBand(ctx,E.countryOf(ar || s,ar ? ar.params : p),a,true,countryTop);
      if (E.stk(1)) fitImg(ctx, E.stk(1), portrait ? [870, 1690, 110, 110] : [W / u - 196, H / u - 222, 110, 110], a, 0, 0, false);
    }
    function drawPage(ctx, t, s, su, lt, TR) {
      const dur = s.durationSec, fam = FAM[s.recipe] || 'road', p = s.params || {};
      const dark = fam === 'fin';
      const run = E.run(s), rlt = t - run.t0, rdur = run.t1 - run.t0;   // общая огибающая семьи: страница не «мигает», пока идут кадры одной семьи подряд
      ctx.drawImage(pageCanvas(dark), 0, 0);
      const env = run.t0 === 0 ? smooth(rlt / 0.9) : 1;   // страница не исчезает перед сменой разворота
      const a = env, dy = (1 - easeOut(rlt / 0.7)) * px(36);
      ctx0 = ctx;
      switch (fam) {
        case 'cover': cover(ctx, s, p, a, dy, rlt); break;
        case 'road': roadScene(ctx, s, p, t, lt, dur, false, { env, lt: rlt }); break;
        case 'jroad': roadScene(ctx, s, p, t, lt, dur, true, { env, lt: rlt }); break;
        case 'arrival': arrival(ctx, s, p, a, dy, rlt); break;
        case 'photo': memories(ctx, s, p, t, lt, dur, a, dy, run); break;
        case 'elev': elevation(ctx, s, p, t, rlt, rdur, a, dy); break;
        case 'barcode': barcode(ctx, s, p, t, rlt, rdur, a, dy); break;
        case 'note': noteScene(ctx, s, p, a, dy, rlt); break;
        case 'fin': finale(ctx, s, p, t, rlt, rdur, a, dy); break;
        default: roadScene(ctx, s, p, t, lt, dur, false, { env, lt: rlt });
      }
      if (CH.glass && ['cover', 'road', 'jroad'].includes(fam)) {   // «Ночь»: неподвижная мягкая виньетка, готовится один раз на размер ролика
        let cv = cache.get('vignette');
        if (!cv) {
          cv = document.createElement('canvas'); cv.width = W; cv.height = H;
          const g = cv.getContext('2d'); g.scale(W, H);
          const shade = g.createRadialGradient(.5, .5, .18, .5, .5, .72);
          shade.addColorStop(0, window.Appearance.rgba(AP.shade, 0)); shade.addColorStop(.55, window.Appearance.rgba(AP.shade, .12)); shade.addColorStop(1, window.Appearance.rgba(AP.shade, .48));
          g.fillStyle = shade; g.fillRect(0, 0, 1, 1); cache.set('vignette', cv);
        }
        ctx.save(); ctx.globalAlpha *= a; ctx.drawImage(cv, 0, 0); ctx.restore();
      }
      pageHeader(ctx, s, p, dark, t);
      if (CH.grain && FAM[s.recipe] !== 'fin') grain(ctx);   // на финале цвет — ровно тот, что выбрал путешественник
    }
    let grainCv = null;   // «Бумага»: лёгкое зерно поверх кадра
    function grain(ctx) {
      if (!grainCv) { grainCv = document.createElement('canvas'); grainCv.width = grainCv.height = 256; const g = grainCv.getContext('2d'), id = g.createImageData(256, 256); let sd = 7; for (let i = 0; i < id.data.length; i += 4) { sd = (sd * 1664525 + 1013904223) >>> 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = 128 + ((sd >>> 24) % 100) - 50; id.data[i + 3] = 255; } g.putImageData(id, 0, 0); }
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.1; ctx.fillStyle = ctx.createPattern(grainCv, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    const TURN = 1; let turnCanvas = null, turnAt = -1;
    function draw(ctx, t, s, su, lt, TR) {
      drawPage(ctx, t, s, su, lt, TR);
      const at = E.run(s).t0, dt = t - at;
      if (at <= 0 || dt < 0 || dt >= TURN) return;
      if (!turnCanvas) { turnCanvas = document.createElement('canvas'); turnCanvas.width = W; turnCanvas.height = H; }
      if (turnAt !== at) {
        const prevT = at - .0001, prev = E.at(prevT), g = turnCanvas.getContext('2d');
        g.clearRect(0, 0, W, H); drawPage(g, prevT, prev.s, prev.u, prev.lt, TR); turnAt = at;
      }
      ctx.save(); ctx.globalAlpha *= 1 - smooth(dt / TURN); ctx.drawImage(turnCanvas, 0, 0); ctx.restore();
    }
    const packNeeded = () => (['land/02', 'sign/09', 'sign/10', 'sign/11', 'sign/12', 'frame/compass-map', 'frame/polaroid', 'frame/photo-frame', 'frame/begins-here']).concat(wxId(E.WX) ? ['wx/' + wxId(E.WX)] : []);
    return { draw, flatTiles, ready: Promise.all([READY(packNeeded), window.Flags.preload(E.countriesInPlan()), ...(LOGO ? [LOGO.p] : []), ...relLoads, ...(E.relief ? [] : [Promise.all(flatTiles().map((q) => window.VMap.getTile(q.z, q.x, q.y).p))])]), isDark: s => FAM[s.recipe] !== 'fin', footerColor: s => FAM[s.recipe] === 'fin' ? AP.finalText : ['cover','photo'].includes(FAM[s.recipe]) ? AP.photoText : AP.text };
  }

  window.Journal = { create, FAM };
})();
