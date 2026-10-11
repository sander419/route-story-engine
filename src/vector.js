/* Векторная карта на обычном 2D-холсте: тайлы OpenFreeMap (OpenStreetMap) → свой рисовальщик.
   Не требует видеокарты, умеет прозрачный фон и отдельные слои (заливки / линии / подписи). */
(function () {
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  /* ---------- разбор Mapbox Vector Tile (protobuf) ---------- */
  function decodeTile(buf) {
    const b = new Uint8Array(buf); let pos = 0;
    const varint = () => { let r = 0, s = 0, x; do { x = b[pos++]; r += (x & 127) * Math.pow(2, s); s += 7; } while (x & 128); return r; };
    const zz = (n) => (n % 2 ? -(n + 1) / 2 : n / 2);
    const skip = (w) => { if (w === 0) varint(); else if (w === 1) pos += 8; else if (w === 2) pos += varint(); else if (w === 5) pos += 4; };
    const str = (len) => { const s = new TextDecoder().decode(b.subarray(pos, pos + len)); pos += len; return s; };
    const msg = (end, fn) => { while (pos < end) { const k = varint(); fn(k >> 3, k & 7); } };
    const layers = {};
    msg(b.length, (f, w) => {
      if (f !== 3 || w !== 2) return skip(w);
      const end = varint() + pos; const L = { extent: 4096, keys: [], vals: [], feats: [] }; let name = '';
      msg(end, (f2, w2) => {
        if (f2 === 1) name = str(varint());
        else if (f2 === 5) L.extent = varint();
        else if (f2 === 3) L.keys.push(str(varint()));
        else if (f2 === 4) {
          const e = varint() + pos; let v = null;
          msg(e, (f3, w3) => {
            if (f3 === 1) v = str(varint());
            else if (f3 === 2) { v = new DataView(b.buffer, b.byteOffset + pos, 4).getFloat32(0, true); pos += 4; }
            else if (f3 === 3) { v = new DataView(b.buffer, b.byteOffset + pos, 8).getFloat64(0, true); pos += 8; }
            else if (f3 === 4 || f3 === 5) v = varint(); else if (f3 === 6) v = zz(varint()); else if (f3 === 7) v = !!varint(); else skip(w3);
          });
          L.vals.push(v);
        } else if (f2 === 2) {
          const e = varint() + pos; const F = { type: 0, tags: [], geom: [] };
          msg(e, (f3, w3) => {
            if (f3 === 3) F.type = varint();
            else if (f3 === 2) { const e2 = varint() + pos; while (pos < e2) F.tags.push(varint()); }
            else if (f3 === 4) { const e2 = varint() + pos; while (pos < e2) F.geom.push(varint()); }
            else skip(w3);
          });
          L.feats.push(F);
        } else skip(w2);
      });
      layers[name] = L;
    });
    for (const L of Object.values(layers)) {
      for (const F of L.feats) {
        F.props = {}; for (let i = 0; i < F.tags.length; i += 2) F.props[L.keys[F.tags[i]]] = L.vals[F.tags[i + 1]];
        const parts = []; let cur = null, x = 0, y = 0;
        for (let i = 0; i < F.geom.length;) {
          const c = F.geom[i++], cmd = c & 7, n = c >> 3;
          if (cmd === 7) continue;
          for (let k = 0; k < n; k++) { x += zz(F.geom[i++]); y += zz(F.geom[i++]); if (cmd === 1) { cur = [x, y]; parts.push(cur); } else cur.push(x, y); }
        }
        F.parts = parts; delete F.geom; delete F.tags;
      }
      delete L.keys; delete L.vals;
    }
    return layers;
  }

  /* ---------- загрузка тайлов ---------- */
  let tjP = null;
  const tilejson = () => tjP || (tjP = fetch('https://tiles.openfreemap.org/planet').then((r) => r.json()).catch((e) => { tjP = null; throw e; }));
  const cache = new Map();
  function getTile(z, x, y) {
    const key = z + '/' + x + '/' + y;
    let e = cache.get(key);
    if (!e) {
      e = { data: null, done: false, fail: 0 };
      cache.set(key, e);
      const attempt = async () => {
        try {
          const tj = await tilejson();
          const r = await fetch(tj.tiles[0].replace('{z}', z).replace('{x}', x).replace('{y}', y));
          if (r.status === 404) { e.data = {}; e.done = true; onTile(); return; } // пустой тайл
          if (!r.ok) throw new Error('HTTP ' + r.status);
          e.data = decodeTile(await r.arrayBuffer()); e.done = true; onTile();
        } catch (err) { if (++e.fail < 3) { await new Promise((r) => setTimeout(r, 500 * e.fail)); return attempt(); } e.done = true; }
      };
      e.p = attempt();
    }
    return e;
  }
  let onTile = () => {};

  /* ---------- какие тайлы нужны на кадре ---------- */
  const TILE_LEVEL_BIAS = 0.6;
  function view(cam, ax, ay, W, H) {
    const zi = clamp(Math.floor(cam.z - TILE_LEVEL_BIAS), 0, 14);
    const ts = 256 * Math.pow(2, cam.z - zi), n = 1 << zi;
    const cxT = (cam.cx / 256) * n, cyT = (cam.cy / 256) * n;
    const rotated = Math.abs(cam.rot || 0) > 1e-6, R = Math.hypot(Math.max(ax, W - ax), Math.max(ay, H - ay));
    const l = rotated ? R : ax, r = rotated ? R : W - ax, tp = rotated ? R : ay, bt = rotated ? R : H - ay;
    return { zi, ts, n, cxT, cyT, x0: Math.floor(cxT - l / ts), x1: Math.floor(cxT + r / ts), y0: Math.floor(cyT - tp / ts), y1: Math.floor(cyT + bt / ts) };
  }
  function tilesAt(cam, ax, ay, W, H) {
    const v = view(cam, ax, ay, W, H), out = [];
    for (let ty = Math.max(0, v.y0); ty <= Math.min(v.n - 1, v.y1); ty++) for (let tx = v.x0; tx <= v.x1; tx++) out.push({ vec: true, z: v.zi, x: ((tx % v.n) + v.n) % v.n, y: ty });
    return out;
  }

  /* ---------- рисование ---------- */
  const RANK = { country: 0, state: 1, city: 2, town: 3, village: 4, suburb: 5, hamlet: 6 };
  const SHOW_FROM = { country: 0, state: 4.4, city: 2.5, town: 6.2, village: 8.2, suburb: 10.2, hamlet: 10.8 };
  const ROAD_FROM = { motorway: 4.5, trunk: 5.2, primary: 7, secondary: 8.4, tertiary: 9.6, minor: 10.6, service: 12.5 };
  const ROAD_W = { motorway: 3.4, trunk: 3, primary: 2.5, secondary: 1.9, tertiary: 1.4, minor: 1, service: 0.7 };

  /* groups: { fills, lines, labels } — что рисовать; theme — токены цвета (S.vec) */
  function draw(ctx, W, H, cam, ax, ay, theme, groups, lang, u) {
    const v = view(cam, ax, ay, W, H);
    const rot = cam.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot);
    // экранная точка по координатам тайла
    const scr = (t, gx, gy, ext) => {
      const dx = (t.x + gx / ext - v.cxT) * v.ts, dy = (t.y + gy / ext - v.cyT) * v.ts;
      return [ax + dx * cs - dy * sn, ay + dx * sn + dy * cs];
    };
    const list = [];
    for (let ty = v.y0; ty <= v.y1; ty++) {
      if (ty < 0 || ty >= v.n) continue;
      for (let tx = v.x0; tx <= v.x1; tx++) {
        const wx = ((tx % v.n) + v.n) % v.n; let e = getTile(v.zi, wx, ty), src = { x: tx, y: ty, d: 0 };
        if (!e.data) { // нет данных — берём «родителя» крупнее
          for (let d = 1; d <= 4 && v.zi - d >= 0; d++) { const pe = cache.get((v.zi - d) + '/' + (wx >> d) + '/' + (ty >> d)); if (pe && pe.data) { e = pe; src = { x: tx, y: ty, d }; break; } }
        }
        if (e.data) list.push({ data: e.data, tx, ty, d: src.d });
      }
    }
    const withTile = (fn) => {
      for (const it of list) {
        const sc = Math.pow(2, it.d), size = v.ts * sc;
        // начало (левый верхний угол) тайла-источника на экране, до поворота
        const ox = (it.tx - Math.floor(it.tx / sc) * sc) * v.ts, oy = (it.ty - Math.floor(it.ty / sc) * sc) * v.ts;
        const dx = (it.tx - v.cxT) * v.ts - ox, dy = (it.ty - v.cyT) * v.ts - oy;
        ctx.save();
        ctx.translate(ax, ay); ctx.rotate(rot);
        // обрезаем по месту дочернего тайла, если рисуем увеличенного родителя
        ctx.beginPath(); ctx.rect((it.tx - v.cxT) * v.ts, (it.ty - v.cyT) * v.ts, v.ts + 0.5, v.ts + 0.5); ctx.clip();
        ctx.translate(dx, dy);
        fn(it.data, size);
        ctx.restore();
      }
    };
    const k = (size, L) => size / L.extent;
    const path = (L, F, closed, kk) => {
      ctx.beginPath();
      for (const pr of F.parts) { ctx.moveTo(pr[0], pr[1]); for (let i = 2; i < pr.length; i += 2) ctx.lineTo(pr[i], pr[i + 1]); if (closed) ctx.closePath(); }
    };

    if (groups.fills) {
      withTile((data, size) => {
        const water = data.water, lc = data.landcover, lu = data.landuse, park = data.park;
        const kk = (L) => size / L.extent;
        const fillLayer = (L, color, filter) => { if (!L) return; ctx.save(); ctx.scale(kk(L), kk(L)); ctx.fillStyle = color; for (const F of L.feats) { if (F.type !== 3 || (filter && !filter(F))) continue; path(L, F, true); ctx.fill('evenodd'); } ctx.restore(); };
        if (theme.park) { fillLayer(lc, theme.park, (F) => F.props.class === 'wood' || F.props.class === 'grass' || F.props.class === 'farmland' ? true : false); fillLayer(park, theme.park); }
        if (theme.urban) fillLayer(lu, theme.urban, (F) => F.props.class === 'residential' || F.props.class === 'commercial' || F.props.class === 'industrial');
        if (theme.ice) fillLayer(lc, theme.ice, (F) => F.props.class === 'ice');
        if (theme.water) fillLayer(water, theme.water);
      });
    }
    if (groups.lines) {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      withTile((data, size) => {
        const stroke = (L, color, w, filter, alpha, dash) => {
          if (!L) return; const kk = size / L.extent;
          ctx.save(); ctx.scale(kk, kk); ctx.strokeStyle = color; ctx.lineWidth = (w * u) / kk; if (alpha != null) ctx.globalAlpha = alpha; if (dash) ctx.setLineDash(dash.map((d) => (d * u) / kk));
          for (const F of L.feats) { if (filter && !filter(F)) continue; path(L, F, F.type === 3); ctx.stroke(); }
          ctx.restore();
        };
        const z = cam.z;
        if (theme.waterLine) { stroke(data.water, theme.waterLine, 1.4, (F) => F.type === 3, 0.9); stroke(data.waterway, theme.waterLine, z > 7 ? 1.2 : 0.7, (F) => z > 5.5, 0.8); }
        if (theme.road) {
          for (const cls of ['minor', 'service', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway']) {
            if (z < ROAD_FROM[cls]) continue;
            stroke(data.transportation, theme.road, ROAD_W[cls] * (z > 9 ? 1.15 : 1), (F) => (F.props.class === cls || (cls === 'minor' && F.props.class === 'path' && z > 12)) && F.props.class !== 'rail' && F.type === 2, cls === 'minor' || cls === 'service' ? 0.55 : 0.95);
          }
          if (z > 7 && theme.rail) stroke(data.transportation, theme.rail, 1.2, (F) => F.props.class === 'rail' && F.type === 2, 0.7, [10, 8]);
        }
        if (theme.border) {
          stroke(data.boundary, theme.border, 2.4, (F) => F.props.admin_level <= 2 && !F.props.maritime, 0.95, [14, 9]);
          if (z > 4.5) stroke(data.boundary, theme.border, 1.2, (F) => F.props.admin_level >= 3 && F.props.admin_level <= 4 && !F.props.maritime, 0.7, [8, 8]);
        }
      });
    }
    if (groups.labels) {
      const cand = [], z = cam.z;
      for (const it of list) {
        const sc = Math.pow(2, it.d);
        const ox = (it.tx - Math.floor(it.tx / sc) * sc), oy = (it.ty - Math.floor(it.ty / sc) * sc);
        const t = { x: it.tx - ox, y: it.ty - oy };   // тайл-источник в тайловых координатах
        const sub = (L) => (L ? L : null);
        const addPlaces = (L) => {
          if (!L) return;
          for (const F of L.feats) {
            if (F.type !== 1) continue; const cl = F.props.class; if (!(cl in RANK) || z < SHOW_FROM[cl]) continue;
            if (it.d && it.d > 0 && false) continue;
            const name = (lang === 'ru' && F.props['name:ru']) || F.props['name:latin'] || F.props.name_en || F.props.name; if (!name) continue;
            // координата в единицах тайла-источника → экран (размер источника = ts * sc)
            const gx = F.parts[0][0] / L.extent, gy = F.parts[0][1] / L.extent;
            const dx = (t.x + gx * sc - v.cxT) * v.ts, dy = (t.y + gy * sc - v.cyT) * v.ts;
            // в «родителе» тайл-источник шире на sc, поэтому используем координаты относительно его собственного угла
            const px = ax + dx * cs - dy * sn, py = ay + dx * sn + dy * cs;
            if (px < -80 || px > W + 80 || py < -30 || py > H + 30) continue;
            cand.push({ name, x: px, y: py, r: RANK[cl], q: F.props.rank != null ? F.props.rank : 50, kind: 'place' });
          }
        };
        const addPeaks = (L) => {
          if (!L || z < 8.4 || !theme.peak) return;
          for (const F of L.feats) {
            if (F.type !== 1) continue; const name = F.props['name:ru'] || F.props['name:latin'] || F.props.name_en || F.props.name; if (!name) continue;
            const gx = F.parts[0][0] / L.extent, gy = F.parts[0][1] / L.extent;
            const dx = (t.x + gx * sc - v.cxT) * v.ts, dy = (t.y + gy * sc - v.cyT) * v.ts;
            const px = ax + dx * cs - dy * sn, py = ay + dx * sn + dy * cs;
            if (px < 0 || px > W || py < 0 || py > H) continue;
            cand.push({ name: name + (F.props.ele ? ' · ' + F.props.ele + ' м' : ''), x: px, y: py, r: 7, q: -(F.props.ele || 0), kind: 'peak' });
          }
        };
        addPlaces(it.data.place); addPeaks(it.data.mountain_peak);
      }
      cand.sort((a, b) => a.r - b.r || a.q - b.q);
      const taken = []; let shown = 0;
      const fam = theme.font || 'Inter, sans-serif';
      for (const c of cand) {
        if (shown > (theme.maxLabels || 38)) break;
        const size = ([36, 30, 31, 26, 22, 19, 17, 20][c.r]) * u * (theme.labelScale || 1);
        ctx.font = `${c.r <= 1 ? 700 : 600} ${size}px ${fam}`;
        const label = c.r === 0 ? c.name.toUpperCase() : c.name;
        ctx.letterSpacing = c.r === 0 ? 4 * u + 'px' : '0px';
        const w = ctx.measureText(label).width, dotR = c.r >= 2 ? 5 * u : 0;
        const x = c.x - w / 2, y = c.y - (dotR ? 12 * u : 0);
        const box = [x - 8 * u, y - size, w + 16 * u, size + 14 * u];
        if (taken.some((q) => !(box[0] > q[0] + q[2] || box[0] + box[2] < q[0] || box[1] > q[1] + q[3] || box[1] + box[3] < q[1]))) continue;
        taken.push(box); shown++;
        ctx.lineJoin = 'round';
        ctx.lineWidth = 6 * u; ctx.strokeStyle = theme.halo || 'rgba(0,0,0,.6)'; ctx.strokeText(label, x, y);
        ctx.fillStyle = c.kind === 'peak' ? (theme.peak || theme.label) : theme.label; ctx.fillText(label, x, y);
        if (dotR) { ctx.beginPath(); ctx.arc(c.x, c.y, dotR, 0, 6.2832); ctx.fillStyle = theme.label; ctx.fill(); ctx.lineWidth = 2 * u; ctx.strokeStyle = theme.halo || 'rgba(0,0,0,.6)'; ctx.stroke(); }
        if (c.kind === 'peak') { ctx.beginPath(); ctx.moveTo(c.x, c.y - 14 * u); ctx.lineTo(c.x + 10 * u, c.y + 2 * u); ctx.lineTo(c.x - 10 * u, c.y + 2 * u); ctx.closePath(); ctx.fillStyle = theme.peak; ctx.fill(); }
        ctx.letterSpacing = '0px';
      }
    }
  }

  window.VMap = { draw, tilesAt, getTile, setOnTile: (f) => { onTile = f; }, decodeTile };
})();
