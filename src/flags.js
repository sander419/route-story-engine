/* Флаги и гербы стран (art/flags): реестр, название страны → ISO, загрузка картинок. Общий для «Дневника» и стилей-карт.
   Флаги: flag-icons (MIT) и Wikimedia Commons (общественное достояние) — источники в art/flags/flags.json. Нет страны или файла — null, ничего не рисуется. */
(function () {
  const ART = 'art/';
  let reg = {}, nameMap = null, aliases = null;
  const imgs = new Map();
  const load = (url) => {
    let e = imgs.get(url);
    if (!e) { e = { ok: false, img: null }; e.p = new Promise((res) => { const im = new Image(); im.onload = () => { e.ok = true; e.img = im; res(); }; im.onerror = () => res(); im.src = url; }); imgs.set(url, e); }
    return e;
  };
  const regP = fetch(ART + 'flags/flags.json').then((r) => r.json()).then((j) => { reg = j; }).catch(() => {});
  const aliasP = fetch(ART + 'stickers.json').then((r) => r.json()).then((j) => { aliases = j.countryAliases || {}; }).catch(() => { aliases = {}; });
  const EXTRA = { 'соединённые штаты америки': 'us', 'сша': 'us', 'россия': 'ru', 'великобритания': 'gb', 'соединённое королевство': 'gb', 'чехия': 'cz', 'южная корея': 'kr', 'республика корея': 'kr', 'türkiye': 'tr' };
  const norm = (n) => String(n).trim().toLowerCase().replace(/ё/g, 'е');
  function iso(name) {
    if (!name) return null; const n = norm(name);
    if (aliases) for (const [code, names] of Object.entries(aliases)) if (names.some((x) => norm(x) === n)) return code;
    if (!nameMap) {   // названия на русском и английском от браузера по кодам из реестра
      nameMap = new Map();
      try { for (const lang of ['ru', 'en']) { const dn = new Intl.DisplayNames([lang], { type: 'region' }); for (const c of Object.keys(reg)) { const nm = dn.of(c.toUpperCase()); if (nm) nameMap.set(norm(nm), c); } } } catch (e) { /* без Intl — только список из stickers.json */ }
      for (const [k, v] of Object.entries(EXTRA)) if (reg[v]) nameMap.set(norm(k), v);
    }
    return nameMap.get(n) || null;
  }
  // файлы, которые надо загрузить до первого кадра, для списка названий стран
  async function preload(names) {
    await Promise.all([regP, aliasP]); const out = [];
    for (const nm of names || []) { const c = iso(nm); if (c && reg[c]) Object.values(reg[c]).forEach((x) => out.push(load(ART + x.file).p)); }
    await Promise.all(out);
  }
  const img = (code, kind) => { const f = code && reg[code] && reg[code][kind]; if (!f) return null; const e = load(ART + f.file); return e.ok ? e.img : null; };
  window.Flags = { iso, img, preload, ready: () => Promise.all([regP, aliasP]) };
})();
