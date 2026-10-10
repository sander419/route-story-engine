/* Интерфейс: загрузка → стиль → история → экспорт. */
(function () {
  const $ = (id) => document.getElementById(id);
  const { parseAny, prepare } = window.RouteLib;
  const { createScene, STYLES } = window.RS;

  const state = {
    route: null, styleId: 'night', fmt: 'v',
    o: { title: '', subtitle: '', startName: '', endName: '', duration: 20, showSpeed: true, showEle: true, lang: 'ru', places: [] },
  };
  const touched = {};
  let scene = null, playing = false, t = 0, last = 0, dirty = true, objUrl = null, abort = null;
  const cv = $('cv'), ctx = cv.getContext('2d');

  const SIZES = { v: { hd: [1080, 1920], sd: [720, 1280] }, h: { hd: [1920, 1080], sd: [1280, 720] } };
  const previewSize = () => (state.fmt === 'v' ? [540, 960] : [960, 540]);

  /* ---- шрифты ---- */
  const fontsReady = Promise.all(
    ['700 40px Oswald', '600 40px Oswald', '600 30px Inter', '500 30px Inter', '800 40px "Playfair Display"', '600 30px Lora', '500 30px Lora']
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
      const parsed = parseAny(text, filename);
      const route = prepare(parsed, filename.replace(/\.[^.]+$/, ''));
      state.route = route;
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
      ['s2', 's3', 's4'].forEach((id) => $(id).classList.remove('off'));
      $('empty').style.display = 'none'; cv.style.display = 'block';
      t = 0; rebuild(); play(true);
      state.o.places = []; renderPlaces();
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

  /* ---- превью ---- */
  function rebuild(keepT) {
    if (!state.route) return;
    const [w, h] = previewSize();
    cv.width = w; cv.height = h;
    fontsReady.then(() => {
      scene = createScene(state.route, state.styleId, { ...state.o }, w, h);
      if (!keepT && t > scene.duration) t = 0;
      dirty = true;
    });
  }
  window.RS.setOnTile(() => { dirty = true; });

  function play(on) { playing = on; $('play').textContent = on ? '❚❚' : '▶'; last = performance.now(); }
  $('play').onclick = () => { if (!playing && scene && t >= scene.duration) t = 0; play(!playing); };
  $('scrub').oninput = () => { play(false); t = ($('scrub').value / 1000) * (scene ? scene.duration : 1); dirty = true; };

  function tick(ts) {
    requestAnimationFrame(tick);
    if (!scene) return;
    if (playing) {
      t += (ts - last) / 1000;
      if (t > scene.duration + 1.2) t = 0;
      dirty = true;
    }
    last = ts;
    if (dirty) {
      dirty = false;
      scene.draw(ctx, Math.min(t, scene.duration));
      $('scrub').value = Math.round((Math.min(t, scene.duration) / scene.duration) * 1000);
      const s = Math.floor(Math.min(t, scene.duration));
      $('time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
  }
  requestAnimationFrame(tick);

  /* ---- экспорт ---- */
  $('export').onclick = async () => {
    if (!state.route) return;
    const btn = $('export');
    if (abort) { abort.abort(); return; }
    abort = new AbortController();
    play(false);
    btn.textContent = 'Отменить';
    $('prog').hidden = false; $('result').hidden = true; showErr('');
    const [W, H] = SIZES[state.fmt][$('res').value];
    const o = { ...state.o };
    const styleId = state.styleId, route = state.route;
    try {
      await fontsReady;
      const res = await window.RSExport.exportVideo({
        makeScene: (w, h) => createScene(route, styleId, o, w, h),
        W, H, fps: 30, duration: o.duration, signal: abort.signal,
        onStage: (txt, p) => { $('stage').textContent = `${txt} ${Math.round(p * 100)}%`; $('bar').style.width = p * 100 + '%'; },
      });
      if (objUrl) URL.revokeObjectURL(objUrl);
      objUrl = URL.createObjectURL(res.blob);
      const slug = (o.title || route.name).toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-|-$/g, '') || 'route-story';
      const name = `${slug}-${state.fmt === 'v' ? '9x16' : '16x9'}.${res.ext}`;
      $('result').innerHTML = `<video src="${objUrl}" controls playsinline></video><a href="${objUrl}" download="${name}">Скачать ${name}</a><small>${W}×${H}, ${(res.blob.size / 1048576).toFixed(1)} МБ, ${res.ext.toUpperCase()}</small>`;
      $('result').hidden = false;
      window.__lastExport = { url: objUrl, name, size: res.blob.size, codec: res.codec };
    } catch (e) {
      if (!/Отменено/.test(e.message)) showErr('Экспорт не удался: ' + (e.message || e));
    } finally {
      abort = null; btn.textContent = 'Экспортировать видео'; $('prog').hidden = true;
    }
  };

  window.__app = { state, loadText, rebuild, SIZES, get scene() { return scene; } };
})();
