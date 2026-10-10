/* Разбор GPX / GeoJSON / CSV и подготовка трека к анимации. */
(function () {
  const rad = (x) => (x * Math.PI) / 180;
  function hav(a, b) {
    const R = 6371008.8;
    const dl = rad(b.lat - a.lat), dn = rad(b.lon - a.lon);
    const h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dn / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function parseTime(v) {
    if (v == null || v === '') return NaN;
    if (typeof v === 'number') return v > 1e11 ? v : v * 1000;
    v = String(v).trim();
    if (/^\d+(\.\d+)?$/.test(v)) { const n = +v; return n > 1e11 ? n : n * 1000; }
    return Date.parse(v);
  }

  function parseGPX(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Файл GPX повреждён или это не GPX.');
    let nodes = [...doc.getElementsByTagName('trkpt')];
    if (!nodes.length) nodes = [...doc.getElementsByTagName('rtept')];
    if (!nodes.length) nodes = [...doc.getElementsByTagName('wpt')];
    const child = (n, tag) => { const c = n.getElementsByTagName(tag)[0]; return c ? c.textContent : null; };
    const pts = nodes.map((n) => ({
      lat: +n.getAttribute('lat'),
      lon: +n.getAttribute('lon'),
      ele: child(n, 'ele') != null ? +child(n, 'ele') : NaN,
      t: parseTime(child(n, 'time')),
    }));
    const nm = doc.querySelector('trk > name') || doc.querySelector('metadata > name') || doc.querySelector('rte > name');
    return { name: nm ? nm.textContent.trim() : '', pts };
  }

  function parseGeoJSON(obj) {
    const pts = [];
    let name = '';
    const addLine = (coords, times) => {
      coords.forEach((c, i) => pts.push({
        lon: +c[0], lat: +c[1],
        ele: c.length > 2 && c[2] != null ? +c[2] : NaN,
        t: times && times[i] != null ? parseTime(times[i]) : NaN,
      }));
    };
    (function walk(o, props) {
      if (!o) return;
      if (o.type === 'FeatureCollection') o.features.forEach((f) => walk(f));
      else if (o.type === 'Feature') {
        if (!name && o.properties && (o.properties.name || o.properties.title)) name = o.properties.name || o.properties.title;
        walk(o.geometry, o.properties);
      } else if (o.type === 'GeometryCollection') o.geometries.forEach((g) => walk(g, props));
      else if (o.type === 'LineString') addLine(o.coordinates, props && (props.coordTimes || props.times));
      else if (o.type === 'MultiLineString') {
        const ct = props && (props.coordTimes || props.times);
        o.coordinates.forEach((c, i) => addLine(c, ct && Array.isArray(ct[i]) ? ct[i] : (ct && !Array.isArray(ct[0]) ? ct : null)));
      }
    })(obj);
    return { name: String(name || ''), pts };
  }

  function parseCSV(text) {
    const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new Error('В CSV слишком мало строк.');
    const delim = [',', ';', '\t'].map((d) => [d, lines[0].split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const cells = (l) => l.split(delim).map((s) => s.trim().replace(/^"|"$/g, ''));
    const head = cells(lines[0]).map((h) => h.toLowerCase());
    const hasHead = head.some((h) => /lat|lon|lng|широт|долг/.test(h));
    const find = (re, dflt) => { const i = head.findIndex((h) => re.test(h)); return hasHead ? i : dflt; };
    const idx = {
      lat: find(/^(lat|latitude|широта)/, 0),
      lon: find(/^(lon|lng|long|longitude|долгота)/, 1),
      ele: find(/^(ele|alt|elevation|height|высота)/, 2),
      t: find(/^(time|timestamp|date|datetime|время|дата)/, 3),
    };
    if (idx.lat < 0 || idx.lon < 0) throw new Error('В CSV не нашёл колонки lat / lon.');
    const num = (s) => (s == null || s === '' ? NaN : +String(s).replace(',', '.'));
    const pts = lines.slice(hasHead ? 1 : 0).map((l) => {
      const c = cells(l);
      let lat = num(c[idx.lat]), lon = num(c[idx.lon]);
      if (Math.abs(lat) > 90 && Math.abs(lon) <= 90) [lat, lon] = [lon, lat];
      return { lat, lon, ele: idx.ele >= 0 ? num(c[idx.ele]) : NaN, t: idx.t >= 0 ? parseTime(c[idx.t]) : NaN };
    });
    return { name: '', pts };
  }

  function parseAny(text, filename) {
    const f = (filename || '').toLowerCase();
    const s = text.trimStart();
    if (s.startsWith('<')) return parseGPX(text);
    if (s.startsWith('{') || s.startsWith('[')) return parseGeoJSON(JSON.parse(text));
    if (/\.(csv|txt|tsv)$/.test(f) || /[,;\t]/.test(s.split('\n')[0])) return parseCSV(text);
    throw new Error('Не знаю этот формат. Нужен GPX, GeoJSON или CSV.');
  }

  const px = (lon) => ((lon + 180) / 360) * 256;
  const py = (lat) => {
    const s = Math.sin(rad(Math.max(-85.05, Math.min(85.05, lat))));
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256;
  };

  function prepare(parsed, fallbackName) {
    let p = parsed.pts.filter((q) => isFinite(q.lat) && isFinite(q.lon) && Math.abs(q.lat) <= 90 && Math.abs(q.lon) <= 180 && !(q.lat === 0 && q.lon === 0));
    // убираем подряд идущие дубли
    p = p.filter((q, i) => i === 0 || q.lat !== p[i - 1].lat || q.lon !== p[i - 1].lon);
    if (p.length < 2) throw new Error('В файле меньше двух точек маршрута.');
    // накопленная дистанция
    let d = 0;
    p[0].d = 0;
    for (let i = 1; i < p.length; i++) { d += hav(p[i - 1], p[i]); p[i].d = d; }
    if (d < 50) throw new Error('Маршрут короче 50 метров — нечего анимировать.');
    // прореживание до ~1800 точек (ровно по дистанции)
    if (p.length > 1800) {
      const step = d / 1700; let next = 0; const q = [];
      p.forEach((pt, i) => { if (i === 0 || i === p.length - 1 || pt.d >= next) { q.push(pt); next = pt.d + step; } });
      p = q;
    }
    // время: годится, только если оно у почти всех точек и растёт
    const withT = p.filter((q) => isFinite(q.t)).length;
    let hasT = withT >= p.length * 0.9;
    if (hasT) {
      let last = -Infinity;
      for (const q of p) { if (!isFinite(q.t)) q.t = last; if (q.t < last) q.t = last; last = q.t; }
      hasT = p[p.length - 1].t > p[0].t;
    }
    const hasE = p.filter((q) => isFinite(q.ele)).length >= p.length * 0.9;
    let ele = null;
    if (hasE) {
      const raw = p.map((q) => (isFinite(q.ele) ? q.ele : NaN));
      for (let i = 0; i < raw.length; i++) if (!isFinite(raw[i])) raw[i] = raw[i - 1] ?? raw.find(isFinite);
      ele = raw.map((_, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - 3); j <= Math.min(raw.length - 1, i + 3); j++) { s += raw[j]; n++; } return s / n; });
    }
    // скорость (км/ч): окно ±4 точки
    let speed = null;
    if (hasT) {
      speed = p.map((_, i) => {
        const a = Math.max(0, i - 4), b = Math.min(p.length - 1, i + 4);
        const dt = (p[b].t - p[a].t) / 1000;
        return dt > 0 ? Math.min(80, ((p[b].d - p[a].d) / dt) * 3.6) : 0;
      });
    }
    const X = new Float64Array(p.length), Y = new Float64Array(p.length), D = new Float64Array(p.length);
    p.forEach((q, i) => { X[i] = px(q.lon); Y[i] = py(q.lat); D[i] = q.d; });
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (let i = 0; i < p.length; i++) { bx0 = Math.min(bx0, X[i]); bx1 = Math.max(bx1, X[i]); by0 = Math.min(by0, Y[i]); by1 = Math.max(by1, Y[i]); }
    const total = D[D.length - 1];
    let gain = 0, maxE = -Infinity, maxI = 0, minE = Infinity;
    if (ele) {
      let ref = ele[0];
      ele.forEach((e, i) => { if (e - ref > 3) { gain += e - ref; ref = e; } else if (ref - e > 3) ref = e; if (e > maxE) { maxE = e; maxI = i; } if (e < minE) minE = e; });
    }
    let moving = 0;
    if (hasT) for (let i = 1; i < p.length; i++) { const dt = p[i].t - p[i - 1].t; if (dt < 600000) moving += dt; }
    const route = {
      name: parsed.name || fallbackName || 'Маршрут',
      n: p.length, lat: p.map((q) => q.lat), lon: p.map((q) => q.lon),
      X, Y, D, total, ele, speed, t: hasT ? p.map((q) => q.t) : null,
      bx0, by0, bx1, by1,
      stats: { gain, maxE, maxI, minE, moving, avg: hasT && moving > 0 ? (total / (moving / 1000)) * 3.6 : null },
    };
    // дни путешествия по местной дате
    if (hasT) {
      const dayOf = (i) => { const ms = route.t[i] + (route.lon[i] / 15) * 3600e3; return Math.floor(ms / 864e5); };
      const d0 = dayOf(0);
      route.dayArr = Int16Array.from(p, (_, i) => dayOf(i) - d0 + 1);
      route.days = route.dayArr[p.length - 1];
    }
    return route;
  }

  /* Положение на маршруте по дистанции s (м). */
  function at(route, s) {
    const D = route.D;
    s = Math.max(0, Math.min(route.total, s));
    let lo = 0, hi = D.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (D[m] <= s) lo = m; else hi = m; }
    const span = D[hi] - D[lo] || 1;
    const f = Math.max(0, Math.min(1, (s - D[lo]) / span));
    const L = (arr) => arr[lo] + (arr[hi] - arr[lo]) * f;
    return {
      i: lo, f,
      x: L(route.X), y: L(route.Y),
      ele: route.ele ? L(route.ele) : null,
      speed: route.speed ? L(route.speed) : null,
      t: route.t ? L(route.t) : null,
      lon: L(route.lon),
      day: route.dayArr ? route.dayArr[f > 0.5 ? hi : lo] : null,
    };
  }

  window.RouteLib = { parseAny, prepare, at, hav };
})();
