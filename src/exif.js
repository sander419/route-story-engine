/* Читает из JPEG время съёмки и GPS (EXIF), чтобы фото само встало на своё место маршрута.
   Файл никуда не отправляется: всё происходит в браузере. */
(function () {
  function readExif(buf) {
    const d = new DataView(buf);
    if (d.byteLength < 4 || d.getUint16(0) !== 0xffd8) return {};
    let off = 2;
    while (off + 4 < d.byteLength) {
      const marker = d.getUint16(off), size = d.getUint16(off + 2);
      if (marker === 0xffe1 && d.getUint32(off + 4) === 0x45786966) return parseTiff(d, off + 10);
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
      off += 2 + size;
    }
    return {};
  }

  function parseTiff(d, base) {
    const le = d.getUint16(base) === 0x4949;
    const u16 = (o) => d.getUint16(o, le), u32 = (o) => d.getUint32(o, le);
    const out = {};
    const str = (o, n) => { let s = ''; for (let i = 0; i < n && o + i < d.byteLength; i++) { const c = d.getUint8(o + i); if (!c) break; s += String.fromCharCode(c); } return s; };
    const rat = (o) => { const den = u32(o + 4); return den ? u32(o) / den : 0; };
    const ifd = (start, cb) => {
      if (start <= 0 || base + start + 2 > d.byteLength) return;
      const n = u16(base + start);
      for (let i = 0; i < n; i++) {
        const e = base + start + 2 + i * 12; if (e + 12 > d.byteLength) return;
        const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
        const sizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 10: 8 };
        const len = (sizes[type] || 1) * count;
        const valOff = len > 4 ? base + u32(e + 8) : e + 8;
        cb(tag, type, count, valOff);
      }
    };
    let exifPtr = 0, gpsPtr = 0;
    ifd(u32(base + 4), (tag, type, count, vo) => { if (tag === 0x8769) exifPtr = u32(vo); else if (tag === 0x8825) gpsPtr = u32(vo); else if (tag === 0x0132 && !out.dt) out.dt = str(vo, count); });
    ifd(exifPtr, (tag, type, count, vo) => { if (tag === 0x9003) out.dt = str(vo, count); else if (tag === 0x9011) out.tz = str(vo, count); });
    const g = {};
    ifd(gpsPtr, (tag, type, count, vo) => {
      if (tag === 1) g.latRef = str(vo, 2); else if (tag === 3) g.lonRef = str(vo, 2);
      else if (tag === 2 && count === 3) g.lat = rat(vo) + rat(vo + 8) / 60 + rat(vo + 16) / 3600;
      else if (tag === 4 && count === 3) g.lon = rat(vo) + rat(vo + 8) / 60 + rat(vo + 16) / 3600;
    });
    if (g.lat != null && g.lon != null && (g.lat || g.lon)) { out.lat = g.latRef === 'S' ? -g.lat : g.lat; out.lon = g.lonRef === 'W' ? -g.lon : g.lon; }
    return out;
  }

  /* время съёмки в мс UTC: по смещению из файла, иначе по долготе маршрута (солнечное время) */
  function toUtc(dt, tz, lonGuess) {
    const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(dt || ''); if (!m) return null;
    const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    const z = /^([+-])(\d\d):(\d\d)/.exec(tz || '');
    const offMin = z ? (z[1] === '-' ? -1 : 1) * (+z[2] * 60 + +z[3]) : Math.round((lonGuess || 0) / 15) * 60;
    return naive - offMin * 60000;
  }

  /* Куда поставить фото на маршруте: 'gps' | 'time' | 'even' */
  function placeOnRoute(route, meta, index, count) {
    const even = () => ({ s: route.total * ((index + 1) / (count + 1)), how: 'even' });
    if (meta.lat != null) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < route.n; i++) { const dd = (route.lat[i] - meta.lat) ** 2 + ((route.lon[i] - meta.lon) * Math.cos((meta.lat * Math.PI) / 180)) ** 2; if (dd < bd) { bd = dd; bi = i; } }
      if (Math.sqrt(bd) * 111 < 3) return { s: route.D[bi], how: 'gps' };   // ближе 3 км к треку
    }
    if (meta.dt && route.t) {
      const tm = toUtc(meta.dt, meta.tz, route.lon[0]);
      const t0 = route.t[0], t1 = route.t[route.n - 1];
      if (tm != null && tm >= t0 - 600000 && tm <= t1 + 600000) {
        let lo = 0, hi = route.n - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (route.t[mid] <= tm) lo = mid; else hi = mid; }
        return { s: route.D[lo], how: 'time' };
      }
    }
    return even();
  }

  window.Exif = { readExif, toUtc, placeOnRoute };
})();
