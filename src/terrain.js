/* Рельеф: настоящие высоты (AWS Terrain Tiles / Mapzen, в основе SRTM, ~30 м), собственный лёгкий 3D-рендер на WebGL.
   Не MapLibre: нет векторных плиток и стилей — один кусок рельефа (сетка ≤ 257², одна текстура), поэтому кадр стоит
   <1 мс на видеокарте и ~50 мс на программном GL (проверено), т.е. экспорт не замедляется заметно.
   Текстура запекается на CPU один раз на маршрут: цвет по высоте, теневой рельеф, контурные линии.
   Координаты — Меркатор-единицы маршрута (0…256 по миру). Нет сети или WebGL — load()/render() вернут null, а стиль нарисует эскиз. */
(function () {
  const TILE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';
  const WORLD_M = 40075016.686 / 256;   // метров на Меркатор-единицу на экваторе
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const tiles = new Map(), cache = new Map();
  const loadTile = (z, x, y) => {
    const k = `${z}/${x}/${y}`; let p = tiles.get(k);
    if (!p) { p = new Promise((res) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = `${TILE}${k}.png`; }); tiles.set(k, p); }
    return p;
  };
  const latOf = (y) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 256))) * 180) / Math.PI;

  /* ---- какой кусок рельефа нужен: квадрат вокруг маршрута, не больше 4×4 плиток ---- */
  const mobile = () => { try { return matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700; } catch (e) { return false; } };
  function region(b) {
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, half = Math.max(b.x1 - b.x0, b.y1 - b.y0, 0.06) * 1.1;
    const x0 = cx - half, x1 = cx + half, y0 = cy - half, y1 = cy + half;
    for (let z = 12; z >= 2; z--) {
      const n = 2 ** z, ax = Math.floor((x0 / 256) * n), bx = Math.floor((x1 / 256) * n), ay = Math.floor((y0 / 256) * n), by = Math.floor((y1 / 256) * n);
      const lim = mobile() ? 3 : 4;   // на телефоне область не больше 3×3 плиток: меньше трафика, памяти и работы процессора
      if (bx - ax < lim && by - ay < lim && ax >= 0 && ay >= 0 && bx < n && by < n) return { z, ax, ay, nx: bx - ax + 1, ny: by - ay + 1, cx, cy };
    }
    return null;
  }
  const keyOf = (r) => `${r.z}/${r.ax}/${r.ay}/${r.nx}x${r.ny}`;

  /* ---- цвет по высоте, тень, контуры — одной бумажной палитрой «дневника» ---- */
  const RAMP = [[0, [186, 203, 166]], [300, [214, 210, 160]], [1000, [208, 184, 134]], [2200, [178, 146, 106]], [3600, [150, 120, 92]], [5200, [236, 228, 214]], [7000, [250, 248, 244]]];
  const ramp = (h) => { if (h <= RAMP[0][0]) return RAMP[0][1]; for (let i = 1; i < RAMP.length; i++) if (h <= RAMP[i][0]) { const a = RAMP[i - 1], b = RAMP[i], t = (h - a[0]) / (b[0] - a[0]); return [a[1][0] + (b[1][0] - a[1][0]) * t, a[1][1] + (b[1][1] - a[1][1]) * t, a[1][2] + (b[1][2] - a[1][2]) * t]; } return RAMP[RAMP.length - 1][1]; };
  function bake(T) {
    const W = T.W, Hh = T.H, H = T.heights, mpp = T.mpp, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const g = cv.getContext('2d'), id = g.createImageData(W, Hh);
    const az = (315 * Math.PI) / 180, alt = (24 * Math.PI) / 180, ex = 2.0; let mn = 1e9, mx = -1e9; for (const v of H) { if (v < mn) mn = v; if (v > mx) mx = v; }
    const span = Math.max(40, mx - Math.max(0, mn)), raw = [10, 20, 25, 50, 100, 200, 250, 500, 1000], want = span / 14; let step = raw.find((s) => s >= want) || 1000;
    const at = (x, y) => H[clamp(y, 0, Hh - 1) * W + clamp(x, 0, W - 1)];
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, h = H[i];
      const dzdx = ((at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1))) / (8 * mpp) * ex;
      const dzdy = ((at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1))) / (8 * mpp) * ex;
      const slope = Math.atan(Math.hypot(dzdx, dzdy)), asp = Math.atan2(dzdy, -dzdx), s = Math.max(0, Math.sin(alt) * Math.cos(slope) + Math.cos(alt) * Math.sin(slope) * Math.cos(az - asp));
      let c = h <= 0 ? [160, 186, 190] : ramp(h); const sh = 0.5 + 0.8 * s;
      let r = c[0] * sh, gg = c[1] * sh, b = c[2] * sh;
      if (h > 0 && (Math.floor(h / step) !== Math.floor(at(x + 1, y) / step) || Math.floor(h / step) !== Math.floor(at(x, y + 1) / step))) { r *= 0.80; gg *= 0.78; b *= 0.74; }   // контурная линия
      const k = i * 4; id.data[k] = Math.min(255, r); id.data[k + 1] = Math.min(255, gg); id.data[k + 2] = Math.min(255, b); id.data[k + 3] = 255;
    }
    g.putImageData(id, 0, 0); return cv;
  }

  /* ---- загрузка: плитки → высоты → сетка → текстура ---- */
  async function load(b, opts = {}) {
    const r = region(b); if (!r) return null; const key = keyOf(r) + '|' + (opts.exag || 4.5); if (cache.has(key)) return cache.get(key);
    const job = (async () => {
      const cv = document.createElement('canvas'); cv.width = r.nx * 256; cv.height = r.ny * 256; const g = cv.getContext('2d', { willReadFrequently: true });
      const jobs = []; let ok = 0;
      for (let j = 0; j < r.ny; j++) for (let i = 0; i < r.nx; i++) jobs.push(loadTile(r.z, r.ax + i, r.ay + j).then((im) => { if (im) { g.drawImage(im, i * 256, j * 256); ok++; } }));
      await Promise.all(jobs); if (ok < jobs.length * 0.6) return null;
      const W = cv.width, Hh = cv.height, px = g.getImageData(0, 0, W, Hh).data, heights = new Float32Array(W * Hh);
      for (let i = 0; i < W * Hh; i++) heights[i] = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768;
      const n = 2 ** r.z, ux = (256 / n) / 256, lat = latOf(r.cy), mPerUnit = WORLD_M * Math.cos((lat * Math.PI) / 180), exag = opts.exag || 4.5;
      const T = { z: r.z, W, H: Hh, N: W, heights, mPerUnit, mpp: mPerUnit * ux, exag, hs: (exag / mPerUnit), x0: (r.ax * 256) / n, y0: (r.ay * 256) / n, wU: (W * ux), hU: (Hh * ux), cx: r.cx, cy: r.cy };
      T.tex = bake(T);
      let mn = 1e9, mx = -1e9; for (const v of heights) { if (v < mn) mn = v; if (v > mx) mx = v; } T.hmin = mn; T.hmax = mx;
      return T;
    })().catch(() => null);
    cache.set(key, job); return job;
  }
  const heightAt = (T, X, Y) => {
    const fx = clamp(((X - T.x0) / T.wU) * (T.W - 1), 0, T.W - 1.001), fy = clamp(((Y - T.y0) / T.hU) * (T.H - 1), 0, T.H - 1.001), ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, H = T.heights, W = T.W;
    return (H[iy * W + ix] * (1 - tx) + H[iy * W + ix + 1] * tx) * (1 - ty) + (H[(iy + 1) * W + ix] * (1 - tx) + H[(iy + 1) * W + ix + 1] * tx) * ty;
  };

  /* ---- WebGL: один общий контекст ---- */
  let GL = null;
  function gl() {
    if (GL !== null) return GL || null;
    try {
      const cv = document.createElement('canvas'), g = cv.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: false }); if (!g) { GL = false; return null; }
      const sh = (t, s) => { const o = g.createShader(t); g.shaderSource(o, s); g.compileShader(o); if (!g.getShaderParameter(o, g.COMPILE_STATUS)) throw Error(g.getShaderInfoLog(o)); return o; };
      const pr = g.createProgram();
      g.attachShader(pr, sh(g.VERTEX_SHADER, `#version 300 es
in vec3 p; in vec3 n; in vec2 t; uniform mat4 m; out vec3 vn; out vec2 vt; out float vw; void main(){ vn=n; vt=t; gl_Position=m*vec4(p,1.0); vw=gl_Position.w; }`));
      g.attachShader(pr, sh(g.FRAGMENT_SHADER, `#version 300 es
precision highp float; in vec3 vn; in vec2 vt; in float vw; uniform sampler2D tex; uniform vec2 res; uniform float dist; out vec4 o;
void main(){
  vec3 L=normalize(vec3(-0.62,0.42,-0.38)); float d=max(dot(normalize(vn),L),0.0); vec3 c=texture(tex,vt).rgb*(0.68+0.55*d);
  if(abs(vn.y)<0.001){ c=texture(tex,vt).rgb*0.42; c=mix(c,vec3(0.30,0.24,0.18),0.45); }
  o=vec4(c,1.0);
}`));
      g.linkProgram(pr); if (!g.getProgramParameter(pr, g.LINK_STATUS)) throw Error('link');
      GL = { cv, g, pr, loc: { m: g.getUniformLocation(pr, 'm'), res: g.getUniformLocation(pr, 'res'), dist: g.getUniformLocation(pr, 'dist'), tex: g.getUniformLocation(pr, 'tex') } };
      return GL;
    } catch (e) { GL = false; return null; }
  }
  function upload(G, T) {
    if (T._gl && T._gl.ctx === G.g) return T._gl; const g = G.g, W = T.W, H = T.H, cap = mobile() ? 193 : 257, Gx = Math.min(cap, W), Gy = Math.min(cap, H);
    const pos = new Float32Array(Gx * Gy * 3), nor = new Float32Array(Gx * Gy * 3), uv = new Float32Array(Gx * Gy * 2);
    const hm = (x, y) => T.heights[clamp(Math.round(y), 0, H - 1) * W + clamp(Math.round(x), 0, W - 1)];
    for (let j = 0; j < Gy; j++) for (let i = 0; i < Gx; i++) {
      const x = (i / (Gx - 1)) * (W - 1), y = (j / (Gy - 1)) * (H - 1), h = Math.max(0, hm(x, y)), k = j * Gx + i;
      pos[k * 3] = T.x0 + (x / (W - 1)) * T.wU - T.cx; pos[k * 3 + 1] = h * T.hs; pos[k * 3 + 2] = T.y0 + (y / (H - 1)) * T.hU - T.cy;
      const dx = ((hm(x + 3, y) - hm(x - 3, y)) / (6 * T.mpp)) * T.exag, dz = ((hm(x, y + 3) - hm(x, y - 3)) / (6 * T.mpp)) * T.exag, l = Math.hypot(dx, 1, dz);
      nor[k * 3] = -dx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = -dz / l; uv[k * 2] = i / (Gx - 1); uv[k * 2 + 1] = j / (Gy - 1);
    }
    const base = -Math.max(40, (T.hmax - Math.max(0, T.hmin)) * 0.35) * T.hs, nv = Gx * Gy, ring = [];
    for (let i = 0; i < Gx; i++) ring.push([i, 0, 0, -1]);
    for (let j = 1; j < Gy; j++) ring.push([Gx - 1, j, 1, 0]);
    for (let i = Gx - 2; i >= 0; i--) ring.push([i, Gy - 1, 0, 1]);
    for (let j = Gy - 2; j > 0; j--) ring.push([0, j, -1, 0]);
    const R = ring.length, spos = new Float32Array(R * 3), snor = new Float32Array(R * 3), suv = new Float32Array(R * 2);
    ring.forEach(([i, j, nx, nz], r) => { const k = j * Gx + i; spos[r * 3] = pos[k * 3]; spos[r * 3 + 1] = base; spos[r * 3 + 2] = pos[k * 3 + 2]; snor[r * 3] = nx; snor[r * 3 + 2] = nz; suv[r * 2] = uv[k * 2]; suv[r * 2 + 1] = uv[k * 2 + 1]; });
    const P2 = new Float32Array((nv + R) * 3), N2 = new Float32Array((nv + R) * 3), U2 = new Float32Array((nv + R) * 2);
    P2.set(pos); N2.set(nor); U2.set(uv); P2.set(spos, nv * 3); N2.set(snor, nv * 3); U2.set(suv, nv * 2);
    /* стенка: верх — вершины рельефа по краю (их нормаль смотрит вверх, поэтому дублируем с горизонтальной нормалью) */
    const top = ring.map(([i, j, nx, nz]) => { const k = j * Gx + i; return [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2], nx, nz, uv[k * 2], uv[k * 2 + 1]]; });
    const P3 = new Float32Array((nv + 2 * R) * 3), N3 = new Float32Array((nv + 2 * R) * 3), U3 = new Float32Array((nv + 2 * R) * 2);
    P3.set(P2); N3.set(N2); U3.set(U2);
    top.forEach((t2, r) => { const o = nv + R + r; P3[o * 3] = t2[0]; P3[o * 3 + 1] = t2[1]; P3[o * 3 + 2] = t2[2]; N3[o * 3] = t2[3]; N3[o * 3 + 2] = t2[4]; U3[o * 2] = t2[5]; U3[o * 2 + 1] = t2[6]; });
    const idx = new Uint32Array((Gx - 1) * (Gy - 1) * 6 + R * 6); let q = 0;
    for (let j = 0; j < Gy - 1; j++) for (let i = 0; i < Gx - 1; i++) { const a = j * Gx + i, b = a + 1, c = a + Gx, d = c + 1; idx.set([a, c, b, b, c, d], q); q += 6; }
    for (let r = 0; r < R; r++) { const r2 = (r + 1) % R, t0 = nv + R + r, t1 = nv + R + r2, b0 = nv + r, b1 = nv + r2; idx.set([t0, b0, t1, t1, b0, b1], q); q += 6; }
    const vao = g.createVertexArray(); g.bindVertexArray(vao);
    const buf = (data, name, size) => { const b = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, b); g.bufferData(g.ARRAY_BUFFER, data, g.STATIC_DRAW); const l = g.getAttribLocation(G.pr, name); g.enableVertexAttribArray(l); g.vertexAttribPointer(l, size, g.FLOAT, false, 0, 0); };
    buf(P3, 'p', 3); buf(N3, 'n', 3); buf(U3, 't', 2); const ib = g.createBuffer(); g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, ib); g.bufferData(g.ELEMENT_ARRAY_BUFFER, idx, g.STATIC_DRAW);
    const tex = g.createTexture(); g.bindTexture(g.TEXTURE_2D, tex); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false); g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, T.tex); g.generateMipmap(g.TEXTURE_2D);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    return (T._gl = { ctx: g, vao, tex, count: idx.length });
  }

  /* ---- камера: центр (Меркатор), расстояние, наклон, азимут взгляда (по часовой от севера) ---- */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const mul = (a, b) => { const r = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) r[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3]; return r; };
  function viewProj(T, cam, w, h) {
    const fov = ((cam.fov || 38) * Math.PI) / 180, pitch = (cam.pitch * Math.PI) / 180, br = (cam.bearing * Math.PI) / 180;
    const tgt = [cam.cx - T.cx, Math.max(0, heightAt(T, cam.cx, cam.cy)) * T.hs, cam.cy - T.cy], fwd = [Math.sin(br), 0, -Math.cos(br)];
    const eye = [tgt[0] - fwd[0] * cam.dist * Math.cos(pitch), tgt[1] + cam.dist * Math.sin(pitch), tgt[2] - fwd[2] * cam.dist * Math.cos(pitch)];
    const zc = norm(sub(eye, tgt)), xc = norm(cross([0, 1, 0], zc)), yc = cross(zc, xc);
    const view = [xc[0], yc[0], zc[0], 0, xc[1], yc[1], zc[1], 0, xc[2], yc[2], zc[2], 0, -dot(xc, eye), -dot(yc, eye), -dot(zc, eye), 1];
    const f = 1 / Math.tan(fov / 2), n = cam.dist * 0.05, fr = cam.dist * 6, a = w / h;
    return mul([f / a, 0, 0, 0, 0, f, 0, 0, 0, 0, (fr + n) / (n - fr), -1, 0, 0, (2 * fr * n) / (n - fr), 0], view);
  }
  function render(T, cam, w, h) {
    const G = gl(); if (!G || !T) return null; const g = G.g;
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h)); if (G.cv.width !== w || G.cv.height !== h) { G.cv.width = w; G.cv.height = h; }
    const U = upload(G, T); g.viewport(0, 0, w, h); g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT); g.enable(g.DEPTH_TEST); g.disable(g.CULL_FACE); g.useProgram(G.pr); g.bindVertexArray(U.vao);
    g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, U.tex); g.uniform1i(G.loc.tex, 0); g.uniformMatrix4fv(G.loc.m, false, new Float32Array(viewProj(T, cam, w, h))); g.uniform2f(G.loc.res, w, h); g.uniform1f(G.loc.dist, cam.dist);
    g.drawElements(g.TRIANGLES, U.count, g.UNSIGNED_INT, 0); return G.cv;
  }
  /* точка карты (Меркатор X, Y) → пиксель кадра; null, если за камерой */
  function project(T, cam, w, h, X, Y, lift = 0) {
    const m = viewProj(T, cam, w, h), P = [X - T.cx, Math.max(0, heightAt(T, X, Y)) * T.hs + lift * T.hs, Y - T.cy];
    const cx = m[0] * P[0] + m[4] * P[1] + m[8] * P[2] + m[12], cy = m[1] * P[0] + m[5] * P[1] + m[9] * P[2] + m[13], cw = m[3] * P[0] + m[7] * P[1] + m[11] * P[2] + m[15];
    if (cw <= 1e-9) return null; return [(cx / cw * 0.5 + 0.5) * w, (1 - (cy / cw * 0.5 + 0.5)) * h];
  }
  function projector(T, cam, w, h) {
    const m = viewProj(T, cam, w, h);
    return (X, Y, lift = 0) => {
      const P = [X - T.cx, Math.max(0, heightAt(T, X, Y)) * T.hs + lift * T.hs, Y - T.cy], cw = m[3] * P[0] + m[7] * P[1] + m[11] * P[2] + m[15]; if (cw <= 1e-9) return null;
      const cx = m[0] * P[0] + m[4] * P[1] + m[8] * P[2] + m[12], cy = m[1] * P[0] + m[5] * P[1] + m[9] * P[2] + m[13];
      return [(cx / cw * 0.5 + 0.5) * w, (1 - (cy / cw * 0.5 + 0.5)) * h];
    };
  }
  window.Terrain = { load, render, project, projector, heightAt, region };
})();
