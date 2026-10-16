/* Интерфейс: загрузка → стиль → история → экспорт. */
(function () {
  const $ = (id) => document.getElementById(id);
  const { parseAny, prepare } = window.RouteLib;
  const { createScene, STYLES } = window.RS;

  const state = {
    route: null, journeyData: null, seriesBase: null, etype: 'returning-viewer', mode: 'track', styleId: 'journal', fmt: 'v', jcount: 99,
    o: { title: '', subtitle: '', startName: '', endName: '', duration: 20, showSpeed: true, showEle: true, lang: 'ru', places: [], note: '', photos: [] },
  };
  const touched = {};
  let scene = null, playing = false, t = 0, last = 0, dirty = true, objUrl = null, abort = null;
  let sourceId = 0;   // запоздавший ответ относится только к выбору маршрута, который его запустил
  const cv = $('cv'), ctx = cv.getContext('2d');

  const SIZES = { v: { hd: [1080, 1920], sd: [720, 1280] }, h: { hd: [1920, 1080], sd: [1280, 720] } };
  const previewSize = () => (state.fmt === 'v' ? [540, 960] : [960, 540]);

  /* ---- шрифты ---- */
  const fontsReady = Promise.all([window.Appearance.ready(), Promise.all(
    ['400 40px "Yeseva One"', '400 40px "Marck Script"', '700 40px "RS DINish"', '400 30px "RS Geologica"', '500 30px "RS Geologica"', '600 30px "RS Geologica"', '700 30px "RS Geologica"', '700 40px "RS Geologica Num"']
      .map((f) => document.fonts.load(f, 'АаЯя Aa 0123').catch(() => {}))
  )]).then(() => document.fonts.ready).catch(() => {});

  /* ---- стили ---- */
  const SKIN = { journal: ['paper', 'yeseva', 'geologica'], night: ['night', 'din', 'din'], paper: ['trail', 'prata', 'onest'], editorial: ['magazine', 'geologica', 'geologica'] };   // характер стиля: палитра + шрифты (дальше можно менять вручную)   // стиль = палитра по умолчанию + набор значков; раскладка и камера у всех одни
  const swatch = { journal: 'linear-gradient(135deg,#efe3c6 0%,#efe3c6 45%,#d9c89c 45%,#d9c89c 78%,#b13a21 78%)', night: 'linear-gradient(135deg,#0a1428,#13264a 55%,#ffb454 56%,#ff6b35)', paper: 'linear-gradient(135deg,#1f3329,#2c4638 55%,#e8c57e 56%,#e8c57e)', editorial: 'linear-gradient(135deg,#f1eee6,#e4e0d4 55%,#c23e28 56%,#c23e28)' };
  const styleHint = { journal: 'Бумага и полароиды', night: 'Светящаяся линия', editorial: 'Крупные цифры', paper: 'Туристический штамп' };
  Object.entries(STYLES).forEach(([id, s]) => {
    const b = document.createElement('button');
    b.dataset.id = id; b.className = id === state.styleId ? 'on' : '';
    b.innerHTML = `<div class="sw" style="background:${swatch[id]}"></div><span>${s.name}<small>${styleHint[id]}</small></span>`;
    b.onclick = () => { state.styleId = id; const sk = SKIN[id]; if (sk) { state.appearance = { ...state.appearance, ...AP.palettes[sk[0]], preset: sk[0], heading: sk[1], body: sk[2] }; saveAppearance(); } $('iconLibrary').textContent = window.StyleIcons.familyName(id); [...$('styles').children].forEach((x) => x.classList.toggle('on', x === b)); rebuild(); };
    $('styles').appendChild(b);
  });
  // На узком экране сначала видны стили; на большом выбор цветов можно держать раскрытым.
  $('appearanceBox').open = matchMedia('(min-width:1000px)').matches;

  /* ---- шрифты и палитра: одинаковые для предпросмотра и экспорта ---- */
  const AP = window.Appearance, APKEY = 'rs-appearance-v1';
  try { state.appearance = AP.normalize(JSON.parse(localStorage.getItem(APKEY) || 'null')); }
  catch (e) { state.appearance = AP.normalize(AP.defaults); }
  const apLabels = { bg: 'Фон окружения', text: 'Основной текст', muted: 'Подписи', accent: 'Акценты', route: 'Маршрут', land: 'Суша', water: 'Вода', shade: 'Подложка карты и фото', photoText: 'Текст на карте и фото', finalBg: 'Фон финала', finalText: 'Текст финала' };
  function syncAppearance() {
    const a = state.appearance; [...$('routeW').children].forEach((b) => b.classList.toggle('on', +b.dataset.v === a.routeW)); $('headingFont').value = a.heading; $('bodyFont').value = a.body;
    for (const k of AP.colorKeys) { $('ap-' + k).value = a[k]; $('hex-' + k).value = a[k]; }
    for (const b of $('palettePresets').children) { const on = b.dataset.palette === a.preset; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.querySelector('.palette-sample').style.fontFamily = AP.fonts[a.heading].family; }
    const pairs = [[a.bg,a.text,'текст'],[a.bg,a.muted,'подписи'],[a.finalBg,a.finalText,'финал'],[a.shade,a.photoText,'текст поверх фото']];
    const low = pairs.filter(([bg,fg]) => AP.contrast(bg,fg) < 4.5).map(q => q[2]);
    $('paletteContrast').textContent = low.length ? 'Низкий контраст: ' + low.join(', ') + '. Выберите более светлый текст или более тёмный фон.' : 'Текст и фон: контраст не ниже 4,5:1.';
  }
  let appearanceTimer = null;
  function saveAppearance() {
    state.appearance = AP.normalize(state.appearance);
    try { localStorage.setItem(APKEY, JSON.stringify(state.appearance)); } catch (e) { /* приватный режим: настройки работают до закрытия страницы */ }
    syncAppearance(); clearTimeout(appearanceTimer); appearanceTimer = setTimeout(() => rebuild(true), 180);
  }
  for (const id of ['headingFont','bodyFont']) {
    const select = $(id);
    for (const [key,font] of Object.entries(AP.fonts)) { if (id === 'bodyFont' && !['onest','geologica','din'].includes(key)) continue; const opt = document.createElement('option'); opt.value = key; opt.textContent = font.name; select.appendChild(opt); }
    select.onchange = () => { state.appearance[id === 'headingFont' ? 'heading' : 'body'] = select.value; saveAppearance(); };
  }
  for (const [key,palette] of Object.entries(AP.palettes)) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.palette = key;
    b.innerHTML = `<span class="palette-sample" style="background:${palette.bg};color:${palette.text};border-color:${palette.accent}">Аа <i style="background:${palette.finalBg}"></i></span><span>${palette.name}</span>`;
    b.onclick = () => { state.appearance = { ...state.appearance, ...palette, preset:key }; saveAppearance(); }; $('palettePresets').appendChild(b);
  }
  for (const k of AP.colorKeys) {
    const row = document.createElement('div'); row.className = 'palette-field';
    const label = document.createElement('label'); label.htmlFor = 'ap-' + k; label.textContent = apLabels[k]; row.appendChild(label);
    const color = document.createElement('input'); color.type = 'color'; color.id = 'ap-' + k; row.appendChild(color);
    const hex = document.createElement('input'); hex.type = 'text'; hex.id = 'hex-' + k; hex.maxLength = 7; hex.setAttribute('aria-label', apLabels[k] + ' HEX'); hex.spellcheck = false; row.appendChild(hex);
    color.oninput = () => { state.appearance[k] = color.value; state.appearance.preset = 'custom'; saveAppearance(); };
    hex.onchange = () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) { state.appearance[k] = hex.value; state.appearance.preset = 'custom'; saveAppearance(); } else { hex.value = state.appearance[k]; } };
    $('paletteFields').appendChild(row);
  }
  [...$('routeW').children].forEach((b) => { b.onclick = () => { state.appearance.routeW = +b.dataset.v; saveAppearance(); }; });
  $('appearanceReset').onclick = () => { state.appearance = AP.normalize(AP.defaults); saveAppearance(); };
  syncAppearance();

  $('iconLibrary').textContent = window.StyleIcons.familyName(state.styleId);

  /* ---- поля ---- */
  ['title', 'subtitle', 'startName', 'endName'].forEach((k) => {
    $(k).oninput = () => { state.o[k] = $(k).value; touched[k] = true; dirty = true; rebuild(true); };
  });
  $('duration').onchange = () => { state.o.duration = +$('duration').value; rebuild(); };
  $('lang').onchange = () => { state.o.lang = $('lang').value; rebuild(); };
  $('showSpeed').onchange = () => { state.o.showSpeed = $('showSpeed').checked; rebuild(); };
  $('showEle').onchange = () => { state.o.showEle = $('showEle').checked; rebuild(); };
  [...$('fmt').children].forEach((b) => (b.onclick = () => {
    state.fmt = b.dataset.v; [...$('fmt').children].forEach((x) => x.classList.toggle('on', x === b)); rebuild();
  }));

  /* ---- главная мысль и фото дня ---- */
  let photoFiles = [];   // { name, url, meta, caption, how }
  $('note').oninput = () => { state.o.note = $('note').value.trim(); state.demoNote = false; rebuild(true); };
  $('photos').onchange = async (e) => {
    const id = sourceId;
    const files = [...e.target.files].slice(0, Math.max(0, 4 - photoFiles.length));
    for (const f of files) {
      const meta = window.Exif.readExif(await f.arrayBuffer());
      if (id !== sourceId) break;
      const url = URL.createObjectURL(f);
      const ok = await new Promise((r) => { const im = new Image(); im.onload = () => r(true); im.onerror = () => r(false); im.src = url; });
      if (id !== sourceId) { URL.revokeObjectURL(url); break; }
      if (!ok) { showErr(`«${f.name}»: браузер не может открыть этот формат (часто это HEIC с iPhone). Сохраните фото как JPEG.`); URL.revokeObjectURL(url); continue; }
      photoFiles.push({ name: f.name, url, meta, caption: '', file: f });
    }
    e.target.value = '';
    placePhotos();
  };
  const photoRouteKeys = new WeakMap();
  function photoRouteKey(r) {
    if (!photoRouteKeys.has(r)) photoRouteKeys.set(r, JSON.stringify([Array.from(r.lat), Array.from(r.lon)]));
    return photoRouteKeys.get(r);
  }
  function placePhotos() {
    const r = state.route;
    if (!r) { state.o.photos = []; renderPhotos(); return; }
    const key = photoRouteKey(r);
    const placed = photoFiles.map((p, i) => { if (p.how === 'hand' && p.handKey === key && Number.isFinite(p.s) && p.s >= 0 && p.s <= r.total) return p; const pl = window.Exif.placeOnRoute(r, p.meta, i, photoFiles.length); p.how = pl.how; p.s = pl.s; return p; });
    const ev = placed.filter((p) => p.how === 'even');
    ev.forEach((p, k) => { p.s = (r.total * (k + 1)) / (ev.length + 1); });
    state.o.photos = placed.map((p) => ({ url: p.url, s: p.s, caption: p.caption, credit: p.credit || '' }));
    renderPhotos(); rebuild(true);
  }
  function renderPhotos() {
    const box = $('photoList'); box.innerHTML = ''; setTimeout(drawPmap, 0);
    const how = { gps: 'по GPS из фото', time: 'по времени съёмки', even: 'по порядку', hand: 'вручную' };
    photoFiles.forEach((p, i) => {
      const row = document.createElement('div'); row.className = 'phrow';
      const img = document.createElement('img'); img.src = p.url; img.alt = '';
      const mid = document.createElement('div');
      const inp = document.createElement('input'); inp.placeholder = 'Подпись (необязательно)'; inp.maxLength = 40; inp.value = p.caption;
      inp.setAttribute('aria-label', `Подпись к фото ${i + 1}`);
      inp.oninput = () => { p.caption = inp.value; state.o.photos[i] && (state.o.photos[i].caption = inp.value); rebuild(true); };
      const sm = document.createElement('small'); sm.textContent = state.route && p.s != null ? `${how[p.how] || ''} · ${(p.s / 1000).toFixed(1)} км` : '';
      mid.append(inp, sm);
      const del = document.createElement('button'); del.textContent = '×'; del.title = 'Убрать фото';
      del.setAttribute('aria-label', `Убрать фото ${i + 1}`); del.replaceChildren(window.UIIcons.icon('close'));
      del.onclick = () => { URL.revokeObjectURL(p.url); photoFiles.splice(i, 1); placePhotos(); };
      row.append(img, mid, del); box.appendChild(row);
    });
    renderPhotoPositions();
  }
  function renderPhotoPositions() {
    let box = $('photoPositions');
    if (!box) { box = document.createElement('div'); box.id = 'photoPositions'; $('pmapBox').appendChild(box); }
    box.replaceChildren(); if (!state.route) return;
    photoFiles.forEach((p, i) => {
      const label = document.createElement('label'); label.className = 'photo-position'; label.textContent = `Место фото ${i + 1} на маршруте`;
      const range = document.createElement('input'); range.type = 'range'; range.id = `photo-position-${i}`; range.min = 0; range.max = 100; range.step = .1; range.value = 100 * (p.s || 0) / state.route.total;
      range.setAttribute('aria-label', label.textContent);
      const value = document.createElement('output'), sync = () => { value.textContent = `${((p.s || 0) / 1000).toFixed(1)} км`; range.setAttribute('aria-valuetext', value.textContent); }; sync();
      range.oninput = () => { p.s = state.route.total * +range.value / 100; p.how = 'hand'; p.handKey = photoRouteKey(state.route); state.o.photos[i].s = p.s; sync(); const sm = $('photoList').querySelectorAll('small')[i]; if (sm) sm.textContent = `вручную · ${value.textContent}`; drawPmap(); rebuild(true); };
      label.append(range,value); box.appendChild(label);
    });
  }

  /* ---- короткий фрагмент или вся дорога ---- */
  state.kind = 'short';
  function setKind(k) { state.kind = k; [...$('kind').children].forEach((b) => b.classList.toggle('on', b.dataset.v === k)); }
  [...$('kind').children].forEach((b) => (b.onclick = () => { setKind(b.dataset.v); t = 0; rebuild(); }));

  /* ---- заметки на маршруте: текст + место на пути (доля 0…1) ---- */
  state.o.tnotes = [];
  function kmAt(f) { const R = state.route; return R ? ((R.total * f) / 1000).toFixed(R.total < 20000 ? 1 : 0).replace('.', ',') + ' км' : Math.round(f * 100) + '% пути'; }
  function renderNotes() {
    const box = $('tnotes'); box.innerHTML = '';
    state.o.tnotes.forEach((n, i) => {
      const row = document.createElement('div'); row.className = 'tnote';
      const inp = document.createElement('input'); inp.maxLength = 40; inp.placeholder = ['Например: тут сломалась спица', 'Например: самый красивый перевал', 'Например: ночёвка у реки'][i % 3]; inp.value = n.text;
      inp.setAttribute('aria-label', `Текст заметки ${i + 1}`);
      inp.oninput = () => { n.text = inp.value; rebuild(true); };
      const rg = document.createElement('input'); rg.type = 'range'; rg.min = 3; rg.max = 97; rg.value = Math.round(n.f * 100); rg.setAttribute('aria-label', 'Место на маршруте');
      const lab = document.createElement('small'); lab.textContent = 'на ' + kmAt(n.f);
      rg.oninput = () => { n.f = rg.value / 100; lab.textContent = 'на ' + kmAt(n.f); };
      rg.onchange = () => rebuild(true);
      const del = document.createElement('button'); del.textContent = '×'; del.title = 'Убрать заметку'; del.onclick = () => { state.o.tnotes.splice(i, 1); renderNotes(); rebuild(true); };
      const mid = document.createElement('div'); mid.append(inp, rg, lab); row.append(mid, del); box.appendChild(row);
    });
    $('addNote').hidden = state.o.tnotes.length >= 3;
  }
  $('addNote').onclick = () => { const k = state.o.tnotes.length; state.o.tnotes.push({ text: '', f: [0.3, 0.6, 0.85][k] || 0.5 }); renderNotes(); const ins = $('tnotes').querySelectorAll('input:not([type])'); if (ins.length) ins[ins.length - 1].focus(); };
  renderNotes();

  /* ---- карта фото: отметки можно перетащить вдоль трека ---- */
  let pmapGeo = null, dragPin = -1;
  function drawPmap() {
    const R = state.route, cv = $('pmap'), box = $('pmapBox');
    box.hidden = !R || !photoFiles.length; if (box.hidden) return;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, pad = 28;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const kx = Math.cos(((R.lat[0] || 0) * Math.PI) / 180);
    for (let i = 0; i < R.n; i++) { const x = R.lon[i] * kx, y = -R.lat[i]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const sc = Math.min((W - 2 * pad) / Math.max(1e-9, x1 - x0), (H - 2 * pad) / Math.max(1e-9, y1 - y0)), ox = (W - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2;
    const P = (i) => [ox + (R.lon[i] * kx - x0) * sc, oy + (-R.lat[i] - y0) * sc];
    const step = Math.max(1, Math.floor(R.n / 1500)), pts = []; for (let i = 0; i < R.n; i += step) pts.push([i, ...P(i)]); pts.push([R.n - 1, ...P(R.n - 1)]);
    pmapGeo = { pts };
    g.clearRect(0, 0, W, H); g.fillStyle = '#efe9dc'; g.fillRect(0, 0, W, H);
    g.lineJoin = g.lineCap = 'round'; g.strokeStyle = '#b23a1f'; g.lineWidth = 4; g.beginPath(); pts.forEach(([, x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    const [sx, sy] = P(0), [ex, ey] = P(R.n - 1); g.fillStyle = '#fff'; g.strokeStyle = '#b23a1f'; g.lineWidth = 3; [[sx, sy], [ex, ey]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 6, 0, 6.2832); g.fill(); g.stroke(); });
    photoFiles.forEach((p, k) => {
      if (p.s == null) return; let best = pts[0]; for (const q of pts) if (Math.abs(R.D[q[0]] - p.s) < Math.abs(R.D[best[0]] - p.s)) best = q;
      p._xy = [best[1], best[2]]; const im = p._img || (p._img = Object.assign(new Image(), { src: p.url, onload: drawPmap }));
      g.save(); g.translate(best[1], best[2]); g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 8; g.fillRect(-26, -64, 52, 52); g.shadowColor = 'transparent';
      if (im.complete && im.naturalWidth) { const s2 = Math.max(46 / im.naturalWidth, 46 / im.naturalHeight); g.save(); g.beginPath(); g.rect(-23, -61, 46, 46); g.clip(); g.drawImage(im, -im.naturalWidth * s2 / 2, -38 - im.naturalHeight * s2 / 2, im.naturalWidth * s2, im.naturalHeight * s2); g.restore(); }
      g.beginPath(); g.moveTo(-8, -12); g.lineTo(8, -12); g.lineTo(0, 0); g.closePath(); g.fill();
      g.fillStyle = '#b23a1f'; g.font = '700 14px system-ui'; g.textAlign = 'center'; g.fillText(String(k + 1), 0, -68); g.restore();
    });
  }
  const pmapPt = (e) => { const cv = $('pmap'), r = cv.getBoundingClientRect(); return [((e.clientX - r.left) * cv.width) / r.width, ((e.clientY - r.top) * cv.height) / r.height]; };
  $('pmap').addEventListener('pointerdown', (e) => {
    const [x, y] = pmapPt(e); let best = -1, bd = 40;
    photoFiles.forEach((p, k) => { if (!p._xy) return; const d = Math.hypot(p._xy[0] - x, p._xy[1] - 38 - y); if (d < bd) { bd = d; best = k; } });
    if (best >= 0) { dragPin = best; $('pmap').setPointerCapture(e.pointerId); e.preventDefault(); }
  });
  $('pmap').addEventListener('pointermove', (e) => {
    if (dragPin < 0 || !pmapGeo) return; const [x, y] = pmapPt(e); let best = pmapGeo.pts[0], bd = Infinity;
    for (const q of pmapGeo.pts) { const d = (q[1] - x) ** 2 + (q[2] - y) ** 2; if (d < bd) { bd = d; best = q; } }
    const p = photoFiles[dragPin]; p.s = state.route.D[best[0]]; p.how = 'hand'; p.handKey = photoRouteKey(state.route); drawPmap();
  });
  const pmapUp = () => { if (dragPin < 0) return; dragPin = -1; state.o.photos = photoFiles.map((p) => ({ url: p.url, s: p.s, caption: p.caption, credit: p.credit || '' })); renderPhotos(); rebuild(true); };
  window.__pmapPins = () => photoFiles.map((q) => q._xy || null);   // для проверки перетаскивания
  $('pmap').addEventListener('pointerup', pmapUp); $('pmap').addEventListener('pointercancel', pmapUp);

  /* ---- настроение: три места для стикеров (обложка, прибытие, финал) ---- */
  $('legacyStickerControls').hidden = !window.StyleIcons.legacyEnabled;
  const STK = [...['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((n) => 'sticker/' + n), ...['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((n) => 'icon/' + n), ...['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((n) => 'sign/' + n)];
  const MOODS = [
    { name: 'Как в стиле', set: [null, null, null] },
    { name: 'Поход', set: ['sticker/05', 'sign/02', 'icon/11'] },
    { name: 'Дорога', set: ['sticker/10', 'sign/09', 'sticker/01'] },
    { name: 'Горы', set: ['sticker/06', 'sign/10', 'icon/08'] },
    { name: 'Кругосветка', set: ['sticker/11', 'sticker/02', 'sticker/03'] },
    { name: 'Фотоохота', set: ['sticker/07', 'icon/02', 'sticker/12'] },
  ];
  const SLOT_NAMES = ['Обложка', 'Прибытие', 'Финал'];
  state.o.stickers = [null, null, null]; let slotOn = 0;
  const stkUrl = (id) => 'art/pack/' + id + '.webp';
  function renderMood() {
    if (!window.StyleIcons.legacyEnabled) return; // интерфейс и загрузка прежних стикеров выключены
    $('moods').innerHTML = ''; MOODS.forEach((m) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = m.name; b.classList.toggle('on', m.set.every((x, i) => x === state.o.stickers[i])); b.onclick = () => { state.o.stickers = [...m.set]; renderMood(); rebuild(true); }; $('moods').appendChild(b); });
    $('slots').innerHTML = ''; SLOT_NAMES.forEach((nm, i) => {
      const b = document.createElement('button'); b.className = 'slot' + (i === slotOn ? ' on' : ''); const id = state.o.stickers[i];
      b.innerHTML = (id ? `<img src="${stkUrl(id)}" alt="">` : '<i>—</i>') + `<span>${nm}</span>`; b.title = 'Выбрать стикер для: ' + nm;
      b.onclick = () => { if (slotOn === i && id) { state.o.stickers[i] = null; renderMood(); rebuild(true); return; } slotOn = i; renderMood(); };   // повторное нажатие убирает стикер
      $('slots').appendChild(b);
    });
    if (!$('stk').children.length) STK.forEach((id) => { const b = document.createElement('button'); b.dataset.id = id; b.innerHTML = `<img src="${stkUrl(id)}" alt="" loading="lazy">`; b.onclick = () => { state.o.stickers[slotOn] = id; slotOn = Math.min(2, slotOn + 1); renderMood(); rebuild(true); }; $('stk').appendChild(b); });
    [...$('stk').children].forEach((b) => b.classList.toggle('on', state.o.stickers.includes(b.dataset.id)));
  }
  renderMood();

  /* ---- что показывать в ролике ---- */
  const SHOWS = [['photos', 'Фото'], ['phrase', 'Главная фраза'], ['notes', 'Заметки на маршруте'], ['places', 'Города по пути'], ['weather', 'Погода'], ['ele', 'Высота и профиль'], ['time', 'Время в пути'], ['flags', 'Флаг страны'], ['stickers', 'Стикеры'], ['relief', '3D-рельеф вместо плоской карты']];
  state.show = Object.fromEntries(SHOWS.map(([k]) => [k, k !== 'relief'])); state.relief = false;   // по умолчанию плоская карта; 3D-рельеф — по галочке
  state.mapZoom = 1;
  $('mapZoom').onchange = () => { state.mapZoom = +$('mapZoom').value; t = 0; rebuild(); };
  SHOWS.forEach(([k, nm]) => {
    const l = document.createElement('label'); l.className = 'c'; const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = k !== 'relief'; cb.dataset.k = k;
    cb.onchange = () => { state.show[k] = cb.checked; state.relief = state.show.relief; t = 0; rebuild(); };
    l.append(cb, document.createTextNode(nm)); if (k === 'stickers' && !window.StyleIcons.legacyEnabled) l.hidden = true; (k === 'relief' ? $('mapSettings') : $('shows')).appendChild(l);
  });

  /* ---- свои надписи и логотип: хранятся в браузере, попадают в предпросмотр и в MP4 ---- */
  const LABEL_DEFS = [['дистанция', 'Обложка: километры'], ['в пути', 'Время в пути'], ['набор высоты', 'Набор высоты'], ['высшая точка', 'Высшая точка'], ['пройдено', 'Во время движения'], ['день', 'Слово «день»'], ['погода в тот день', 'Погода'], ['за день', 'За день'], ['путь до сегодня', 'Путь до сегодня'], ['прибытие', 'Прибытие'], ['веха', 'Веха'], ['новая глава', 'Новая глава'], ['круг замкнулся', 'Круг замкнулся'], ['всего за путешествие', 'Итог: всего'], ['пройдено за день', 'Итог дня'], ['история пути', 'Шапка серии'], ['route story', 'Имя в шапке, если не задано']];
  try { state.labels = JSON.parse(localStorage.getItem('rs-labels-v1') || '{}') || {}; } catch (e) { state.labels = {}; }
  try { state.logo = JSON.parse(localStorage.getItem('rs-logo-v1') || 'null'); } catch (e) { state.logo = null; }
  let customTimer = null;
  function saveCustom() {
    try { localStorage.setItem('rs-labels-v1', JSON.stringify(state.labels)); localStorage.setItem('rs-logo-v1', JSON.stringify(state.logo)); } catch (e) { /* приватный режим: работает до закрытия */ }
    clearTimeout(customTimer); customTimer = setTimeout(() => rebuild(true), 200);
  }
  LABEL_DEFS.forEach(([k, nm]) => {
    const row = document.createElement('label'); row.className = 'lrow'; const sp = document.createElement('span'); sp.textContent = nm;
    const inp = document.createElement('input'); inp.placeholder = k; inp.maxLength = 28; inp.dataset.k = k; inp.value = state.labels[k] || '';
    inp.oninput = () => { if (inp.value.trim()) state.labels[k] = inp.value.trim(); else delete state.labels[k]; saveCustom(); };
    row.append(sp, inp); $('labelsGrid').appendChild(row);
  });
  $('labelsReset').onclick = () => { state.labels = {}; [...$('labelsGrid').querySelectorAll('input')].forEach((i) => { i.value = ''; }); saveCustom(); };
  function syncLogo() { const L = state.logo; $('logoPrev').hidden = !L; if (L) $('logoPrev').src = L.url; $('logoClear').hidden = !L; [...$('logoWhere').children].forEach((b) => b.classList.toggle('on', !!L && b.dataset.v === L.where)); }
  $('logoFile').onchange = (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 640 / Math.max(im.width, im.height, 1)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        state.logo = { url: c.toDataURL(f.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.92), where: (state.logo && state.logo.where) || 'header' }; syncLogo(); saveCustom();
      };
      im.onerror = () => showErr('Не удалось прочитать картинку логотипа.'); im.src = rd.result;
    };
    rd.readAsDataURL(f);
  };
  [...$('logoWhere').children].forEach((b) => { b.onclick = () => { if (!state.logo) return; state.logo.where = b.dataset.v; syncLogo(); saveCustom(); }; });
  $('logoClear').onclick = () => { state.logo = null; syncLogo(); saveCustom(); };
  syncLogo();

  /* ---- перенос оформления одним файлом; маршрут и фото остаются отдельно ---- */
  $('settingsSave').onclick = () => {
    const data = { format: 'route-story-settings', version: 1, appearance: AP.normalize(state.appearance), labels: state.labels, logo: state.logo, styleId: state.styleId, relief: state.relief, show: state.show };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), a = document.createElement('a');
    a.href = url; a.download = 'route-story-settings.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('settingsStatus').textContent = 'Файл настроек сохранён. Его можно загрузить в другом браузере.';
  };
  async function readSettings(data) {
    const obj = v => !!v && typeof v === 'object' && !Array.isArray(v);
    if (!obj(data) || data.format !== 'route-story-settings' || data.version !== 1 || !obj(data.appearance) || !obj(data.labels) || !obj(data.show) || typeof data.styleId !== 'string' || !Object.hasOwn(STYLES, data.styleId) || typeof data.relief !== 'boolean') throw new Error('Выберите файл настроек Route Story поддерживаемой версии.');
    const labels = {}, show = {};
    for (const [k] of LABEL_DEFS) if (Object.hasOwn(data.labels, k)) {
      if (typeof data.labels[k] !== 'string') throw new Error('В файле повреждены надписи.');
      const v = data.labels[k].trim().slice(0, 28); if (v) labels[k] = v;
    }
    for (const [k] of SHOWS) {
      if (Object.hasOwn(data.show, k) && typeof data.show[k] !== 'boolean') throw new Error('В файле повреждены настройки показа.');
      show[k] = Object.hasOwn(data.show, k) ? data.show[k] : k !== 'relief';
    }
    show.relief = data.relief;
    let logo = null;
    if (data.logo !== null) {
      if (!obj(data.logo) || typeof data.logo.url !== 'string' || data.logo.url.length > 3 * 1024 * 1024 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(data.logo.url) || !['header', 'ends', 'both'].includes(data.logo.where)) throw new Error('В файле повреждён логотип.');
      await new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(); im.onerror = () => reject(new Error('Не удалось прочитать логотип из файла.')); im.src = data.logo.url; });
      logo = { url: data.logo.url, where: data.logo.where };
    }
    return { appearance: AP.normalize(data.appearance), labels, logo, styleId: data.styleId, relief: data.relief, show };
  }
  $('settingsLoad').onclick = () => $('settingsFile').click();
  $('settingsFile').onchange = async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    $('settingsStatus').textContent = 'Загружаю настройки…';
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error('Файл слишком большой. Выберите файл настроек до 4 МБ.');
      let data;
      try { data = JSON.parse((await file.text()).replace(/^\uFEFF/, '')); } catch (err) { throw new Error('Не удалось прочитать файл. Выберите сохранённый файл настроек Route Story.'); }
      const settings = await readSettings(data);   // до полной проверки текущие настройки не меняем
      Object.assign(state, settings);
      [...$('styles').children].forEach(b => b.classList.toggle('on', b.dataset.id === state.styleId));
      $('iconLibrary').textContent = window.StyleIcons.familyName(state.styleId);
      [...$('labelsGrid').querySelectorAll('input')].forEach(i => { i.value = state.labels[i.dataset.k] || ''; });
      [...document.querySelectorAll('#shows input,#mapSettings input')].forEach(i => { i.checked = state.show[i.dataset.k]; });
      $('relief').value = state.relief ? 'on' : 'off';
      syncLogo(); saveAppearance(); saveCustom(); clearTimeout(appearanceTimer); clearTimeout(customTimer); t = 0; rebuild();
      $('settingsStatus').textContent = 'Настройки загружены.';
    } catch (err) { $('settingsStatus').textContent = 'Не удалось загрузить настройки. ' + err.message; }
  };

  /* ---- экраны ролика: скрыть необязательные, сделать любой дольше или короче ---- */
  const RN = { 'day-card': 'Обложка', 'trip-title': 'Обложка', 'season-card': 'Обложка', 'progress-overview': 'Путь до сегодня', 'overview-to-detail': 'Переход к дню', 'route-reveal': 'Дорога', 'camera-follow': 'Дорога', 'elevation-profile': 'Профиль высот', 'weather-card': 'Погода', 'time-on-road': 'Время в пути', 'high-point': 'Высшая точка', 'distance-counter': 'Километры', 'checkpoint-arrival': 'Прибытие', 'photo-reveal': 'Фото', 'note-card': 'Заметка', 'highlights-reel': 'Фото пути', 'pullback': 'Финал', 'progress-poster': 'Финал', 'journey-recap': 'Вехи пути', 'day-summary': 'Итог дня' };
  const LOCKED = new Set(['day-card', 'trip-title', 'season-card', 'progress-overview', 'overview-to-detail', 'route-reveal', 'camera-follow', 'pullback', 'progress-poster', 'journey-recap', 'day-summary']);
  state.edits = { off: {}, dur: {} };
  state.videoLength = 0;
  $('videoLength').onchange = () => { state.videoLength=+$('videoLength').value; t=0; rebuild(); };
  function applyEdits(plan) {
    const E = state.edits; state.fullBeats = plan.beats;
    let t = 0; const beats = plan.beats.filter((b) => !E.off[b.recipe] || LOCKED.has(b.recipe)).map((b) => { const d = Math.max(1.5, Math.min(15, b.durationSec + (E.dur[b.recipe] || 0))); const o = { ...b, startSec: Math.round(t * 100) / 100, durationSec: Math.round(d * 100) / 100 }; t += d; return o; });
    return { ...plan, beats, durationSec: Math.round(t * 100) / 100 };
  }
  function renderScreens() {
    const box = $('screens'); if (!box) return; box.innerHTML = ''; const E = state.edits;
    (state.fullBeats || []).forEach((b) => {
      const off = !!E.off[b.recipe] && !LOCKED.has(b.recipe), d = Math.max(1.5, Math.min(15, b.durationSec + (E.dur[b.recipe] || 0)));
      const row = document.createElement('div'); row.className = 'srow' + (off ? ' off' : '');
      const name = document.createElement('span'); name.textContent = RN[b.recipe] || b.recipe;
      const shown=state.lastEp?.res.plan.beats.find(x=>x.recipe===b.recipe);
      const time = document.createElement('small'); time.textContent = off ? 'скрыт' : (state.videoLength&&shown?shown.durationSec:d).toFixed(1).replace('.', ',') + ' с';
      const mk = (txt, title, fn, dis) => { const x = document.createElement('button'); x.type = 'button'; x.className = 'ghost'; x.textContent = txt; x.title = title; x.disabled = !!dis; x.onclick = () => { fn(); t = 0; rebuild(); }; return x; };
      row.append(name, time, mk('−', 'Короче на 0,5 с', () => { E.dur[b.recipe] = (E.dur[b.recipe] || 0) - 0.5; }, off || d <= 1.5 || !!state.videoLength), mk('+', 'Дольше на 0,5 с', () => { E.dur[b.recipe] = (E.dur[b.recipe] || 0) + 0.5; }, off || d >= 15 || !!state.videoLength));
      if (!LOCKED.has(b.recipe)) row.append(mk(off ? 'Вернуть' : 'Скрыть', off ? 'Показать экран' : 'Убрать экран из ролика', () => { E.off[b.recipe] = !off; }));
      box.appendChild(row);
    });
  }

  /* ---- шаги под роликом ---- */
  function showTab(id) { [...$('tabs').children].forEach((b) => { b.classList.toggle('on', b.dataset.t === id); b.setAttribute('aria-current', b.dataset.t === id ? 'step' : 'false'); }); ['route', 'text', 'photo', 'look'].forEach((k) => { $('t-' + k).hidden = k !== id; }); if (id === 'photo') drawPmap(); if (id === 'look' && matchMedia('(max-width:999px)').matches) $('tabs').scrollIntoView({ block: 'start' }); }
  [...$('tabs').children].forEach((b) => (b.onclick = () => showTab(b.dataset.t)));

  /* ---- загрузка ---- */
  const drop = $('drop');
  $('file').onchange = (e) => { if (e.target.files.length) handleFiles([...e.target.files]); e.target.value = ''; };
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => e.dataTransfer.files.length && handleFiles([...e.dataTransfer.files]));
  $('demo').onclick = async () => {
    const id = ++sourceId;
    try {
      const r = await fetch('samples/samarkand-bukhara.gpx');
      const tx = await r.text(); if (id !== sourceId) return;
      loadText(tx, 'samarkand-bukhara.gpx'); state.routeIsDemo = true;
    } catch (e) { if (id === sourceId) showErr('Не удалось загрузить демо: ' + e.message); }
  };
  function readFile(f) { const id = sourceId; f.text().then((tx) => { if (id === sourceId) loadText(tx, f.name); }).catch((e) => { if (id === sourceId) showErr(e.message); }); }

  function showErr(m) { $('err').textContent = m; $('err').hidden = !m; }

  /* обрезка трека: доли длины с начала и с конца; новый файл сбрасывает, ползунок пересобирает тот же файл */
  state.trim = { a: 0, b: 0, c: 0, d: 0, s: 0 };
  function trimPts(pts) {
    const hav = window.RouteLib.hav, cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + hav(pts[i - 1], pts[i]));
    const D = cum[cum.length - 1] || 1, T = state.trim, lo = (T.a / 100) * D, hi = D - (T.b / 100) * D, cl = (T.c / 100) * D, ch = (T.d / 100) * D, cut = T.d > T.c;
    state.rawTotal = D;
    const out = pts.filter((_, i) => cum[i] >= lo && cum[i] <= hi && !(cut && cum[i] > cl && cum[i] < ch));
    if (cut) {   // вырезанный участок: после него новый отрезок — на карте разрыв, километры через него не считаются
       const idx = pts.map((q, i) => i).filter((i) => cum[i] >= lo && cum[i] <= hi && !(cum[i] > cl && cum[i] < ch)); idx.forEach((i) => { if (cum[i] >= ch) pts[i].seg = (pts[i].seg || 0) + 100000; });
    }
    let res = out.length >= 2 ? out : pts;
    if (T.s > 0) {   // сглаживание дрожания GPS: скользящее среднее внутри отрезка, концы отрезков на месте
      const w = T.s * 2, sm = res.map((q) => ({ ...q })); let st = 0;
      for (let i = 1; i <= res.length; i++) {
        if (i < res.length && res[i].seg === res[st].seg) continue;
        for (let j = st + 1; j < i - 1; j++) { let la = 0, lo = 0, n = 0; for (let k = Math.max(st, j - w); k <= Math.min(i - 1, j + w); k++) { la += res[k].lat; lo += res[k].lon; n++; } sm[j].lat = la / n; sm[j].lon = lo / n; }
        st = i;
      }
      res = sm;
    }
    return res;
  }
  function syncTrim() {
    const D = (state.rawTotal || 0) / 1000, T = state.trim, km1 = (v) => v.toFixed(1).replace('.', ',') + ' км'; ['A', 'B', 'C', 'D'].forEach((k) => { $('trim' + k).value = T[k.toLowerCase()]; });
    $('trimAo').textContent = km1(D * T.a / 100); $('trimBo').textContent = km1(D * T.b / 100);
    $('trimS').value = T.s; $('trimSo').textContent = ['нет', 'слабо', 'средне', 'сильно'][T.s];
    $('trimCo').textContent = T.d > T.c ? km1(D * T.c / 100) : '—'; $('trimDo').textContent = T.d > T.c ? km1(D * T.d / 100) + ' · вырезано ' + km1(D * (T.d - T.c) / 100) : '—';
  }
  let trimTimer = null;
  ['trimA', 'trimB', 'trimC', 'trimD', 'trimS'].forEach((id) => { $(id).oninput = () => { state.trim.s = +$('trimS').value; state.trim.a = +$('trimA').value; state.trim.b = +$('trimB').value; state.trim.c = +$('trimC').value; state.trim.d = +$('trimD').value; if (state.trim.a + state.trim.b > 90) { if (id === 'trimA') state.trim.a = 90 - state.trim.b; else state.trim.b = 90 - state.trim.a; } syncTrim(); clearTimeout(trimTimer); trimTimer = setTimeout(() => { if (state.mode === 'track' && state.rawText) loadText(state.rawText, state.rawName, true); else if (state.pre) { const q = state.pre; state.seriesBase = q.base; state.route = q.route; state.routeIsDemo = q.routeIsDemo; state.demoDay = q.demoDay; handleFiles(q.files, q.glue, true); } }, 250); }; });
  function loadText(text, filename, keepTrim) {
    showErr(''); if (!keepTrim) { state.trim = { a: 0, b: 0, c: 0, d: 0, s: 0 }; state.rawText = filename === 'day47.gpx' ? null : text; state.rawName = filename; state.pre = null; }
    try {
      if (text.trimStart().startsWith('{')) { const j = JSON.parse(text); if (Array.isArray(j.stops) && j.stops.length > 1 && j.stops[0].lat != null) { loadJourney(j); return; } }
      const parsed = parseAny(text, filename);
      parsed.pts = trimPts(parsed.pts);
      const route = prepare(parsed, filename.replace(/\.[^.]+$/, ''));
      $('trimBox').hidden = filename === 'day47.gpx' && state.demoDay; syncTrim();
      if (filename !== 'day47.gpx' && state.demoDay) {   // свой трек вместо демо-дня: убираем демо-фото, демо-заметку и демо-место
        photoFiles = photoFiles.filter((p) => !p.demo);
        if (state.demoNote) { state.o.note = ''; $('note').value = ''; state.demoNote = false; }
        state.demoDay = false;
      }
      state.route = route;
      state.routeIsDemo = false;   // демо-трек помечает только кнопка «демо-трек», не имя файла
      const km = route.total / 1000;
      $('info').hidden = false;
      $('info').innerHTML =
        `<span><b>${route.name}</b></span>` +
        `<span>Длина: <b>${km.toFixed(1)} км</b> · точек: ${route.n}</span>` +
        `<span>Время: <b>${route.t ? 'есть' : 'нет'}</b> · высота: <b>${route.ele ? 'есть' : 'нет'}</b></span>`;
      if (!touched.title) { state.o.title = route.name.replace(/\(.*?\)/g, '').trim(); $('title').value = state.o.title; }
      if (!touched.subtitle) { state.o.subtitle = ''; $('subtitle').value = ''; }
      if (!touched.startName) { state.o.startName = ''; $('startName').value = ''; }
      if (!touched.endName) { state.o.endName = ''; $('endName').value = ''; }
      $('showSpeed').disabled = !route.speed; $('noSpeed').textContent = route.speed ? '' : '(в файле нет времени)';
      $('showEle').disabled = !route.ele; $('noEle').textContent = route.ele ? '' : '(в файле нет высоты)';
      state.o.showSpeed = !!route.speed && $('showSpeed').checked; state.o.showEle = !!route.ele && $('showEle').checked;
      refreshModes();
      if (state.mode === 'journey') state.mode = 'both';
      setMode(state.mode === 'series' && state.seriesBase ? 'series' : state.journeyData && state.mode !== 'series' ? state.mode : 'track'); play(true);
      state.o.places = []; renderPlaces();
      placePhotos();
      geocode(route);
    } catch (e) { showErr(e.message || String(e)); }
  }

  /* города старта/финиша — необязательная подсказка (OpenStreetMap Nominatim) */
  async function geocode(route) {
    const one = async (i) => {
      const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=${state.o.lang}&lat=${route.lat[i]}&lon=${route.lon[i]}`;
      const j = await (await fetch(u)).json(); const a = j.address || {};
      // населённый пункт важнее района: «Листвянка», а не «Иркутский муниципальный округ»
      const adm = [a.municipality, a.county, a.state].find((x) => x && !/поселение|округ|район|область|край|municipal|district|county/i.test(x)) || '';   // «Селецкое сельское поселение» в титр не годится
      return { place: a.city || a.town || a.village || a.hamlet || a.suburb || adm, country: a.country || '' };
    };
    if (route.t && !(route.meta && route.meta.weather)) {
      let done; weatherJob = new Promise((r) => { done = r; });
      weatherFor(route).catch(() => null).then((w) => { done(); weatherJob = null; if (w && state.route === route) { route.meta = { ...(route.meta || {}), weather: w }; syncDayMeta(route); rebuild(true); } });
    }
    try {
      const blank = { place: '', country: '' }, [a, b] = await Promise.all([one(0).catch(() => blank), one(route.n - 1).catch(() => blank)]);
      if (state.route !== route) return;
      if (!touched.startName && a.place) { state.o.startName = a.place; $('startName').value = a.place; }
      if (!touched.endName && !state.demoDay && b.place) { state.o.endName = b.place; $('endName').value = b.place; if (isOwn()) { state.seriesBase = ownToday().J; saveOwn(); } }
      if (!touched.subtitle) {
        const s = a.country && a.country === b.country ? a.country : [a.country, b.country].filter(Boolean).join(' → ');
        state.o.subtitle = s; $('subtitle').value = s;
      }
      route.meta = { ...(route.meta || {}), from: state.demoDay ? null : a.place || null, country: b.country || a.country || null };
      syncDayMeta(route); rebuild(true);
      // серия: места по пути — одним запросом; режиссёр сам выберет до трёх самых значимых
      if (state.mode === 'series') {
        if (state.demoDay) return;
        let done; placesJob = new Promise((r) => { done = r; });
        const wps = await waypointsFor(route, state.o.lang).catch(() => []);
        done(); placesJob = null;
        if (state.route !== route) return;
        route.meta = { ...route.meta, waypoints: wps };
        // адресный сервис не назвал старт или финиш — берём ближайший город из карты
        if (!state.demoDay) { if (!route.meta.from) route.meta.from = nearName(route, 0) || null; if (!state.o.endName && !touched.endName) { const nm = nearName(route, 1); if (nm) { state.o.endName = nm; $('endName').value = nm; if (isOwn()) { state.seriesBase = ownToday().J; saveOwn(); } } } }
        syncDayMeta(route); rebuild(true);
        return;
      }
      // подписи мест по пути: 6 точек между стартом и финишем, не чаще 1 запроса в секунду
      const found = [];
      for (const f of [0.14, 0.28, 0.42, 0.56, 0.7, 0.84]) {
        if (state.route !== route) return;
        const s = f * route.total, a = window.RouteLib.at(route, s);
        try {
          const name = await placeNear(route.lat[a.i], route.lon[a.i], state.o.lang);
          if (name && ![state.o.startName, state.o.endName, ...found.map((x) => x.name)].includes(name)) found.push({ s, name });
          if (state.route === route && !touchedPlaces) { state.o.places = found.slice(); renderPlaces(); rebuild(true); }
        } catch (e) { /* пропускаем точку */ }
        await new Promise((r) => setTimeout(r, 1100));
      }
    } catch (e) { /* без сети просто остаются пустые поля */ }
  }
  let placesJob = null;   // идёт поиск мест по пути — экспорт его дождётся
  let weatherJob = null;  // идёт запрос погоды дня — экспорт его дождётся
  /* Погода того дня по времени и координатам трека (Open-Meteo: архив ERA5, для свежих дат — прогнозная модель).
     Ничего не выдумываем: нет времени в файле или сервис молчит — погоды в ролике нет. */
  async function weatherFor(route) {
    if (!route.t) return null;
    const t0 = route.t[0], t1 = route.t[route.n - 1]; if (!(t1 > t0)) return null;
    const mid = window.RouteLib.at(route, route.total / 2), lat = route.lat[mid.i], lon = route.lon[mid.i];
    const day = (ms) => new Date(ms).toISOString().slice(0, 10), today = day(Date.now());
    const d0 = day(t0 - 432e5), d1raw = day(t1 + 432e5), d1 = d1raw > today ? today : d1raw;
    if (d0 > today) return null;
    const qs = `latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&start_date=${d0}&end_date=${d1}&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code&daily=sunrise,sunset&wind_speed_unit=ms&timeformat=unixtime&timezone=auto`;
    const bearingAt = (ms) => {
      let lo = 0, hi = route.n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (route.t[m] <= ms) lo = m; else hi = m; }
      let j = lo; while (j < route.n - 1 && route.D[j] - route.D[lo] < 1500) j++;
      if (j === lo) { while (lo > 0 && route.D[j] - route.D[lo] < 1500) lo--; }
      if (route.D[j] - route.D[lo] < 200) return null;
      const f1 = (route.lat[lo] * Math.PI) / 180, f2 = (route.lat[j] * Math.PI) / 180, dl = ((route.lon[j] - route.lon[lo]) * Math.PI) / 180;
      return Math.atan2(Math.sin(dl) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl));
    };
    const read = (j) => {
      const H = j.hourly; if (!H || !H.time) return null;
      let n = 0, tMin = Infinity, tMax = -Infinity, ws = 0, hs = 0, hn = 0, sx = 0, sy = 0, pr = 0, code = 0;
      H.time.forEach((sec, i) => {
        const ms = sec * 1000; if (ms < t0 - 18e5 || ms > t1 + 18e5) return;
        const T = H.temperature_2m[i], Wv = H.wind_speed_10m[i], Wd = H.wind_direction_10m[i]; if (T == null || Wv == null || Wd == null) return;
        n++; tMin = Math.min(tMin, T); tMax = Math.max(tMax, T); ws += Wv; pr += H.precipitation[i] || 0; code = Math.max(code, H.weather_code[i] || 0);
        const wr = (Wd * Math.PI) / 180; sx += Wv * Math.sin(wr); sy += Wv * Math.cos(wr);
        const b = bearingAt(Math.min(Math.max(ms, t0), t1)); if (b != null) { hs += Wv * Math.cos(wr - b); hn++; }   // «откуда дует» совпало с «куда едем» — ветер в лицо
      });
      if (!n) return null;
      const off = j.utc_offset_seconds || 0, locDay = day(t0 + off * 1000), D = j.daily || {};
      let sunrise = null, sunset = null;
      (D.time || []).forEach((sec, i) => { if (day(sec * 1000 + off * 1000) === locDay && D.sunrise[i] && D.sunset[i]) { sunrise = (((D.sunrise[i] + off) % 86400) + 86400) % 86400 / 3600; sunset = (((D.sunset[i] + off) % 86400) + 86400) % 86400 / 3600; } });
      const r1 = (x) => Math.round(x * 10) / 10;
      const tempsAt = Array.from({ length: 13 }, (_, k) => { const ms = window.RouteLib.at(route, (route.total * k) / 12).t; let best = null, bd = Infinity; H.time.forEach((sec, i) => { const d = Math.abs(sec * 1000 - ms); if (d < bd && H.temperature_2m[i] != null) { bd = d; best = H.temperature_2m[i]; } }); return best == null ? null : r1(best); });
      return { temps: tempsAt.some((v) => v == null) ? null : tempsAt, tz: off, sunrise: sunrise != null ? r1(sunrise) : null, sunset: sunset != null ? r1(sunset) : null, tMin: r1(tMin), tMax: r1(tMax), wind: r1(ws / n), head: hn ? r1(hs / hn) : 0,
        dir: Math.round((((Math.atan2(sx, sy) * 180) / Math.PI) + 360) % 360), precip: r1(pr), code, hours: n, src: 'Open-Meteo' };
    };
    for (const host of ['https://archive-api.open-meteo.com/v1/archive', 'https://api.open-meteo.com/v1/forecast']) {
      try { const rs = await fetch(host + '?' + qs); if (!rs.ok) continue; const w = read(await rs.json()); if (w) return w; } catch (e) { /* пробуем следующий источник */ }
    }
    return null;
  }
  // своё путешествие: найденные «откуда» и места по пути сохраняются в последнем дне
  function syncDayMeta(route) {
    if (!isOwn() || state.route !== route || !route.meta) return;
    const days = [...state.seriesBase.days].sort((x, y) => x.day - y.day), last = days[days.length - 1];
    if (!last) return;
    const upd = { ...last, from: (state.o.startName || '').trim() || route.meta.from || last.from || null, waypoints: route.meta.waypoints || last.waypoints || [], weather: route.meta.weather || last.weather || null, country: route.meta.country || last.country || null };
    state.seriesBase = { ...state.seriesBase, days: state.seriesBase.days.map((d) => (d.day === last.day ? upd : d)) };
    saveOwn();
  }
  /* ближайший настоящий населённый пункт: город ≤30 км, иначе город/посёлок ≤20 км, иначе село ≤10 км (OSM Overpass) */
  async function placeNear(lat, lon, lang) {
    const q = `[out:json][timeout:15];node(around:30000,${lat},${lon})[place~"^(city|town|village)$"][name];out 40;`;
    const j = await (await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q))).json();
    const rank = { city: 3, town: 2, village: 1 }, lim = { city: 30000, town: 20000, village: 10000 };
    let best = null, bs = -1;
    for (const e of j.elements || []) {
      const d = window.RouteLib.hav({ lat, lon }, { lat: e.lat, lon: e.lon }), k = e.tags.place;
      if (d > lim[k]) continue;
      const score = rank[k] * 100000 - d;
      if (score > bs) { bs = score; best = e; }
    }
    return best ? best.tags['name:' + lang] || best.tags.name : '';
  }
  let touchedPlaces = false;
  function renderPlaces() {
    const box = $('places'); box.innerHTML = '';
    state.o.places.forEach((pl, i) => {
      const row = document.createElement('div'); row.className = 'prow';
      const inp = document.createElement('input'); inp.value = pl.name; inp.maxLength = 28;
      inp.oninput = () => { pl.name = inp.value; touchedPlaces = true; rebuild(true); };
      const km = document.createElement('small'); km.textContent = Math.round(pl.s / 1000) + ' км';
      const del = document.createElement('button'); del.textContent = '×'; del.title = 'Убрать подпись';
      del.onclick = () => { state.o.places.splice(i, 1); touchedPlaces = true; renderPlaces(); rebuild(true); };
      row.append(inp, km, del); box.appendChild(row);
    });
    $('placesHint').hidden = state.o.places.length > 0;
  }

  /* ---- сборка сцены: трек дня / весь путь / оба подряд ---- */
  /* ---- серия: путешествие по дням + новый день → план режиссёра → эпизод ---- */
  function segOf(r, to) {
    const step = Math.max(1, Math.floor(r.n / 250)), pick = [];
    for (let i = 0; i < r.n; i += step) pick.push(i);
    pick.push(r.n - 1);
    if (r.brk) for (let i = 1; i < r.n; i++) if (r.brk[i]) pick.push(i - 1, i);   // границы разрывов обязаны попасть в линию
    const idx = [...new Set(pick)].sort((a, b) => a - b);
    const line = idx.map((i) => [+(r.lonU ? r.lonU[i] : r.lon[i]).toFixed(5), +r.lat[i].toFixed(5)]);   // долгота непрерывная: за 180° идёт 180,1, а не −179,9
    const breaks = r.brk ? idx.reduce((a, i, k) => (r.brk[i] ? (a.push(k), a) : a), []) : [];
    const date = r.t ? new Date(r.t[0] + (r.lon[0] / 15) * 3600e3).toISOString().slice(0, 10) : null;
    const seg = { km: Math.round(r.total / 100) / 10, line, date, to: to || null, gain: r.ele ? Math.round(r.stats.gain) : 0, name: r.name || null };
    if (breaks.length) { seg.breaks = breaks; seg.gapKm = Math.round(r.gapM / 100) / 10; }   // разрывы записи: линию через них не рисуем, км не считаем
    // факты дня для режиссёра: профиль высоты, высшая точка, время в пути
    if (r.ele) {
      const N = 72, raw = Array.from({ length: N }, (_, k) => window.RouteLib.at(r, (r.total * k) / (N - 1)).ele);
      seg.profile = raw.map((_, k) => { const w = raw.slice(Math.max(0, k - 2), k + 3).sort((a, b) => a - b); return Math.round(w[Math.floor(w.length / 2)]); });
      const mi = r.stats.maxI;
      seg.maxEle = Math.round(r.stats.maxE); seg.minEle = Math.round(r.stats.minE);
      seg.maxAt = [+r.lon[mi].toFixed(5), +r.lat[mi].toFixed(5)]; seg.maxKm = Math.round(r.D[mi] / 1000);
    }
    if (r.t && r.stats.avg) { seg.movingH = Math.round((r.stats.moving / 3.6e6) * 100) / 100; seg.avgKmh = Math.round(r.stats.avg * 10) / 10; }
    if (r.t) { const K = 24; seg.tAt = Array.from({ length: K + 1 }, (_, k) => Math.round(window.RouteLib.at(r, (r.total * k) / K).t)); seg.lon0 = +r.lon[0].toFixed(3); }
    if (r.meta) { seg.from = (state.o.startName || '').trim() || r.meta.from || null; if (r.meta.country) seg.country = r.meta.country; seg.waypoints = r.meta.waypoints || []; if (r.meta.weather) seg.weather = r.meta.weather; }
    // кольцо: финиш рядом со стартом
    seg.loop = window.RouteLib.hav({ lat: r.lat[0], lon: r.lon[0] }, { lat: r.lat[r.n - 1], lon: r.lon[r.n - 1] }) < Math.max(400, r.total * 0.06);
    return seg;
  }
  /* места по пути — из тех же векторных тайлов, из которых рисуется карта (слой place): отдельный сервис не нужен, работает всегда, когда есть карта */
  async function waypointsFor(route, lang) {
    const km = route.total / 1000, z = km < 25 ? 12 : km < 90 ? 11 : km < 400 ? 9 : 7, n2 = 1 << z;
    const maxOff = km < 25 ? 1500 : km < 90 ? 3500 : km < 400 ? 7000 : 15000;
    const keys = new Map(), step = Math.max(1, Math.floor(route.n / 400));
    for (let i = 0; i < route.n; i += step) { const tx = Math.floor((route.X[i] / 256) * n2), ty = Math.floor((route.Y[i] / 256) * n2); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { if (z >= 11 && (dx || dy)) continue; keys.set((tx + dx) + '/' + (ty + dy), [tx + dx, ty + dy]); } }
    const tiles = [...keys.values()].filter(([x, y]) => x >= 0 && y >= 0 && x < n2 && y < n2).slice(0, 48).map(([x, y]) => ({ x, y, e: window.VMap.getTile(z, x, y) }));
    await Promise.race([Promise.all(tiles.map((q) => q.e.p)), new Promise((r) => setTimeout(r, 15000))]);
    const out = [];
    for (const q of tiles) {
      const L = q.e.data && q.e.data.place; if (!L) continue;
      for (const F of L.feats) {
        const kind = F.props.class; if (F.type !== 1 || !(kind === 'city' || kind === 'town' || kind === 'village')) continue;
        const name = (lang === 'ru' && F.props['name:ru']) || F.props.name || F.props['name:latin']; if (!name) continue;
        const wx = ((q.x + F.parts[0][0] / L.extent) / n2) * 256, wy = ((q.y + F.parts[0][1] / L.extent) / n2) * 256;
        let bi = 0, bd = Infinity; for (let i = 0; i < route.n; i += step) { const d = Math.hypot(route.X[i] - wx, route.Y[i] - wy); if (d < bd) { bd = d; bi = i; } }
        const lon = (wx / 256) * 360 - 180, lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * wy) / 256))) * 180) / Math.PI;
        const off = window.RouteLib.hav({ lat, lon }, { lat: route.lat[bi], lon: route.lon[bi] });
        out.push({ name, kind, pop: 100 - (F.props.rank != null ? F.props.rank : 50), frac: route.D[bi] / route.total, lon: route.lon[bi], lat: route.lat[bi], off });
      }
    }
    route.placesAll = out;
    return out.filter((w) => w.off <= maxOff * (w.kind === 'city' ? 1.6 : 1));
  }
  // название места у точки маршрута — запасной путь, если адресный сервис промолчал
  const nearName = (route, fr) => { const c = (route.placesAll || []).filter((w) => Math.abs(w.frac - fr) < 0.04 && w.off < 12000).sort((a, b) => a.off - b.off)[0]; return c ? c.name : ''; };
  function seriesInput() {
    if (isOwn()) return ownToday();
    let J = state.seriesBase, change = null;
    if (state.route && !state.routeIsDemo) {
      const seg = segOf(state.route, state.o.endName), line = seg.line;
      const media = [...(state.o.photos || [])].sort((a, b) => (a.s || 0) - (b.s || 0)).map((p) => ({ kind: 'photo', url: p.url, caption: p.caption || '', credit: p.credit || '' }));
      const notes = state.o.note ? [{ text: state.o.note }] : [];
      const lastDay = [...J.days].sort((a, b) => a.day - b.day).pop();
      const gapKm = lastDay ? window.RouteLib.hav({ lon: lastDay.line[lastDay.line.length - 1][0], lat: lastDay.line[lastDay.line.length - 1][1] }, { lon: line[0][0], lat: line[0][1] }) / 1000 : 0;
      ({ journey: J, change } = window.Director.addDay(J, seg, media, notes));
      change.gapKm = J.days.length > 1 ? Math.round(gapKm) : 0;
    }
    return { J, change };
  }
  /* ---- лицо героя: знак, имя, цвет. У примеров оно задано заранее, у своего трека — из «Кто едет» ---- */
  const HERO_GREEN = '#2fa84f', PKEY = 'route-story-profile';
  const COLORS = [HERO_GREEN, '#e8590c', '#2f7fd6', '#f59f00', '#c2255c', '#0c9aa0'];
  state.profile = (() => { try { return { name: '', mark: 'unicycle', color: null, next: '', ...(JSON.parse(localStorage.getItem(PKEY) || '{}')) }; } catch (e) { return { name: '', mark: 'unicycle', color: null, next: '' }; } })();
  if (state.profile.mark === 'auto') state.profile.mark = 'unicycle';
  function profileFor(J, ctxSeg) {
    if (J.id === 'manual') return { ...state.profile, mark: state.profile.mark || 'unicycle' };
    if (J.schematic) return { name: '@wahrider', mark: 'unicycle', color: HERO_GREEN, next: '' };            // герой вайбатона: Барбос и его зелёный обод
    if (J.id !== 'my') return { name: J.traveler || '', mark: state.profile.mark || 'unicycle', color: state.profile.color, next: state.profile.next };   // пример: знак и цвет — как выбрал пользователь (по умолчанию уницикл)
    const p = state.profile, v = ctxSeg && ctxSeg.avgKmh ? ctxSeg.avgKmh : 0;
    return { name: p.name, color: p.color, next: p.next, mark: p.mark || 'unicycle' };
  }
  function saveProfile() { try { localStorage.setItem(PKEY, JSON.stringify(state.profile)); } catch (e) { /* без сохранения */ } rebuild(true); }
  $('pName').value = state.profile.name; $('pNext').value = state.profile.next;
  $('pName').oninput = () => { state.profile.name = $('pName').value.trim(); saveProfile(); };
  $('pNext').oninput = () => { state.profile.next = $('pNext').value.trim(); saveProfile(); };
  [...$('pMark').children].forEach((b) => { b.classList.toggle('on', b.dataset.v === state.profile.mark); b.onclick = () => { state.profile.mark = b.dataset.v; [...$('pMark').children].forEach((x) => x.classList.toggle('on', x === b)); saveProfile(); }; });
  [null, ...COLORS].forEach((c) => {
    const b = document.createElement('button'); b.type = 'button';
    if (c) { b.style.background = c; b.title = c; b.setAttribute('aria-label', 'Цвет ' + c); } else { b.className = 'auto'; b.textContent = 'как в стиле'; }
    b.classList.toggle('on', state.profile.color === c);
    b.onclick = () => { state.profile.color = c; [...$('pColor').children].forEach((x) => x.classList.toggle('on', x === b)); saveProfile(); };
    $('pColor').appendChild(b);
  });

  function applyShow(J0) {   // выключенное в «Что показывать» убираем из данных: режиссёр просто не увидит этих кадров
    const S2 = state.show, days = J0.days.map((d) => {
      const x = { ...d };
      if (!S2.weather) delete x.weather;
      if (!S2.ele) { x.gain = 0; delete x.profile; delete x.maxEle; delete x.minEle; }
      if (!S2.time) { x.movingH = 0; x.avgKmh = 0; }
      if (!S2.places) x.waypoints = [];
      return x;
    });
    return { ...J0, days, media: S2.photos ? J0.media : [], notes: S2.phrase ? J0.notes : [] };
  }
  function buildEpisode(w, h) {
    const inp = seriesInput(), change = inp.change, J1 = applyShow(inp.J), lastSeg = [...J1.days].sort((a, b) => a.day - b.day).pop();
    const J = { ...J1, profile: profileFor(J1, lastSeg) };
    $('pHint').hidden = J.id === 'my' || J.id === 'manual';
    // фрагмент — короткая серия про сегодняшний участок; вся дорога — сначала весь путь, потом участок; у героя по постам — только трейлер
    state.etype = J.schematic ? 'story-so-far' : state.kind === 'long' ? 'new-viewer' : 'returning-viewer'; $('etype').value = state.etype;
    $('kind').hidden = !!J.schematic;
    const res = window.Director.direct(J, state.etype, { aspect: state.fmt === 'v' ? '9:16' : '16:9', dur: state.etype === 'returning-viewer' && !J.schematic ? [18, 24, 20, 28] : null });   // фрагмент — короткий ролик ~20–28 с
    res.plan = applyEdits(res.plan); if(state.videoLength)res.plan=window.Director.retime(res.plan,state.videoLength); state.lastEp = { res, change, J }; renderScreens();
    renderSeriesPanel(res, change, J);
    const R = state.route && !state.routeIsDemo ? state.route : state.demoDay ? state.route : null, tot = R ? R.total : 0;
    const extra = {
      trackNotes: state.show.notes ? (state.o.tnotes || []).filter((n) => n.text.trim()).map((n) => ({ f: n.f, text: n.text.trim() })) : [],
      photoPins: tot && state.show.photos ? (state.o.photos || []).filter((p) => p.s != null).map((p) => ({ f: Math.min(1, Math.max(0, p.s / tot)), url: p.url })) : [],
      stickers: window.StyleIcons.legacyEnabled && state.show.stickers ? (state.o.stickers || []).map((x) => x || null) : [], showFlags: state.show.flags, showRelief: state.show.relief, appearance: state.appearance,
    };
    return window.Episode.createEpisodeScene({ journey: J, plan: res.plan, styleId: state.styleId, lang: state.o.lang, relief: state.relief !== false, labels: state.labels, logo: state.logo, mapZoom: state.mapZoom, ...extra }, w, h);
  }
  const NAMES = { hook: 'завязка', context: 'контекст', 'new-leg': 'новый участок', achievement: 'достижение', moment: 'момент', proof: 'доказательство', outro: 'финал' };
  function renderSeriesPanel(res, change, J) {
    const S = window.Director.summarize(J), fmt = (v) => Math.round(v).toLocaleString('ru-RU');
    const c0 = res.ctx;
    const ownHead = (isOwn() && ownNote ? `<div class="warn">${ownNote}</div>` : '') + (!isOwn() ? '' : `<div class="cand">${J.title} · ${S.daysCount} ${S.daysCount % 10 === 1 && S.daysCount % 100 !== 11 ? 'день' : S.daysCount % 10 >= 2 && S.daysCount % 10 <= 4 && (S.daysCount % 100 < 10 || S.daysCount % 100 >= 20) ? 'дня' : 'дней'} · ${fmt(S.totalKm)} км · сохраняется в этом браузере</div>`);
    setTimeout(() => { const g = $('glue'); if (g) g.onclick = () => { if (!farUndo) return; const u = farUndo; farUndo = null; state.seriesBase = u.base; handleFiles(u.files, true); }; }, 0);
    $('change').innerHTML = ownHead + (J.schematic ? `<b>Кругосветка @wahrider</b>${J.days.length} мест по постам · 7 260 км по словам автора` : change
      ? `<b>+${fmt(change.km)} км · День ${change.day}</b><br>${change.media ? change.media + ' фото · ' : ''}${change.notes ? 'заметка · ' : ''}всего ${fmt(change.totalAfter)} км${change.arrival ? ' · прибытие: ' + change.arrival : ''}${change.milestones.length ? ' · веха: ' + change.milestones.map(fmt).join(', ') + ' км' : ''}${change.gapKm > 30 ? `<div class="warn">Этот день начинается в ${fmt(change.gapKm)} км от места, где закончился предыдущий. Это точно продолжение путешествия?</div>` : ''}`
      : `<b>${J.title}</b><br>${S.daysCount} ${S.daysCount % 10 === 1 && S.daysCount % 100 !== 11 ? 'день' : S.daysCount % 10 >= 2 && S.daysCount % 10 <= 4 && (S.daysCount % 100 < 10 || S.daysCount % 100 >= 20) ? 'дня' : 'дней'} · ${fmt(S.totalKm)} км. Добавьте следующий день — свой GPX.`);
    // заголовок над шагами: что это за ролик
    const esc = (x) => String(x == null ? '' : x).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    const kmT = (v) => (v < 100 ? (Math.round(v * 10) / 10).toLocaleString('ru-RU') : fmt(v)) + ' км';
    const routeName = c0.from && c0.to && c0.from !== c0.to && !c0.seg.loop ? `${c0.from} → ${c0.to}` : c0.to || c0.from || c0.name || J.title || 'Маршрут';
    $('headline').innerHTML = J.schematic
      ? `Кругосветка @wahrider<small>трейлер по постам канала · ролик ${Math.round(res.plan.durationSec)} с</small>`
      : `${esc(routeName)}<small>${kmT(c0.newKm)}${S.daysCount > 1 ? ` · день ${c0.day} из путешествия на ${fmt(S.totalKm)} км` : ''}${J.id === 'demo' || state.demoDay ? ' · пример' : ''} · ролик ${Math.round(res.plan.durationSec)} с</small>`;
    // «Что попало в ролик»: сразу видно, что программа достала из файла и чего в нём нет
    const fact = (ok, label, value) => `<div class="fact ${ok === 'wait' ? 'wait' : ok ? '' : 'no'}"><b>${label}</b><span>${esc(value)}</span></div>`;
    const noTime = 'в файле нет времени', used = (id) => res.plan.beats.some((b) => b.recipe === id);
    $('facts').innerHTML = J.schematic
      ? fact(true, 'Маршрут по постам', `${J.days.length} мест, пунктир — схема, не GPS-трек`) + fact(true, 'Фото автора', `${(J.media || []).length} кадров из канала`)
      : [
        fact(true, 'Маршрут', `${routeName} · ${kmT(c0.newKm)}${c0.seg.loop ? ' · кольцо' : ''}`),
        c0.waypoints.length ? fact(true, 'Города по пути', c0.waypoints.map((w) => w.name).join(', ')) : fact(placesJob ? 'wait' : false, 'Города по пути', placesJob ? 'ищу…' : 'рядом с маршрутом не нашлись'),
        c0.weather ? fact(true, 'Погода того дня', c0.weather.head + (c0.weather.sub ? ' · ' + c0.weather.sub : '')) : fact(c0.seg.tAt && weatherJob ? 'wait' : false, 'Погода того дня', c0.seg.tAt ? (weatherJob ? 'ищу…' : 'не найдена') : noTime),
        c0.seg.tAt ? fact(true, 'Время суток и часы', 'свет меняется по ходу дня, часы в титре') : fact(false, 'Время суток и часы', noTime),
        c0.movingH >= 0.4 ? fact(true, 'Время в пути и скорость', `${Math.floor(c0.movingH)} ч ${String(Math.round((c0.movingH % 1) * 60)).padStart(2, '0')} мин · ${String(c0.avgKmh).replace('.', ',')} км/ч`) : fact(false, 'Время в пути и скорость', noTime),
        c0.profile ? fact(true, 'Высота', `набор +${fmt(c0.gain)} м${used('elevation-profile') ? ', профиль в ролике' : ' — день ровный, кадр не нужен'}`) : fact(false, 'Высота', 'в файле нет высоты'),
        c0.photos.length ? fact(true, 'Фото', `${c0.photos.length} — в ролике`) : fact(false, 'Фото', 'не добавлены — шаг «Фото»'),
        c0.note ? fact(true, 'Фраза дня', `«${c0.note.text}»`) : fact(false, 'Фраза дня', 'не добавлена — шаг «Текст»'),
      ].join('');
    $('etypeBox').hidden = !!J.schematic || J.days.length < 2;   // выбор «для кого серия» имеет смысл только для путешествия из нескольких дней
    if (J.id === 'manual') {
      $('headline').innerHTML = `${esc(J.title)}<small>${window.ManualPath.count(J.days.length)} · схема, не GPS · ролик ${Math.round(res.plan.durationSec)} с</small>`;
      $('change').textContent = `${J.title} · ${window.ManualPath.count(J.days.length)} · схема по вашим отметкам, не GPS`;
      $('facts').innerHTML = fact(true, 'Ручной путь', `${window.ManualPath.count(J.days.length)} по порядку`) + fact(true, 'Плавное движение', 'промежуточные точки рассчитываются автоматически') + fact(true, 'Схема, не GPS', 'фактические километры и время не выдумываются');
    }
    const v = window.Director.validate(res.plan, J);
    $('plan').innerHTML = `<div>${res.plan.episodeType} · ${res.plan.durationSec} с · зерно ${res.plan.seed}${res.plan.fallback ? ' · запасной план: ' + res.plan.fallback : ''}${v.ok ? ' · проверка пройдена' : ' · ошибки: ' + v.errors.join('; ')}</div>` +
      res.log.map((l) => `<div class="beat"><b>${NAMES[l.beat] || l.beat}</b>: ${l.selected || '—'}<div class="cand">${l.candidates.map((c) => `<span class="${c.id === l.selected ? 'sel' : ''}">${c.id} ${c.eligible ? c.total : '✕'}</span>`).join(' · ')}</div><div class="cand">${l.reason}</div></div>`).join('') +
      (res.plan.fitting ? `<div class="cand">длительность: ${res.plan.fitting}</div>` : '') +
      `<div class="cand">в памяти серий: ${(J.episodes || []).length}</div>`;
  }
  async function loadSeries(id = ++sourceId) {
    queueDraft(true);
    try {
      const J = await (await fetch('data/demo-journey.json')).json();
      if (id !== sourceId) return false;
      clearDayEditor(); state.route = null; state.pre = null; state.routeIsDemo = false;
      state.seriesBase = J;
      setKind('short');
      if (state.routeIsDemo) { state.route = null; state.routeIsDemo = false; }
      $('info').hidden = false;
      $('info').innerHTML = `<span><b>${state.seriesBase.title}</b> — демо-путешествие</span><span>46 дней · вымышленный путешественник на реальных дорогах</span>`;
      refreshModes(); setMode('series'); play(true); return true;
    } catch (e) { if (id === sourceId) showErr('Не удалось загрузить демо-путешествие: ' + e.message); return false; }
  }
  $('series').onclick = () => loadSeries();

  /* ---- моё путешествие: свои GPX становятся днями, путешествие хранится в браузере ---- */
  const OWN_KEY = 'route-story-my-journey';
  const isOwn = () => state.seriesBase && state.seriesBase.id === 'my';
  const leanOwn = J => ({ ...J, media: [], days: J.days.map(d => ({ ...d, media: [] })) });
  const dayKey = J => JSON.stringify(J.days.map(d => [d.day, d.date, d.km, d.line]));
  let draftTimer = null, draftWrites = Promise.resolve(), draftRevision = 0;
  function draftStatus(text) { $('draftStatus').textContent = text; $('draftStatus').hidden = !text; }
  function queueDraft(now = false) {
    if (!isOwn() || state.mode !== 'series' || !state.route || state.demoDay || !state.seriesBase.days.length) return;
    clearTimeout(draftTimer);
    draftStatus('Сохраняю фото и текст в этом браузере…');
    const save = () => {
      if (!isOwn() || state.mode !== 'series' || !state.route || state.demoDay || !state.seriesBase.days.length) return;
      const rev = ++draftRevision, id = sourceId;
      let data;
      try {
        const q = state.pre;
        data = structuredClone({ version: 1, journey: leanOwn(ownToday().J), route: state.route,
          pre: q ? { base: leanOwn(q.base), route: q.route, routeIsDemo: false, demoDay: false, files: q.files, glue: q.glue } : null,
          trim: state.trim, merge: $('mergeDay').checked, kind: state.kind,
          editor: { note: state.o.note, startName: state.o.startName, endName: state.o.endName, tnotes: state.o.tnotes },
          photos: photoFiles.filter(p => !p.demo).map(p => ({ file: p.file, name: p.name, meta: p.meta, caption: p.caption, credit: p.credit, s: p.s, how: p.how, handKey: p.handKey })) });
      } catch (e) { draftStatus('Не удалось сохранить черновик. Оставьте эту страницу открытой и скачайте ролик.'); return; }
      draftWrites = draftWrites.catch(() => {}).then(async () => {
        await window.RSDrafts.save(data);
        localStorage.setItem(OWN_KEY, JSON.stringify(data.journey));
        if (rev === draftRevision && id === sourceId && isOwn() && !state.demoDay) draftStatus('Фото и текст последнего дня сохранены в этом браузере. После открытия нажмите «Продолжить моё путешествие».');
      }).catch(() => {
        if (rev === draftRevision && id === sourceId) draftStatus('Не удалось сохранить черновик. Оставьте эту страницу открытой и скачайте ролик.');
      });
    };
    if (now) save(); else draftTimer = setTimeout(save, 350);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') queueDraft(true); });
  window.addEventListener('pagehide', () => queueDraft(true));
  function clearDayEditor() {
    clearTimeout(draftTimer); draftStatus('');
    photoFiles = []; state.o.photos = []; renderPhotos();
    state.o.note = ''; $('note').value = ''; state.o.tnotes = []; renderNotes();
    for (const k of ['startName', 'endName']) { state.o[k] = ''; $(k).value = ''; touched[k] = false; }
    state.demoDay = false; state.demoNote = false;
  }
  function newOwn(title) { return { id: 'my', title: title || 'Моё путешествие', traveler: '', days: [], media: [], notes: [], checkpoints: [], episodes: [] }; }
  function saveOwn() {
    if (!isOwn()) return;
    const keep = leanOwn(state.seriesBase);   // Blob сохраняются отдельно в IndexedDB, временные URL в JSON не пишутся
    try { localStorage.setItem(OWN_KEY, JSON.stringify(keep)); } catch (e) { /* нет места или приватный режим — работаем без сохранения */ }
  }
  function loadOwnSaved() { try { const j = JSON.parse(localStorage.getItem(OWN_KEY) || 'null'); return j && j.id === 'my' && j.days && j.days.length ? j : null; } catch (e) { return null; } }
  // своё путешествие: «сегодня» — последний сохранённый день; текущие фото, фраза и место относятся к нему
  function ownToday() {
    const J = state.seriesBase, days = [...J.days].sort((a, b) => a.day - b.day), last = days[days.length - 1];
    if (!last) return { J, change: null };
    const prev = { ...J, days: days.slice(0, -1), checkpoints: (J.checkpoints || []).filter((c) => c.day < last.day), media: (J.media || []).filter((m) => m.day < last.day), notes: (J.notes || []).filter((n) => n.day < last.day) };
    const media = [...(state.o.photos || [])].sort((a, b) => (a.s || 0) - (b.s || 0)).map((p) => ({ kind: 'photo', url: p.url, caption: p.caption || '', credit: p.credit || '' }));
    const notes = state.o.note ? [{ text: state.o.note }] : [];
    const pl = days[days.length - 2], gapKm = pl ? window.RouteLib.hav({ lon: pl.line[pl.line.length - 1][0], lat: pl.line[pl.line.length - 1][1] }, { lon: last.line[0][0], lat: last.line[0][1] }) / 1000 : 0;
    const res = window.Director.addDay(prev, { ...last, from: (state.o.startName || '').trim() || last.from || null, to: state.o.endName || last.to || null }, media, notes);
    res.change.gapKm = Math.round(gapKm);
    return { J: res.journey, change: res.change };
  }
  function bakeToday() { if (isOwn() && state.seriesBase.days.length) { queueDraft(true); state.seriesBase = ownToday().J; clearDayEditor(); } }
  /* один файл на несколько дней → отдельные дни по местной дате (если в файле есть время) */
  function splitDays(parsed) {
    const pts = parsed.pts.filter((q) => isFinite(q.lat) && isFinite(q.lon));
    if (pts.filter((q) => isFinite(q.t)).length < pts.length * 0.9) return [];
    const groups = new Map(); let lastKey = null, lonU = pts.length ? pts[0].lon : 0, prevLon = lonU;   // долгота без скачка на 180-м меридиане
    for (const q of pts) { let dl = q.lon - prevLon; if (dl > 180) dl -= 360; else if (dl < -180) dl += 360; lonU += dl; prevLon = q.lon; const key = isFinite(q.t) ? Math.floor((q.t + (lonU / 15) * 3600e3) / 864e5) : lastKey; if (key == null) continue; lastKey = key; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(q); }
    const out = [...groups.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]).filter((g) => g.length >= 2);
    return out.length >= 2 && out.length <= 120 ? out : [];
  }
  /* названия концов дней — чтобы у пересказа пути были вехи (Nominatim, не чаще 1 запроса в секунду, не больше 8 дней) */
  async function nameDays() {
    if (!isOwn()) return;
    const days = [...state.seriesBase.days].sort((a, b) => a.day - b.day);
    if (days.length < 2) return;
    const need = days.slice(0, -1).filter((d) => !d.to), n = Math.min(8, need.length), pick = Array.from({ length: n }, (_, i) => need[Math.round((i * (need.length - 1)) / Math.max(1, n - 1))]);
    const rev = async (lon, lat) => { lon = ((((lon + 540) % 360) + 360) % 360) - 180; const j = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&accept-language=${state.o.lang}&lat=${lat}&lon=${lon}`)).json(); const a = j.address || {}; return a.city || a.town || a.village || a.municipality || a.county || ''; };
    const apply = (day, patch, cp) => {
      if (!isOwn()) return;
      const J = state.seriesBase, cps = (J.checkpoints || []).slice();
      if (cp && !cps.some((c) => c.day === cp.day && c.label === cp.label)) cps.push(cp);
      state.seriesBase = { ...J, days: J.days.map((d) => (d.day === day ? { ...d, ...patch } : d)), checkpoints: cps };
    };
    try {
      await new Promise((r) => setTimeout(r, 2500));   // сначала — «откуда/куда» текущего дня
      const first = days[0];
      if (!(state.seriesBase.checkpoints || []).some((c) => c.kind === 'origin')) { const nm = await rev(first.line[0][0], first.line[0][1]); if (nm) apply(first.day, { from: nm }, { day: first.day, kind: 'origin', label: nm }); await new Promise((r) => setTimeout(r, 1100)); }
      for (const d of [...new Set(pick)]) {
        const e = d.line[d.line.length - 1], nm = await rev(e[0], e[1]);
        if (nm) apply(d.day, { to: nm }, { day: d.day, kind: 'city', label: nm });
        await new Promise((r) => setTimeout(r, 1100));
      }
      saveOwn(); rebuild(true);
    } catch (e) { /* без сети вехи просто не появятся */ }
  }
  let ownNote = '', farUndo = null;
  async function handleFiles(files, glue, again) {
    const id = ++sourceId;
    showErr('');
    if (state.mode === 'track' && state.route) { readFile(files[0]); return; }
    const pre = again ? state.pre : { base: state.seriesBase, route: state.route, routeIsDemo: state.routeIsDemo, demoDay: state.demoDay, demoNote: state.demoNote, photos: photoFiles.slice(), note: state.o.note, files, glue };
    if (!again) { state.trim = { a: 0, b: 0, c: 0, d: 0, s: 0 }; state.rawText = null; }   // снимок принимается только после успешного разбора; неверный файл не ломает обрезку прежнего
    let merged = null;   // «несколько файлов — один день»: точки всех файлов в один трек (по времени, если оно есть), каждый файл — свой отрезок
    if (files.length > 1 && $('mergeDay').checked) {
      try {
        const ps = []; for (const f of files) { const tx = await f.text(); if (id !== sourceId) return; ps.push(parseAny(tx, f.name)); }
        let pts = ps.flatMap((q, k) => q.pts.map((pt) => ({ ...pt, seg: (pt.seg || 0) + k * 100000 }))); if (pts.every((q) => isFinite(q.t))) pts.sort((a, b) => a.t - b.t);
        merged = { ...ps[0], pts };
      } catch (e) { if (id === sourceId) showErr(e.message || String(e)); return; }
    }
    const single = files.length === 1 || !!merged, jobs = merged ? [files[0]] : files;
    const got = []; let multi = 0;
    for (const f of jobs) {
      try {
        const tx = merged ? '' : await f.text(); if (id !== sourceId) return;
        const nm = f.name.replace(/\.[^.]+$/, ''), parsed = merged || parseAny(tx, f.name);
        const parts = merged ? [] : splitDays(parsed);   // склеенное — один день, по датам не режем
        if (single && parts.length < 2) parsed.pts = trimPts(parsed.pts);
        if (parts.length >= 2) { parts.forEach((pts, i) => { try { got.push({ r: prepare({ name: parsed.name, pts }, nm), name: f.name + '#' + String(i).padStart(3, '0') }); } catch (e) { /* слишком короткий кусок дня */ } }); multi = Math.max(multi, parts.length); }
        else got.push({ r: prepare(parsed, nm), name: f.name });
      }
      catch (e) { if (id === sourceId) showErr(`${f.name}: ${e.message || e}`); }
    }
    if (!got.length) return;
    got.sort((a, b) => (a.r.t && b.r.t ? a.r.t[0] - b.r.t[0] : a.name.localeCompare(b.name, 'ru', { numeric: true })));
    // свой трек начинает (или продолжает) своё путешествие — не клеится к демо
    const ownBefore = isOwn();
    if (!ownBefore) { state.seriesBase = (!again && loadOwnSaved()) || newOwn(); state.route = null; }
    ownNote = '';
    if (!glue) {
      const hv = window.RouteLib.hav, P = (q) => ({ lon: q[0], lat: q[1] }), ends = (r) => [{ lon: r.lon[0], lat: r.lat[0] }, { lon: r.lon[r.n - 1], lat: r.lat[r.n - 1] }];
      const sameDay = (d, r) => { const [a, b] = ends(r), date = r.t ? new Date(r.t[0] + (r.lon[0] / 15) * 3600e3).toISOString().slice(0, 10) : null; return !(d.date && date && d.date !== date) && Math.abs(d.km - r.total / 1000) < Math.max(0.3, d.km * 0.01) && hv(P(d.line[0]), a) < 300 && hv(P(d.line[d.line.length - 1]), b) < 300; };
      const days0 = [...state.seriesBase.days].sort((a, b) => a.day - b.day);
      // 1) этот день уже есть в путешествии — не добавляем его второй раз
      const fresh = got.filter((g) => !days0.some((d) => sameDay(d, g.r)));
      if (fresh.length < got.length) {
        const dup = got.find((g) => days0.some((d) => sameDay(d, g.r))), dd = days0.find((d) => sameDay(d, dup.r));
        if (!fresh.length) {   // загружен только уже известный день: путешествие не растёт
          const isLast = dd.day === days0[days0.length - 1].day;
          if (!isLast) ownNote = `Этот день уже есть в путешествии (день ${dd.day}) — второй раз не добавляю.`;
          else {
            state.route = dup.r; state.routeIsDemo = false;
            // Для обрезки повторно выбранного дня база должна заканчиваться вчера, а не содержать его самого.
            state.pre = { ...pre, base: { ...state.seriesBase, days: days0.slice(0, -1), media: (state.seriesBase.media || []).filter(m => m.day < dd.day), notes: (state.seriesBase.notes || []).filter(n => n.day < dd.day), checkpoints: (state.seriesBase.checkpoints || []).filter(c => c.day < dd.day) }, demoDay: false, demoNote: false };
          }
          if (!ownBefore) { clearDayEditor(); ownFields(state.seriesBase); }
          placePhotos(); refreshModes(); setMode('series'); play(true); $('continue').hidden = true; if (isLast) geocode(dup.r); return;
        }
        got.length = 0; fresh.forEach((g) => got.push(g));
      }
      if (ownBefore && !again) bakeToday();   // только новый день завершает прежний редактор; дубликат ничего не очищает
      // 2) трек начинается далеко от конца путешествия — это другое путешествие, а не «следующий день»
      const lastD = days0[days0.length - 1];
      if (lastD) {
        const gap = hv(P(lastD.line[lastD.line.length - 1]), ends(got[0].r)[0]) / 1000;
        if (gap > 80) { farUndo = { base: state.seriesBase, files }; state.seriesBase = newOwn(); ownNote = `Этот трек начинается в ${Math.round(gap).toLocaleString('ru-RU')} км от конца прошлого путешествия — начал новое. <button class="linkbtn" id="glue">Нет, это продолжение</button>`; }
      }
    } else if (ownBefore && !again) bakeToday();
    if (state.demoDay || state.demoNote) { photoFiles = photoFiles.filter((p) => !p.demo); if (state.demoNote) { state.o.note = ''; $('note').value = ''; } state.demoDay = false; state.demoNote = false; }
    if (!again) {   // названия прошлого дня не относятся к новому файлу; обрезка сохраняет текущие правки
      state.o.tnotes = []; renderNotes();
      state.o.startName = ''; $('startName').value = ''; touched.startName = false;
      state.o.endName = ''; $('endName').value = ''; touched.endName = false;
    }
    pre.base = state.seriesBase; state.pre = pre;   // база до добавления выбранных файлов, затем обрезка восстанавливает её
    got.forEach((g) => { state.seriesBase = window.Director.addDay(state.seriesBase, segOf(g.r, null), [], []).journey; });   // каждый файл — сохранённый день
    const last = got[got.length - 1];
    state.route = last.r; state.routeIsDemo = false;
    // многодневный файл: зрителю сначала нужен весь путь, потом последний день
    setKind(multi >= 3 ? 'long' : 'short');
    saveOwn(); nameDays(); placePhotos(); refreshModes(); setMode('series'); play(true);
    $('continue').hidden = true; $('trimBox').hidden = !(single && multi < 2); syncTrim();
    geocode(last.r);
  }
  function ownFields(J) {
    const lastDay = [...J.days].sort((a, b) => a.day - b.day).at(-1), note = (J.notes || []).find(n => n.day === lastDay.day);
    state.o.note = note ? note.text : ''; $('note').value = state.o.note; state.demoDay = false; state.demoNote = false;
    state.o.startName = lastDay.from || ''; $('startName').value = state.o.startName; touched.startName = false;
    state.o.endName = lastDay.to || ''; $('endName').value = state.o.endName; touched.endName = false;
    state.o.tnotes = []; renderNotes();
  }
  $('continue').onclick = async () => {
    const id = ++sourceId;
    const J = loadOwnSaved(); if (!J) return;
    let draft = null, failed = false;
    try { await draftWrites; draft = await window.RSDrafts.load(); } catch (e) { failed = true; }
    if (id !== sourceId) return;
    clearDayEditor();
    state.seriesBase = J; state.route = null; state.routeIsDemo = false;
    ownFields(J);
    const usable = draft?.version === 1 && Array.isArray(draft.journey?.days) && draft.route?.n > 1 && draft.editor && Array.isArray(draft.photos) && draft.photos.length <= 4 && draft.photos.every(p => p.file instanceof Blob) && Array.isArray(draft.editor.tnotes);
    if (usable && dayKey(draft.journey) === dayKey(J)) {
      state.seriesBase = draft.journey; state.route = draft.route; state.pre = draft.pre; state.trim = draft.trim;
      $('mergeDay').checked = !!draft.merge;
      Object.assign(state.o, draft.editor);
      for (const k of ['note', 'startName', 'endName']) { $(k).value = state.o[k]; touched[k] = true; }
      photoFiles = draft.photos.map(p => ({ ...p, url: URL.createObjectURL(p.file) }));
      renderNotes(); placePhotos(); syncTrim(); $('trimBox').hidden = !state.pre || state.pre.files.length !== 1;
    } else draftStatus(failed ? 'Не удалось открыть черновик с фото. Сохранённый маршрут доступен.' : 'У этого сохранённого путешествия нет черновика с фото.');
    setKind(usable && dayKey(draft.journey) === dayKey(J) && draft.kind === 'short' ? 'short' : 'long');
    $('continue').hidden = true; refreshModes(); setMode('series'); play(true);
  };
  $('mergeDay').onchange = () => { if (state.pre && state.pre.files.length > 1) { const q = state.pre; state.seriesBase = q.base; state.route = q.route; state.routeIsDemo = q.routeIsDemo; state.demoDay = q.demoDay; handleFiles(q.files, q.glue, true); } };
  $('resetOwn').onclick = () => { clearTimeout(draftTimer); ++draftRevision; const own = isOwn(); if (own) { clearDayEditor(); state.route = null; } try { localStorage.removeItem(OWN_KEY); } catch (e) {} draftWrites = draftWrites.then(async () => { await window.RSDrafts.remove(); localStorage.removeItem(OWN_KEY); }).catch(() => draftStatus('Не удалось удалить локальный черновик.')); $('continue').hidden = true; $('resetOwn').hidden = true; if (own) loadSeries().then(ok => { if (ok) $('day47').click(); }); };
  { const J = loadOwnSaved(); if (J) { $('resetOwn').hidden = false; $('continue').hidden = false; $('continue').textContent = `Продолжить моё путешествие · ${J.days.length} ${J.days.length % 10 === 1 && J.days.length % 100 !== 11 ? 'день' : J.days.length % 10 >= 2 && J.days.length % 10 <= 4 && (J.days.length % 100 < 10 || J.days.length % 100 >= 20) ? 'дня' : 'дней'}`; } }
  async function loadDemoDay(id = ++sourceId) {
    try {
      if (!state.seriesBase || state.seriesBase.id !== 'demo-samara-baikal' || state.mode !== 'series') { if (!await loadSeries(id)) return; }   // демо-день 47 — только к демо-путешествию
      if (id !== sourceId) return;
      const tx = await (await fetch('samples/day47.gpx')).text(); if (id !== sourceId) return;
      loadText(tx, 'day47.gpx');
      // демо-фото (Wikimedia Commons, CC BY-SA 4.0), заметка и место — помечены как демо: свой GPX их уберёт
      state.demoDay = true;
      if (!touched.endName) { state.o.endName = 'Байкал'; $('endName').value = 'Байкал'; }
      if (!photoFiles.length) { const cr = 'Фото: Thomas D. Fischer · CC BY-SA 4.0 · Wikimedia Commons'; photoFiles = [{ name: 'baikal-1.jpg', url: 'media/demo/baikal-1.jpg', meta: {}, caption: 'Первый вид на Байкал', credit: cr, demo: true }, { name: 'baikal-2.jpg', url: 'media/demo/baikal-2.jpg', meta: {}, caption: 'Берег у Листвянки', credit: cr, demo: true }]; }
      if (!state.o.note) { state.o.note = 'Изнурительно, но весело'; $('note').value = state.o.note; state.demoNote = true; }
      placePhotos(); }
    catch (e) { if (id === sourceId) showErr('Не удалось загрузить день 47: ' + e.message); }
  }
  $('day47').onclick = () => loadDemoDay();
  // на телефоне по умолчанию HD 720: быстрее и меньше памяти (Full HD остаётся в «Ещё → Качество»)
  try { if (matchMedia('(pointer: coarse)').matches) $('res').value = 'sd'; } catch (e) { /* без media queries */ }
  $('etype').onchange = () => { state.etype = $('etype').value; t = 0; rebuild(); };
  $('remember').onclick = () => {
    if (!state.lastEp) return;
    state.seriesBase = { ...state.seriesBase, episodes: [...(state.seriesBase.episodes || []), window.Director.summaryOf(state.lastEp.res.plan)] };
    t = 0; rebuild();
  };

  function buildScene(w, h) {
    if (state.mode === 'series') return buildEpisode(w, h);
    const o = { ...state.o };
    const parts = [];
    if (state.mode !== 'track' && state.journeyData) {
      const jb = window.Journey.build(state.journeyData, state.jcount);
      const jd = Math.max(12, Math.min(48, Math.round(jb.journey.stops.length * 2.4 + 5)));
      parts.push(createScene(jb.route, state.styleId, { ...o, title: jb.title, subtitle: jb.subtitle, duration: jd, places: [], journey: { ...jb.journey, noOutro: state.mode === 'both' } }, w, h));
    }
    if (state.mode !== 'journey' && state.route) parts.push(createScene(state.route, state.styleId, o, w, h));
    return parts.length > 1 ? window.Journey.composite(parts, w, h) : parts[0];
  }
  function ready() { if (state.mode === 'series') return !!state.seriesBase?.days?.length; return state.mode === 'journey' ? !!state.journeyData : state.mode === 'both' ? !!(state.journeyData && state.route) : !!state.route; }

  function setMode(m) {
    state.mode = m;
    [...$('mode').children].forEach((b) => b.classList.toggle('on', b.dataset.v === m));
    $('jdurBox').hidden = m === 'track' || m === 'series';
    $('seriesBox').hidden = m !== 'series';
    t = 0; rebuild();
  }
  function refreshModes() {
    const hasR = !!state.route, hasJ = !!state.journeyData;
    $('mode').hidden = !(hasJ || state.seriesBase);
    [...$('mode').children].forEach((b) => { b.disabled = (b.dataset.v === 'track' && !hasR) || (b.dataset.v === 'both' && !(hasR && hasJ)) || (b.dataset.v === 'journey' && !hasJ) || (b.dataset.v === 'series' && !state.seriesBase); });
    ['s3', 's4'].forEach((id) => $(id).classList.remove('off'));
    $('empty').style.display = 'none'; cv.style.display = 'block';
  }
  [...$('mode').children].forEach((b) => (b.onclick = () => setMode(b.dataset.v)));
  $('jdur').onchange = () => { state.jcount = +$('jdur').value; t = 0; rebuild(); };

  async function loadJourney(data, label) {
    queueDraft(true);
    ++sourceId;
    state.journeyData = data;
    // демо-трек не относится к истории героя: не подмешиваем его в «Путь + трек дня»
    if (state.routeIsDemo) { state.route = null; state.routeIsDemo = false; }
    $('info').hidden = false;
    $('info').innerHTML = `<span><b>${data.title}</b></span><span>Остановок: <b>${data.stops.length}</b> · пунктир — схема по постам, не GPS</span>`;
    refreshModes();
    state.mode = state.route ? 'both' : 'journey';
    setMode(state.mode); play(true);
  }
  /* кругосветка героя → путешествие для режиссёра: остановки как «дни» схемы, даты вместо номеров дней */
  function heroJourney(d) {
    const days = [], checkpoints = [], media = [], dayLabels = {}, dayNotes = {}; let prev = null; const seen = new Set();
    d.stops.forEach((st, i) => {
      const day = i + 1, p = [st.lon, st.lat];
      const line = prev ? Array.from({ length: 24 }, (_, k) => [lerpN(prev[0], p[0], k / 23), lerpN(prev[1], p[1], k / 23)]) : [p, p];
      days.push({ day, km: prev ? window.RouteLib.hav({ lat: prev[1], lon: prev[0] }, { lat: p[1], lon: p[0] }) / 1000 : 0, line, to: st.name });
      checkpoints.push({ day, kind: i === 0 ? 'origin' : !seen.has(st.country) ? 'country' : 'city', label: st.name + (st.precision === 'region' ? ' ≈' : '') });
      seen.add(st.country); dayLabels[day] = st.dateLabel; dayNotes[day] = st.country;
      if (st.photo) media.push({ id: 'h' + day, day, kind: 'photo', url: st.photo, caption: st.name, credit: 'Фото: @wahrider · пост ' + st.photoPost });
      prev = p;
    });
    return { id: 'wahrider', title: 'Кругосветка на уницикле', traveler: '@wahrider', schematic: true, days, checkpoints, media, notes: [], episodes: [],
      dayLabels, dayNotes, totalKmLabel: '7 260 км', totalKmNote: 'по словам автора, сентябрь 2026', seasonLine: '8 стран · 7 260 км по словам автора' };
  }
  const lerpN = (a, b, t) => a + (b - a) * t;
  $('wj').onclick = async () => {
    queueDraft(true);
    const id = ++sourceId;
    try {
      const d = await (await fetch('data/journey-wahrider.json')).json();
      if (id !== sourceId) return;
      clearDayEditor(); state.pre = null;
      state.seriesBase = heroJourney(d); state.route = null; state.routeIsDemo = false;
      setKind('long');
      $('info').hidden = false; $('info').innerHTML = '<span><b>Кругосветка @wahrider</b> — трейлер по постам канала</span>';
      refreshModes(); setMode('series'); play(true);
    }
    catch (e) { if (id === sourceId) showErr('Не удалось загрузить путь: ' + e.message); }
  };

  /* ---- превью ---- */
  function rebuild(keepT) {
    document.querySelectorAll('#styles button,#fmt button,#kind button,#routeW button').forEach(b => b.setAttribute('aria-pressed', String(b.classList.contains('on'))));
    if (!ready()) return;
    queueDraft();
    const [w, h] = previewSize();
    cv.width = w; cv.height = h;
    fontsReady.then(() => {
      if (!ready()) return;   // обрезка могла временно восстановить базу без последнего дня
      scene = buildScene(w, h);
      if (!keepT && t > scene.duration) t = 0;
      dirty = true;
      syncAudio();
    });
  }
  window.RS.setOnTile(() => { dirty = true; });
  window.VMap.setOnTile(() => { dirty = true; window.RouteEditor?.redraw(); });

  /* ---- звук ---- */
  state.music = 'none'; let musicFileBuf = null, audioKey = '', audioBuf = null, audioJob = null;
  async function audioFor(sc) {
    if (!sc || state.music !== 'own' || !musicFileBuf || !window.RSAudio) return null;
    const key = 'own|' + sc.duration + '|' + musicFileBuf.byteLength;
    if (key === audioKey && audioBuf) return audioBuf;
    audioBuf = await window.RSAudio.fromFile(musicFileBuf, sc.duration); audioKey = key; return audioBuf;
  }
  async function syncAudio() {
    if (!playing || !scene) { window.RSAudio && window.RSAudio.stop(); return; }
    const sc = scene, job = (audioJob = {});
    const buf = await audioFor(sc).catch(() => null);
    if (job !== audioJob || !playing || sc !== scene) return;
    if (buf) window.RSAudio.playAt(buf, t); else window.RSAudio.stop();
  }
  $('music').onchange = () => { state.music = $('music').value; if (state.music === 'own' && !musicFileBuf) $('musicFile').click(); audioKey = ''; syncAudio(); };
  $('musicFile').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { musicFileBuf = await f.arrayBuffer(); await window.RSAudio.fromFile(musicFileBuf, 1); } catch (er) { musicFileBuf = null; showErr('Не получилось прочитать музыку: ' + (er.message || er)); } audioKey = ''; syncAudio(); };
  document.addEventListener('pointerdown', () => { if (playing) syncAudio(); }, { once: true });   // браузер разрешает звук только после действия пользователя

  function play(on) { playing = on; $('play').replaceChildren(window.UIIcons.icon(on ? 'pause' : 'play')); $('play').setAttribute('aria-label', on ? 'Пауза' : 'Играть'); last = performance.now(); syncAudio(); }
  $('play').onclick = () => { if (!playing && scene && t >= scene.duration) t = 0; play(!playing); };
  $('scrub').oninput = () => { play(false); window.RSAudio && window.RSAudio.stop(); t = ($('scrub').value / 1000) * (scene ? scene.duration : 1); dirty = true; };

  const clampT = (x) => Math.max(0, Math.min(x, scene.duration));
  function tick(ts) {
    requestAnimationFrame(tick);
    if (!scene) return;
    if (playing) {
      t += Math.max(0, ts - last) / 1000;
      if (t > scene.duration + 1.2) { t = 0; syncAudio(); }
      dirty = true;
    }
    last = ts;
    if (dirty) {
      dirty = false;
      scene.draw(ctx, clampT(t));
      $('scrub').value = Math.round((Math.min(t, scene.duration) / scene.duration) * 1000);
      const s = Math.floor(Math.min(t, scene.duration));
      $('time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
  }
  requestAnimationFrame(tick);

  /* ---- экспорт ---- */
  state.xmode = 'video';
  const exportLabel = () => (state.xmode === 'layers' ? 'Скачать слои' : 'Скачать видео');
  [...$('xmode').children].forEach((b) => (b.onclick = () => {
    state.xmode = b.dataset.v;
    [...$('xmode').children].forEach((x) => x.classList.toggle('on', x === b));
    $('layersBox').hidden = state.xmode !== 'layers';
    $('export').textContent = exportLabel();
  }));
  let layerUrls = [], resultUrls = [], keepResult = false;
  $('export').onclick = async () => {
    if (!ready()) return;
    const btn = $('export');
    if (abort) { abort.abort(); return; }
    if ($('manualBox').open && window.RouteEditor?.dirty) { showErr('Сначала нажмите «Показать этот путь в ролике» или закройте редактор пути.'); return; }
    const fmt = state.fmt, append = keepResult, wasHidden = $('result').hidden, selectedLength=state.videoLength;
    $('videoLength').disabled=true;
    let completed = false; keepResult = false;
    abort = new AbortController();
    play(false);
    btn.textContent = 'Отменить';
    $('prog').hidden = false; $('prog').setAttribute('aria-valuenow','0'); $('result').hidden = true; showErr('');
    const [W, H] = SIZES[fmt][$('res').value];
    const o = { ...state.o };
    const route = state.route || { name: (state.journeyData || state.seriesBase || {}).title || 'route-story' };
    try {
      if (state.mode === 'series' && (placesJob || weatherJob)) { $('stage').textContent = 'Ищу города по пути и погоду того дня…'; $('bar').style.width = '2%'; $('prog').setAttribute('aria-valuenow','2'); await Promise.race([Promise.all([placesJob, weatherJob]), new Promise((r) => setTimeout(r, 32000))]); }
      const dur = buildScene(W, H).duration;
      await fontsReady;
      const slug0 = (state.mode === 'series' && state.lastEp ? state.seriesBase.id === 'manual' ? `${state.seriesBase.title} путь по точкам` : `${state.seriesBase.title} день ${state.lastEp.res.plan.episodeNumber} ${state.etype}` : state.mode === 'journey' ? state.journeyData.title : (o.title || route.name)).toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-|-$/g, '') || 'route-story';
      const sz = fmt === 'v' ? '9x16' : '16x9';
      if (state.xmode === 'layers') {
        const Ls = { map: $('lyMap').checked, route: $('lyRoute').checked, hud: $('lyHud').checked };
        const keys = Object.keys(Ls).filter((k) => Ls[k]);
        if (!keys.length) throw new Error('Отметьте хотя бы один слой.');
        const groups = $('lySplit').checked ? keys.map((k) => ({ id: k, layers: { map: k === 'map', route: k === 'route', hud: k === 'hud' } })) : [{ id: 'layers', layers: Ls }];
        const labels = { map: 'карта', route: 'маршрут', hud: 'плашки', layers: 'слои' };
        const fmt = $('lyFmt').value, links = [];
        layerUrls.forEach((u) => URL.revokeObjectURL(u)); layerUrls = [];
        for (let gi = 0; gi < groups.length; gi++) {
          const g = groups[gi];
          const lr = await window.RSLayers.exportLayerFile({
            makeScene: (w, h) => buildScene(w, h), W, H, fps: +$('lyFps').value, duration: dur, layers: g.layers, format: fmt, name: slug0 + ' — ' + labels[g.id], signal: abort.signal,
            onStage: (txt, p) => { const pp = (gi + p) / groups.length; $('stage').textContent = `${groups.length > 1 ? '[' + (gi + 1) + '/' + groups.length + '] ' : ''}${txt} ${Math.round(p * 100)}%`; $('bar').style.width = pp * 100 + '%'; $('prog').setAttribute('aria-valuenow', Math.round(pp * 100)); },
          });
          const url = URL.createObjectURL(lr.blob); layerUrls.push(url);
          links.push({ url, nm: `${slug0}-${g.id}-${sz}-${fmt === 'png' ? 'png' : 'alpha'}.${lr.ext}`, size: lr.blob.size, ext: lr.ext, frames: lr.frames });
        }
        $('result').innerHTML = links.map((l) => (l.ext === 'webm' ? `<video class="chk" src="${l.url}" controls loop muted playsinline></video>` : '') + `<a href="${l.url}" download="${l.nm}">Скачать ${l.nm}</a><small>${W}×${H} · ${(l.size / 1048576).toFixed(1)} МБ</small>`).join('') + '<small>Фон прозрачный. Положите слои поверх своих фото и видео в любом редакторе.</small>';
        $('result').hidden = false; completed = true;
        window.__lastLayers = links;
        return;
      }
      const audio = await audioFor(buildScene(W, H)).catch(() => null);
      const res = await window.RSExport.exportVideo({ audio,
        makeScene: (w, h) => buildScene(w, h),
        W, H, fps: 30, duration: dur, signal: abort.signal,
        onStage: (txt, p) => { $('stage').textContent = `${txt} ${Math.round(p * 100)}%`; $('bar').style.width = p * 100 + '%'; $('prog').setAttribute('aria-valuenow', Math.round(p * 100)); },
      });
      objUrl = URL.createObjectURL(res.blob);
      const slug = slug0;
      const name = `${slug}-${selectedLength?Math.round(dur)+'s-':''}${sz}.${res.ext}`;
      const other = fmt === 'v' ? 'h' : 'v', keep = append ? $('result').innerHTML : '';
      // Освобождаем только результаты, которые действительно заменяем; оба формата остаются доступными.
      if (!append) { resultUrls.forEach(u => URL.revokeObjectURL(u)); resultUrls = []; }
      resultUrls.push(objUrl);
      $('result').innerHTML = keep + `<video src="${objUrl}" controls playsinline></video><a href="${objUrl}" download="${name}">Скачать ${name}</a><small>${W}×${H}, ${(res.blob.size / 1048576).toFixed(1)} МБ, ${res.ext.toUpperCase()}</small>` + (keep ? '' : `<button id="again" type="button">Сделать то же в ${other === 'h' ? '16:9 для YouTube' : '9:16 для Reels и Shorts'}</button>`);
      $('result').hidden = false; completed = true;
      const again = $('again'); if (again) again.onclick = () => { keepResult = true; [...$('fmt').children].find((x) => x.dataset.v === other).click(); setTimeout(() => $('export').click(), 900); again.remove(); };   // второй формат тем же маршрутом, первый файл остаётся на экране
      window.__lastExport = { url: objUrl, name, size: res.blob.size, codec: res.codec };
    } catch (e) {
      if (!/Отменено/.test(e.message)) showErr('Экспорт не удался: ' + (e.message || e));
    } finally {
      if (!completed) $('result').hidden = wasHidden;
      abort = null; $('videoLength').disabled=false; btn.textContent = exportLabel(); $('prog').hidden = true;
    }
  };

  // открыли страницу — сразу играет демо-серия «День 47» (своим GPX её можно заменить)
  window.RouteEditor = window.ManualEditor.init({
    current: () => {
      if (state.seriesBase?.id === 'manual') return state.manualData;
      const J = isOwn() ? ownToday().J : state.seriesBase;
      if (!J?.days?.length) throw new Error('Сначала загрузите путь или откройте пример.');
      const days = [...J.days].sort((a,b)=>a.day-b.day), first=days[0], origin=(J.checkpoints||[]).find(c=>c.kind==='origin'), stops=[];
      const put=(name,q,country)=>{const p={name:name||`Точка ${stops.length+1}`,lon:((q[0]+180)%360+360)%360-180,lat:q[1],country};if(!stops.length||window.RouteLib.hav(stops.at(-1),p)>1)stops.push(p);};
      put(first.from||origin?.label||first.to,first.line[0],first.country);
      days.forEach(d=>put(d.to||d.name,d.line.at(-1),d.country));
      return window.ManualPath.normalize({title:J.title,stops});
    },
    apply: data => {
      if (abort) throw new Error('Дождитесь окончания экспорта или отмените его.');
      const J=window.ManualPath.journey(data); queueDraft(true); ++sourceId; clearDayEditor();
      state.manualData=data; state.seriesBase=J; state.route=null; state.routeIsDemo=false; state.pre=null;
      $('trimBox').hidden=true; setKind('long'); $('continue').hidden=true; showErr('');
      $('info').hidden=false; $('info').textContent=`${J.title} · ${window.ManualPath.count(J.days.length)} · схема, не GPS`;
      refreshModes();setMode('series');play(true);
    },
  });
  [...$('tabs').children].forEach(b => { const i = b.querySelector('i'); i.setAttribute('aria-hidden','true'); i.replaceChildren(window.UIIcons.icon(b.dataset.t)); b.setAttribute('aria-controls','t-'+b.dataset.t); });
  $('drop').querySelector('b').prepend(window.UIIcons.icon('upload'));
  $('addNote').prepend(window.UIIcons.icon('plus'));
  showTab('route');
  (async () => { const id = ++sourceId; if (await loadSeries(id)) loadDemoDay(id); })();

  window.__app = { loadSeries, state, loadText, loadJourney, setMode, rebuild, buildScene, SIZES, get scene() { return scene; } };
})();
