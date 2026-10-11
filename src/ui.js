/* Интерфейс: загрузка → стиль → история → экспорт. */
(function () {
  const $ = (id) => document.getElementById(id);
  const { parseAny, prepare } = window.RouteLib;
  const { createScene, STYLES } = window.RS;

  const state = {
    route: null, journeyData: null, seriesBase: null, etype: 'returning-viewer', mode: 'track', styleId: 'night', fmt: 'v', jcount: 99,
    o: { title: '', subtitle: '', startName: '', endName: '', duration: 20, showSpeed: true, showEle: true, lang: 'ru', places: [], note: '', photos: [] },
  };
  const touched = {};
  let scene = null, playing = false, t = 0, last = 0, dirty = true, objUrl = null, abort = null;
  const cv = $('cv'), ctx = cv.getContext('2d');

  const SIZES = { v: { hd: [1080, 1920], sd: [720, 1280] }, h: { hd: [1920, 1080], sd: [1280, 720] } };
  const previewSize = () => (state.fmt === 'v' ? [540, 960] : [960, 540]);

  /* ---- шрифты ---- */
  const fontsReady = Promise.all(
    ['700 40px Caveat', '700 40px Oswald', '600 40px Oswald', '600 30px Inter', '500 30px Inter', '800 40px "Playfair Display"', '600 30px Lora', '500 30px Lora']
      .map((f) => document.fonts.load(f, 'АаЯя Aa 0123').catch(() => {}))
  ).then(() => document.fonts.ready).catch(() => {});

  /* ---- стили ---- */
  const swatch = { night: 'linear-gradient(135deg,#0b0f14,#1e293b 55%,#22d3ee 56%,#fb7185)', paper: 'linear-gradient(135deg,#e9dcc0,#d8c394 55%,#9a3412 56%,#7c2d12)', sat: 'linear-gradient(135deg,#1d2b17,#4a5d2f 55%,#fde047 56%,#fb923c)' };
  Object.entries(STYLES).forEach(([id, s]) => {
    const b = document.createElement('button');
    b.dataset.id = id; b.className = id === state.styleId ? 'on' : '';
    b.innerHTML = `<div class="sw" style="background:${swatch[id]}"></div><span>${s.name}</span>`;
    b.onclick = () => { state.styleId = id; [...$('styles').children].forEach((x) => x.classList.toggle('on', x === b)); rebuild(); };
    $('styles').appendChild(b);
  });

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
  $('note').oninput = () => { state.o.note = $('note').value.trim(); rebuild(true); };
  $('photos').onchange = async (e) => {
    const files = [...e.target.files].slice(0, Math.max(0, 4 - photoFiles.length));
    for (const f of files) {
      const meta = window.Exif.readExif(await f.arrayBuffer());
      const url = URL.createObjectURL(f);
      const ok = await new Promise((r) => { const im = new Image(); im.onload = () => r(true); im.onerror = () => r(false); im.src = url; });
      if (!ok) { showErr(`«${f.name}»: браузер не может открыть этот формат (часто это HEIC с iPhone). Сохраните фото как JPEG.`); URL.revokeObjectURL(url); continue; }
      photoFiles.push({ name: f.name, url, meta, caption: '' });
    }
    e.target.value = '';
    placePhotos();
  };
  function placePhotos() {
    const r = state.route;
    if (!r) { state.o.photos = []; renderPhotos(); return; }
    const placed = photoFiles.map((p, i) => { const pl = window.Exif.placeOnRoute(r, p.meta, i, photoFiles.length); p.how = pl.how; p.s = pl.s; return p; });
    const ev = placed.filter((p) => p.how === 'even');
    ev.forEach((p, k) => { p.s = (r.total * (k + 1)) / (ev.length + 1); });
    state.o.photos = placed.map((p) => ({ url: p.url, s: p.s, caption: p.caption }));
    renderPhotos(); rebuild(true);
  }
  function renderPhotos() {
    const box = $('photoList'); box.innerHTML = '';
    const how = { gps: 'по GPS из фото', time: 'по времени съёмки', even: 'по порядку' };
    photoFiles.forEach((p, i) => {
      const row = document.createElement('div'); row.className = 'phrow';
      const img = document.createElement('img'); img.src = p.url; img.alt = '';
      const mid = document.createElement('div');
      const inp = document.createElement('input'); inp.placeholder = 'Подпись (необязательно)'; inp.maxLength = 40; inp.value = p.caption;
      inp.oninput = () => { p.caption = inp.value; state.o.photos[i] && (state.o.photos[i].caption = inp.value); rebuild(true); };
      const sm = document.createElement('small'); sm.textContent = state.route && p.s != null ? `${how[p.how] || ''} · ${(p.s / 1000).toFixed(1)} км` : '';
      mid.append(inp, sm);
      const del = document.createElement('button'); del.textContent = '×'; del.title = 'Убрать фото';
      del.onclick = () => { URL.revokeObjectURL(p.url); photoFiles.splice(i, 1); placePhotos(); };
      row.append(img, mid, del); box.appendChild(row);
    });
  }

  /* ---- загрузка ---- */
  const drop = $('drop');
  $('file').onchange = (e) => e.target.files[0] && readFile(e.target.files[0]);
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => e.dataTransfer.files[0] && readFile(e.dataTransfer.files[0]));
  $('demo').onclick = async () => {
    try {
      const r = await fetch('samples/samarkand-bukhara.gpx');
      loadText(await r.text(), 'samarkand-bukhara.gpx');
    } catch (e) { showErr('Не удалось загрузить демо: ' + e.message); }
  };
  function readFile(f) { f.text().then((tx) => loadText(tx, f.name)).catch((e) => showErr(e.message)); }

  function showErr(m) { $('err').textContent = m; $('err').hidden = !m; }

  function loadText(text, filename) {
    showErr('');
    try {
      if (text.trimStart().startsWith('{')) { const j = JSON.parse(text); if (Array.isArray(j.stops) && j.stops.length > 1 && j.stops[0].lat != null) { loadJourney(j); return; } }
      const parsed = parseAny(text, filename);
      const route = prepare(parsed, filename.replace(/\.[^.]+$/, ''));
      state.route = route;
      state.routeIsDemo = /samarkand-bukhara/.test(filename);
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
      const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=${state.o.lang}&lat=${route.lat[i]}&lon=${route.lon[i]}`;
      const j = await (await fetch(u)).json(); const a = j.address || {};
      return { place: a.city || a.town || a.village || a.municipality || a.county || a.state || '', country: a.country || '' };
    };
    try {
      const [a, b] = await Promise.all([one(0), one(route.n - 1)]);
      if (state.route !== route) return;
      if (!touched.startName && a.place) { state.o.startName = a.place; $('startName').value = a.place; }
      if (!touched.endName && b.place) { state.o.endName = b.place; $('endName').value = b.place; }
      if (!touched.subtitle) {
        const s = a.country && a.country === b.country ? a.country : [a.country, b.country].filter(Boolean).join(' → ');
        state.o.subtitle = s; $('subtitle').value = s;
      }
      rebuild(true);
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
  function seriesInput() {
    let J = state.seriesBase, change = null;
    if (state.route) {
      const r = state.route, step = Math.max(1, Math.floor(r.n / 250)), line = [];
      for (let i = 0; i < r.n; i += step) line.push([r.lon[i], r.lat[i]]);
      line.push([r.lon[r.n - 1], r.lat[r.n - 1]]);
      const date = r.t ? new Date(r.t[0] + (r.lon[0] / 15) * 3600e3).toISOString().slice(0, 10) : null;
      const seg = { km: Math.round(r.total / 100) / 10, line, date, to: state.o.endName || null, gain: r.ele ? Math.round(r.stats.gain) : 0 };
      const media = (state.o.photos || []).map((p) => ({ kind: 'photo', url: p.url, caption: p.caption || '' }));
      const notes = state.o.note ? [{ text: state.o.note }] : [];
      ({ journey: J, change } = window.Director.addDay(J, seg, media, notes));
    }
    return { J, change };
  }
  function buildEpisode(w, h) {
    const { J, change } = seriesInput();
    const res = window.Director.direct(J, state.etype, { aspect: state.fmt === 'v' ? '9:16' : '16:9' });
    state.lastEp = { res, change, J };
    renderSeriesPanel(res, change, J);
    return window.Episode.createEpisodeScene({ journey: J, plan: res.plan, styleId: state.styleId, lang: state.o.lang }, w, h);
  }
  const NAMES = { hook: 'завязка', context: 'контекст', 'new-leg': 'новый участок', achievement: 'достижение', moment: 'момент', proof: 'доказательство', outro: 'финал' };
  function renderSeriesPanel(res, change, J) {
    const S = window.Director.summarize(J), fmt = (v) => Math.round(v).toLocaleString('ru-RU');
    $('change').innerHTML = change
      ? `<b>+${fmt(change.km)} км · День ${change.day}</b><br>${change.media ? change.media + ' фото · ' : ''}${change.notes ? 'заметка · ' : ''}всего ${fmt(change.totalAfter)} км${change.arrival ? ' · прибытие: ' + change.arrival : ''}${change.milestones.length ? ' · веха: ' + change.milestones.map(fmt).join(', ') + ' км' : ''}`
      : `<b>${J.title}</b><br>${S.daysCount} дней · ${fmt(S.totalKm)} км. Добавьте новый день: свой GPX или демо-день 47.`;
    const v = window.Director.validate(res.plan, J);
    $('plan').innerHTML = `<div>${res.plan.episodeType} · ${res.plan.durationSec} с · зерно ${res.plan.seed}${res.plan.fallback ? ' · запасной план: ' + res.plan.fallback : ''}${v.ok ? ' · проверка пройдена' : ' · ошибки: ' + v.errors.join('; ')}</div>` +
      res.log.map((l) => `<div class="beat"><b>${NAMES[l.beat] || l.beat}</b>: ${l.selected || '—'}<div class="cand">${l.candidates.map((c) => `<span class="${c.id === l.selected ? 'sel' : ''}">${c.id} ${c.eligible ? c.total : '✕'}</span>`).join(' · ')}</div><div class="cand">${l.reason}</div></div>`).join('') +
      (res.plan.fitting ? `<div class="cand">длительность: ${res.plan.fitting}</div>` : '') +
      `<div class="cand">в памяти серий: ${(J.episodes || []).length}</div>`;
  }
  async function loadSeries() {
    try {
      state.seriesBase = await (await fetch('data/demo-journey.json')).json();
      if (state.routeIsDemo) { state.route = null; state.routeIsDemo = false; }
      $('info').hidden = false;
      $('info').innerHTML = `<span><b>${state.seriesBase.title}</b> — демо-путешествие</span><span>46 дней · вымышленный путешественник на реальных дорогах</span>`;
      refreshModes(); setMode('series'); play(true);
    } catch (e) { showErr('Не удалось загрузить демо-путешествие: ' + e.message); }
  }
  $('series').onclick = loadSeries;
  $('day47').onclick = async () => {
    try { const tx = await (await fetch('samples/day47.gpx')).text(); loadText(tx, 'day47.gpx'); if (!touched.endName) { touched.endName = true; state.o.endName = 'Байкал'; $('endName').value = 'Байкал'; rebuild(true); } }
    catch (e) { showErr('Не удалось загрузить день 47: ' + e.message); }
  };
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
  function ready() { if (state.mode === 'series') return !!state.seriesBase; return state.mode === 'journey' ? !!state.journeyData : state.mode === 'both' ? !!(state.journeyData && state.route) : !!state.route; }

  function setMode(m) {
    state.mode = m;
    [...$('mode').children].forEach((b) => b.classList.toggle('on', b.dataset.v === m));
    $('jdurBox').hidden = m === 'track' || m === 'series';
    $('seriesBox').hidden = m !== 'series';
    t = 0; rebuild();
  }
  $('export2').onclick = () => $('export').click();
  function refreshModes() {
    const hasR = !!state.route, hasJ = !!state.journeyData;
    $('mode').hidden = !(hasJ || state.seriesBase);
    [...$('mode').children].forEach((b) => { b.disabled = (b.dataset.v === 'track' && !hasR) || (b.dataset.v === 'both' && !(hasR && hasJ)) || (b.dataset.v === 'journey' && !hasJ) || (b.dataset.v === 'series' && !state.seriesBase); });
    ['s2', 's3', 's4'].forEach((id) => $(id).classList.remove('off'));
    $('export2').disabled = false;
    $('empty').style.display = 'none'; cv.style.display = 'block';
  }
  [...$('mode').children].forEach((b) => (b.onclick = () => setMode(b.dataset.v)));
  $('jdur').onchange = () => { state.jcount = +$('jdur').value; t = 0; rebuild(); };

  async function loadJourney(data, label) {
    state.journeyData = data;
    // демо-трек не относится к истории героя: не подмешиваем его в «Путь + трек дня»
    if (state.routeIsDemo) { state.route = null; state.routeIsDemo = false; }
    $('info').hidden = false;
    $('info').innerHTML = `<span><b>${data.title}</b></span><span>Остановок: <b>${data.stops.length}</b> · пунктир — схема по постам, не GPS</span>`;
    refreshModes();
    state.mode = state.route ? 'both' : 'journey';
    setMode(state.mode); play(true);
  }
  $('wj').onclick = async () => {
    try { loadJourney(await (await fetch('data/journey-wahrider.json')).json()); }
    catch (e) { showErr('Не удалось загрузить путь: ' + e.message); }
  };

  /* ---- превью ---- */
  function rebuild(keepT) {
    if (!ready()) return;
    const [w, h] = previewSize();
    cv.width = w; cv.height = h;
    fontsReady.then(() => {
      scene = buildScene(w, h);
      if (!keepT && t > scene.duration) t = 0;
      dirty = true;
    });
  }
  window.RS.setOnTile(() => { dirty = true; });
  window.VMap.setOnTile(() => { dirty = true; });

  function play(on) { playing = on; $('play').textContent = on ? '❚❚' : '▶'; last = performance.now(); }
  $('play').onclick = () => { if (!playing && scene && t >= scene.duration) t = 0; play(!playing); };
  $('scrub').oninput = () => { play(false); t = ($('scrub').value / 1000) * (scene ? scene.duration : 1); dirty = true; };

  const clampT = (x) => Math.max(0, Math.min(x, scene.duration));
  function tick(ts) {
    requestAnimationFrame(tick);
    if (!scene) return;
    if (playing) {
      t += Math.max(0, ts - last) / 1000;
      if (t > scene.duration + 1.2) t = 0;
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
  const exportLabel = () => (state.xmode === 'layers' ? 'Экспортировать слои' : 'Экспортировать видео');
  [...$('xmode').children].forEach((b) => (b.onclick = () => {
    state.xmode = b.dataset.v;
    [...$('xmode').children].forEach((x) => x.classList.toggle('on', x === b));
    $('layersBox').hidden = state.xmode !== 'layers';
    $('export').textContent = exportLabel();
  }));
  let layerUrls = [];
  $('export').onclick = async () => {
    if (!ready()) return;
    const btn = $('export');
    if (abort) { abort.abort(); return; }
    abort = new AbortController();
    play(false);
    btn.textContent = 'Отменить'; $('export2').textContent = 'Отмена';
    $('prog').hidden = false; $('result').hidden = true; showErr('');
    const [W, H] = SIZES[state.fmt][$('res').value];
    const o = { ...state.o };
    const route = state.route || { name: (state.journeyData || state.seriesBase || {}).title || 'route-story' };
    const dur = buildScene(W, H).duration;
    try {
      await fontsReady;
      const slug0 = (state.mode === 'series' && state.lastEp ? `${state.seriesBase.title} день ${state.lastEp.res.plan.episodeNumber} ${state.etype}` : state.mode === 'journey' ? state.journeyData.title : (o.title || route.name)).toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-|-$/g, '') || 'route-story';
      const sz = state.fmt === 'v' ? '9x16' : '16x9';
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
            onStage: (txt, p) => { const pp = (gi + p) / groups.length; $('stage').textContent = `${groups.length > 1 ? '[' + (gi + 1) + '/' + groups.length + '] ' : ''}${txt} ${Math.round(p * 100)}%`; $('bar').style.width = pp * 100 + '%'; },
          });
          const url = URL.createObjectURL(lr.blob); layerUrls.push(url);
          links.push({ url, nm: `${slug0}-${g.id}-${sz}-${fmt === 'png' ? 'png' : 'alpha'}.${lr.ext}`, size: lr.blob.size, ext: lr.ext, frames: lr.frames });
        }
        $('result').innerHTML = links.map((l) => (l.ext === 'webm' ? `<video class="chk" src="${l.url}" controls loop muted playsinline></video>` : '') + `<a href="${l.url}" download="${l.nm}">Скачать ${l.nm}</a><small>${W}×${H} · ${(l.size / 1048576).toFixed(1)} МБ</small>`).join('') + '<small>Фон прозрачный. Положите слои поверх своих фото и видео в любом редакторе.</small>';
        $('result').hidden = false;
        window.__lastLayers = links;
        return;
      }
      const res = await window.RSExport.exportVideo({
        makeScene: (w, h) => buildScene(w, h),
        W, H, fps: 30, duration: dur, signal: abort.signal,
        onStage: (txt, p) => { $('stage').textContent = `${txt} ${Math.round(p * 100)}%`; $('bar').style.width = p * 100 + '%'; },
      });
      if (objUrl) URL.revokeObjectURL(objUrl);
      objUrl = URL.createObjectURL(res.blob);
      const slug = slug0;
      const name = `${slug}-${state.fmt === 'v' ? '9x16' : '16x9'}.${res.ext}`;
      $('result').innerHTML = `<video src="${objUrl}" controls playsinline></video><a href="${objUrl}" download="${name}">Скачать ${name}</a><small>${W}×${H}, ${(res.blob.size / 1048576).toFixed(1)} МБ, ${res.ext.toUpperCase()}</small>`;
      $('result').hidden = false;
      window.__lastExport = { url: objUrl, name, size: res.blob.size, codec: res.codec };
    } catch (e) {
      if (!/Отменено/.test(e.message)) showErr('Экспорт не удался: ' + (e.message || e));
    } finally {
      abort = null; btn.textContent = exportLabel(); $('export2').textContent = 'Экспорт'; $('prog').hidden = true;
    }
  };

  window.__app = { loadSeries, state, loadText, loadJourney, setMode, rebuild, buildScene, SIZES, get scene() { return scene; } };
})();
