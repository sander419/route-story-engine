/* Интерфейс: загрузка → стиль → история → экспорт. */
(function () {
  const $ = (id) => document.getElementById(id);
  const { parseAny, prepare } = window.RouteLib;
  const { createScene, STYLES } = window.RS;

  const state = {
    route: null, journeyData: null, seriesBase: null, etype: 'returning-viewer', mode: 'track', styleId: 'paper', fmt: 'v', jcount: 99,
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
  const swatch = { night: 'linear-gradient(135deg,#0a1428,#0d1b36 55%,#ffad42 56%,#ff6b35)', paper: 'linear-gradient(135deg,#efe6d2,#bcd3d6 55%,#e8590c 56%,#b02a0c)', sat: 'linear-gradient(135deg,#1d2b17,#4a5d2f 55%,#fde047 56%,#fb923c)' };
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
  $('note').oninput = () => { state.o.note = $('note').value.trim(); state.demoNote = false; rebuild(true); };   // (в своём путешествии фраза сохраняется вместе с днём при следующей загрузке)
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
    state.o.photos = placed.map((p) => ({ url: p.url, s: p.s, caption: p.caption, credit: p.credit || '' }));
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
  $('file').onchange = (e) => { if (e.target.files.length) handleFiles([...e.target.files]); e.target.value = ''; };
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => e.dataTransfer.files.length && handleFiles([...e.dataTransfer.files]));
  $('demo').onclick = async () => {
    try {
      const r = await fetch('samples/samarkand-bukhara.gpx');
      loadText(await r.text(), 'samarkand-bukhara.gpx'); state.routeIsDemo = true;
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
    try {
      const [a, b] = await Promise.all([one(0), one(route.n - 1)]);
      if (state.route !== route) return;
      if (!touched.startName && a.place) { state.o.startName = a.place; $('startName').value = a.place; }
      if (!touched.endName && !state.demoDay && b.place) { state.o.endName = b.place; $('endName').value = b.place; if (isOwn()) { state.seriesBase = ownToday().J; saveOwn(); } }
      if (!touched.subtitle) {
        const s = a.country && a.country === b.country ? a.country : [a.country, b.country].filter(Boolean).join(' → ');
        state.o.subtitle = s; $('subtitle').value = s;
      }
      route.meta = { ...(route.meta || {}), from: state.demoDay ? null : a.place || null };
      syncDayMeta(route); rebuild(true);
      // серия: места по пути — одним запросом; режиссёр сам выберет до трёх самых значимых
      if (state.mode === 'series') {
        if (state.demoDay) return;
        let done; placesJob = new Promise((r) => { done = r; });
        const wps = await waypointsFor(route, state.o.lang).catch(() => []);
        done(); placesJob = null;
        if (state.route !== route) return;
        route.meta = { ...route.meta, waypoints: wps };
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
  // своё путешествие: найденные «откуда» и места по пути сохраняются в последнем дне
  function syncDayMeta(route) {
    if (!isOwn() || state.route !== route || !route.meta) return;
    const days = [...state.seriesBase.days].sort((x, y) => x.day - y.day), last = days[days.length - 1];
    if (!last) return;
    const upd = { ...last, from: route.meta.from || last.from || null, waypoints: route.meta.waypoints || last.waypoints || [] };
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
    const step = Math.max(1, Math.floor(r.n / 250)), line = [];
    for (let i = 0; i < r.n; i += step) line.push([+r.lon[i].toFixed(5), +r.lat[i].toFixed(5)]);
    line.push([+r.lon[r.n - 1].toFixed(5), +r.lat[r.n - 1].toFixed(5)]);
    const date = r.t ? new Date(r.t[0] + (r.lon[0] / 15) * 3600e3).toISOString().slice(0, 10) : null;
    const seg = { km: Math.round(r.total / 100) / 10, line, date, to: to || null, gain: r.ele ? Math.round(r.stats.gain) : 0, name: r.name || null };
    // факты дня для режиссёра: профиль высоты, высшая точка, время в пути
    if (r.ele) {
      const N = 72, raw = Array.from({ length: N }, (_, k) => window.RouteLib.at(r, (r.total * k) / (N - 1)).ele);
      seg.profile = raw.map((_, k) => { const w = raw.slice(Math.max(0, k - 2), k + 3).sort((a, b) => a - b); return Math.round(w[Math.floor(w.length / 2)]); });
      const mi = r.stats.maxI;
      seg.maxEle = Math.round(r.stats.maxE); seg.minEle = Math.round(r.stats.minE);
      seg.maxAt = [+r.lon[mi].toFixed(5), +r.lat[mi].toFixed(5)]; seg.maxKm = Math.round(r.D[mi] / 1000);
    }
    if (r.t && r.stats.avg) { seg.movingH = Math.round((r.stats.moving / 3.6e6) * 100) / 100; seg.avgKmh = Math.round(r.stats.avg * 10) / 10; }
    if (r.meta) { seg.from = r.meta.from || null; seg.waypoints = r.meta.waypoints || []; }
    // кольцо: финиш рядом со стартом
    seg.loop = window.RouteLib.hav({ lat: r.lat[0], lon: r.lon[0] }, { lat: r.lat[r.n - 1], lon: r.lon[r.n - 1] }) < Math.max(400, r.total * 0.06);
    return seg;
  }
  /* места по пути одним запросом: города и посёлки в коридоре вдоль трека (OSM Overpass); запасной путь — Nominatim по трём точкам */
  async function waypointsFor(route, lang) {
    const N = Math.min(40, route.n), idx = Array.from({ length: N }, (_, k) => Math.round((k * (route.n - 1)) / (N - 1)));
    const km = route.total / 1000, rad = km < 30 ? 2500 : km < 150 ? 5000 : 8000;
    const fracOf = (lat, lon) => { let bi = 0, bd = Infinity; for (let i = 0; i < route.n; i += Math.max(1, Math.floor(route.n / 400))) { const d = window.RouteLib.hav({ lat, lon }, { lat: route.lat[i], lon: route.lon[i] }); if (d < bd) { bd = d; bi = i; } } return { frac: route.D[bi] / route.total, lon: route.lon[bi], lat: route.lat[bi], off: bd }; };
    try {
      const poly = idx.map((i) => route.lat[i].toFixed(4) + ',' + route.lon[i].toFixed(4)).join(',');
      const q = `[out:json][timeout:25];node(around:${rad},${poly})[place~"^(city|town${km < 60 ? '|village' : ''})$"][name];out 80;`;
      const ask = async () => { const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 30000); try { const rs = await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q), { signal: ac.signal }); if (!rs.ok) throw new Error('HTTP ' + rs.status); return await rs.json(); } finally { clearTimeout(tm); } };
      let j; try { j = await ask(); } catch (e1) { await new Promise((r) => setTimeout(r, 2500)); j = await ask(); }
      return (j.elements || []).map((e) => { const f = fracOf(e.lat, e.lon); return { name: e.tags['name:' + lang] || e.tags.name, kind: e.tags.place, pop: +e.tags.population || 0, frac: f.frac, lon: f.lon, lat: f.lat }; });
    } catch (e) {
      const out = [];
      for (const fr of [0.3, 0.5, 0.7]) {
        try {
          const a = window.RouteLib.at(route, route.total * fr), lat = route.lat[a.i], lon = route.lon[a.i];
          const jj = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=${lang}&lat=${lat}&lon=${lon}`)).json(); const ad = jj.address || {};
          const name = ad.city || ad.town || ad.village || '';
          if (name) out.push({ name, kind: ad.city ? 'city' : ad.town ? 'town' : 'village', pop: 0, frac: fr, lon, lat });
        } catch (e2) { /* без сети — без мест */ }
        await new Promise((r) => setTimeout(r, 1100));
      }
      return out;
    }
  }
  function seriesInput() {
    if (isOwn()) return ownToday();
    let J = state.seriesBase, change = null;
    if (state.route && !state.routeIsDemo) {
      const seg = segOf(state.route, state.o.endName), line = seg.line;
      const media = (state.o.photos || []).map((p) => ({ kind: 'photo', url: p.url, caption: p.caption || '', credit: p.credit || '' }));
      const notes = state.o.note ? [{ text: state.o.note }] : [];
      const lastDay = [...J.days].sort((a, b) => a.day - b.day).pop();
      const gapKm = lastDay ? window.RouteLib.hav({ lon: lastDay.line[lastDay.line.length - 1][0], lat: lastDay.line[lastDay.line.length - 1][1] }, { lon: line[0][0], lat: line[0][1] }) / 1000 : 0;
      ({ journey: J, change } = window.Director.addDay(J, seg, media, notes));
      change.gapKm = J.days.length > 1 ? Math.round(gapKm) : 0;
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
    const ownHead = isOwn() ? `<div class="cand">${J.title} · ${S.daysCount} ${S.daysCount % 10 === 1 && S.daysCount % 100 !== 11 ? 'день' : S.daysCount % 10 >= 2 && S.daysCount % 10 <= 4 && (S.daysCount % 100 < 10 || S.daysCount % 100 >= 20) ? 'дня' : 'дней'} · ${fmt(S.totalKm)} км · сохраняется в этом браузере</div>` : '';
    $('change').innerHTML = ownHead + (J.schematic ? `<b>Кругосветка @wahrider</b>${J.days.length} мест по постам · 7 260 км по словам автора` : change
      ? `<b>+${fmt(change.km)} км · День ${change.day}</b><br>${change.media ? change.media + ' фото · ' : ''}${change.notes ? 'заметка · ' : ''}всего ${fmt(change.totalAfter)} км${change.arrival ? ' · прибытие: ' + change.arrival : ''}${change.milestones.length ? ' · веха: ' + change.milestones.map(fmt).join(', ') + ' км' : ''}${change.gapKm > 30 ? `<div class="warn">Этот день начинается в ${fmt(change.gapKm)} км от места, где закончился предыдущий. Это точно продолжение путешествия?</div>` : ''}`
      : `<b>${J.title}</b><br>${S.daysCount} ${S.daysCount % 10 === 1 && S.daysCount % 100 !== 11 ? 'день' : S.daysCount % 10 >= 2 && S.daysCount % 10 <= 4 && (S.daysCount % 100 < 10 || S.daysCount % 100 >= 20) ? 'дня' : 'дней'} · ${fmt(S.totalKm)} км. Добавьте следующий день — свой GPX.`);
    const v = window.Director.validate(res.plan, J);
    $('plan').innerHTML = `<div>${res.plan.episodeType} · ${res.plan.durationSec} с · зерно ${res.plan.seed}${res.plan.fallback ? ' · запасной план: ' + res.plan.fallback : ''}${v.ok ? ' · проверка пройдена' : ' · ошибки: ' + v.errors.join('; ')}</div>` +
      res.log.map((l) => `<div class="beat"><b>${NAMES[l.beat] || l.beat}</b>: ${l.selected || '—'}<div class="cand">${l.candidates.map((c) => `<span class="${c.id === l.selected ? 'sel' : ''}">${c.id} ${c.eligible ? c.total : '✕'}</span>`).join(' · ')}</div><div class="cand">${l.reason}</div></div>`).join('') +
      (res.plan.fitting ? `<div class="cand">длительность: ${res.plan.fitting}</div>` : '') +
      `<div class="cand">в памяти серий: ${(J.episodes || []).length}</div>`;
  }
  async function loadSeries() {
    try {
      state.seriesBase = await (await fetch('data/demo-journey.json')).json();
      state.etype = 'returning-viewer'; $('etype').value = 'returning-viewer';
      if (state.routeIsDemo) { state.route = null; state.routeIsDemo = false; }
      $('info').hidden = false;
      $('info').innerHTML = `<span><b>${state.seriesBase.title}</b> — демо-путешествие</span><span>46 дней · вымышленный путешественник на реальных дорогах</span>`;
      refreshModes(); setMode('series'); play(true);
    } catch (e) { showErr('Не удалось загрузить демо-путешествие: ' + e.message); }
  }
  $('series').onclick = loadSeries;

  /* ---- моё путешествие: свои GPX становятся днями, путешествие хранится в браузере ---- */
  const OWN_KEY = 'route-story-my-journey';
  const isOwn = () => state.seriesBase && state.seriesBase.id === 'my';
  function newOwn(title) { return { id: 'my', title: title || 'Моё путешествие', traveler: '', days: [], media: [], notes: [], checkpoints: [], episodes: [] }; }
  function saveOwn() {
    if (!isOwn()) return;
    const J = state.seriesBase, keep = { ...J, media: [], days: J.days.map((d) => ({ ...d, media: [] })) };   // фото (адреса в памяти браузера) не сохраняются
    try { localStorage.setItem(OWN_KEY, JSON.stringify(keep)); } catch (e) { /* нет места или приватный режим — работаем без сохранения */ }
  }
  function loadOwnSaved() { try { const j = JSON.parse(localStorage.getItem(OWN_KEY) || 'null'); return j && j.id === 'my' && j.days && j.days.length ? j : null; } catch (e) { return null; } }
  // своё путешествие: «сегодня» — последний сохранённый день; текущие фото, фраза и место относятся к нему
  function ownToday() {
    const J = state.seriesBase, days = [...J.days].sort((a, b) => a.day - b.day), last = days[days.length - 1];
    if (!last) return { J, change: null };
    const prev = { ...J, days: days.slice(0, -1), checkpoints: (J.checkpoints || []).filter((c) => c.day < last.day), media: (J.media || []).filter((m) => m.day < last.day), notes: (J.notes || []).filter((n) => n.day < last.day) };
    const media = (state.o.photos || []).map((p) => ({ kind: 'photo', url: p.url, caption: p.caption || '', credit: p.credit || '' }));
    const notes = state.o.note ? [{ text: state.o.note }] : [];
    const pl = days[days.length - 2], gapKm = pl ? window.RouteLib.hav({ lon: pl.line[pl.line.length - 1][0], lat: pl.line[pl.line.length - 1][1] }, { lon: last.line[0][0], lat: last.line[0][1] }) / 1000 : 0;
    const res = window.Director.addDay(prev, { ...last, to: state.o.endName || last.to || null }, media, notes);
    res.change.gapKm = Math.round(gapKm);
    return { J: res.journey, change: res.change };
  }
  function bakeToday() { if (isOwn() && state.seriesBase.days.length) { state.seriesBase = ownToday().J; photoFiles = []; state.o.photos = []; renderPhotos(); state.o.note = ''; $('note').value = ''; state.o.endName = ''; $('endName').value = ''; touched.endName = false; } }
  /* один файл на несколько дней → отдельные дни по местной дате (если в файле есть время) */
  function splitDays(parsed) {
    const pts = parsed.pts.filter((q) => isFinite(q.lat) && isFinite(q.lon));
    if (pts.filter((q) => isFinite(q.t)).length < pts.length * 0.9) return [];
    const groups = new Map(); let lastKey = null;
    for (const q of pts) { const key = isFinite(q.t) ? Math.floor((q.t + (q.lon / 15) * 3600e3) / 864e5) : lastKey; if (key == null) continue; lastKey = key; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(q); }
    const out = [...groups.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]).filter((g) => g.length >= 2);
    return out.length >= 2 && out.length <= 120 ? out : [];
  }
  /* названия концов дней — чтобы у пересказа пути были вехи (Nominatim, не чаще 1 запроса в секунду, не больше 8 дней) */
  async function nameDays() {
    if (!isOwn()) return;
    const days = [...state.seriesBase.days].sort((a, b) => a.day - b.day);
    if (days.length < 2) return;
    const need = days.slice(0, -1).filter((d) => !d.to), n = Math.min(8, need.length), pick = Array.from({ length: n }, (_, i) => need[Math.round((i * (need.length - 1)) / Math.max(1, n - 1))]);
    const rev = async (lon, lat) => { const j = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&accept-language=${state.o.lang}&lat=${lat}&lon=${lon}`)).json(); const a = j.address || {}; return a.city || a.town || a.village || a.municipality || a.county || ''; };
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
  async function handleFiles(files) {
    showErr('');
    if (state.mode === 'track') { readFile(files[0]); return; }
    const got = []; let multi = 0;
    for (const f of files) {
      try {
        const tx = await f.text(), nm = f.name.replace(/\.[^.]+$/, ''), parsed = parseAny(tx, f.name);
        const parts = splitDays(parsed);
        if (parts.length >= 2) { parts.forEach((pts, i) => { try { got.push({ r: prepare({ name: parsed.name, pts }, nm), name: f.name + '#' + String(i).padStart(3, '0') }); } catch (e) { /* слишком короткий кусок дня */ } }); multi = Math.max(multi, parts.length); }
        else got.push({ r: prepare(parsed, nm), name: f.name });
      }
      catch (e) { showErr(`${f.name}: ${e.message || e}`); }
    }
    if (!got.length) return;
    got.sort((a, b) => (a.r.t && b.r.t ? a.r.t[0] - b.r.t[0] : a.name.localeCompare(b.name, 'ru', { numeric: true })));
    // свой трек начинает (или продолжает) своё путешествие — не клеится к демо
    if (!isOwn()) { state.seriesBase = loadOwnSaved() || newOwn(); state.route = null; }
    else bakeToday();
    if (state.demoDay || state.demoNote) { photoFiles = photoFiles.filter((p) => !p.demo); if (state.demoNote) { state.o.note = ''; $('note').value = ''; } state.demoDay = false; state.demoNote = false; }
    got.forEach((g) => { state.seriesBase = window.Director.addDay(state.seriesBase, segOf(g.r, null), [], []).journey; });   // каждый файл — сохранённый день
    const last = got[got.length - 1];
    state.route = last.r; state.routeIsDemo = false;
    // многодневный файл: зрителю сначала нужен весь путь, потом последний день
    state.etype = multi >= 3 ? 'new-viewer' : 'returning-viewer'; $('etype').value = state.etype;
    if (!touched.endName) { state.o.endName = ''; $('endName').value = ''; }
    saveOwn(); nameDays(); placePhotos(); refreshModes(); setMode('series'); play(true);
    $('continue').hidden = true;
    geocode(last.r);
  }
  $('continue').onclick = () => {
    const J = loadOwnSaved(); if (!J) return;
    state.seriesBase = J; state.route = null; state.routeIsDemo = false; state.demoDay = false;
    photoFiles = []; state.o.photos = []; renderPhotos(); state.o.note = ''; $('note').value = ''; state.demoNote = false;
    state.o.endName = ''; $('endName').value = ''; touched.endName = false;
    state.etype = 'story-so-far'; $('etype').value = 'story-so-far';
    $('continue').hidden = true; refreshModes(); setMode('series'); play(true);
  };
  $('resetOwn').onclick = () => { try { localStorage.removeItem(OWN_KEY); } catch (e) {} $('continue').hidden = true; if (isOwn()) loadSeries().then(() => $('day47').click()); };
  { const J = loadOwnSaved(); if (J) { $('continue').hidden = false; $('continue').textContent = `Продолжить моё путешествие · ${J.days.length} ${J.days.length % 10 === 1 && J.days.length % 100 !== 11 ? 'день' : J.days.length % 10 >= 2 && J.days.length % 10 <= 4 && (J.days.length % 100 < 10 || J.days.length % 100 >= 20) ? 'дня' : 'дней'}`; } }
  $('day47').onclick = async () => {
    try {
      if (!state.seriesBase || state.seriesBase.schematic || state.mode !== 'series') await loadSeries();   // демо-день 47 — только к демо-путешествию, не к кругосветке героя
      const tx = await (await fetch('samples/day47.gpx')).text(); loadText(tx, 'day47.gpx');
      // демо-фото (Wikimedia Commons, CC BY-SA 4.0), заметка и место — помечены как демо: свой GPX их уберёт
      state.demoDay = true;
      if (!touched.endName) { state.o.endName = 'Байкал'; $('endName').value = 'Байкал'; }
      if (!photoFiles.length) { const cr = 'Фото: Thomas D. Fischer · CC BY-SA 4.0 · Wikimedia Commons'; photoFiles = [{ name: 'baikal-1.jpg', url: 'media/demo/baikal-1.jpg', meta: {}, caption: 'Первый вид на Байкал', credit: cr, demo: true }, { name: 'baikal-2.jpg', url: 'media/demo/baikal-2.jpg', meta: {}, caption: 'Берег у Листвянки', credit: cr, demo: true }]; }
      if (!state.o.note) { state.o.note = 'Изнурительно, но весело'; $('note').value = state.o.note; state.demoNote = true; }
      placePhotos(); }
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
    try {
      const d = await (await fetch('data/journey-wahrider.json')).json();
      state.seriesBase = heroJourney(d); state.route = null; state.routeIsDemo = false;
      state.etype = 'story-so-far'; $('etype').value = 'story-so-far';
      $('info').hidden = false; $('info').innerHTML = '<span><b>Кругосветка @wahrider</b> — трейлер по постам канала</span>';
      refreshModes(); setMode('series'); play(true);
    }
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
      syncAudio();
    });
  }
  window.RS.setOnTile(() => { dirty = true; });
  window.VMap.setOnTile(() => { dirty = true; });

  /* ---- звук ---- */
  state.music = 'builtin'; let musicFileBuf = null, audioKey = '', audioBuf = null, audioJob = null;
  async function audioFor(sc) {
    if (!sc || state.music === 'none' || !window.RSAudio) return null;
    const cues = (sc.plan ? sc.plan.beats : []).map((b) => ({ t: b.startSec, recipe: b.recipe, dur: b.durationSec }));
    const key = state.music + '|' + sc.duration + '|' + cues.map((c) => c.recipe + c.t).join(',') + '|' + (musicFileBuf ? musicFileBuf.byteLength : 0);
    if (key === audioKey && audioBuf) return audioBuf;
    if (state.music === 'own') { if (!musicFileBuf) return null; audioBuf = await window.RSAudio.fromFile(musicFileBuf, sc.duration); }
    else audioBuf = await window.RSAudio.compose(sc.duration, cues);
    audioKey = key; return audioBuf;
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

  function play(on) { playing = on; $('play').textContent = on ? '❚❚' : '▶'; last = performance.now(); syncAudio(); }
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
  let layerUrls = [];
  $('export').onclick = async () => {
    if (!ready()) return;
    const btn = $('export');
    if (abort) { abort.abort(); return; }
    abort = new AbortController();
    play(false);
    btn.textContent = 'Отменить';
    $('prog').hidden = false; $('result').hidden = true; showErr('');
    const [W, H] = SIZES[state.fmt][$('res').value];
    const o = { ...state.o };
    const route = state.route || { name: (state.journeyData || state.seriesBase || {}).title || 'route-story' };
    try {
      if (state.mode === 'series' && placesJob) { $('stage').textContent = 'Ищу города по пути…'; $('bar').style.width = '2%'; await Promise.race([placesJob, new Promise((r) => setTimeout(r, 32000))]); }
      const dur = buildScene(W, H).duration;
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
      const audio = await audioFor(buildScene(W, H)).catch(() => null);
      const res = await window.RSExport.exportVideo({ audio,
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
      abort = null; btn.textContent = exportLabel(); $('prog').hidden = true;
    }
  };

  // открыли страницу — сразу играет демо-серия «День 47» (своим GPX её можно заменить)
  (async () => { await loadSeries(); $('day47').click(); })();

  window.__app = { loadSeries, state, loadText, loadJourney, setMode, rebuild, buildScene, SIZES, get scene() { return scene; } };
})();
