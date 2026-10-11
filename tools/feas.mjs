import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:4180/');
const r = await p.evaluate(async () => {
  const out = {};
  // 1. векторные тайлы OpenFreeMap: TileJSON + CORS + размер
  try {
    const tj = await (await fetch('https://tiles.openfreemap.org/planet')).json();
    out.tilejson = { tiles: tj.tiles, maxzoom: tj.maxzoom, layers: (tj.vector_layers || []).map(l => l.id).join(',') };
    const url = tj.tiles[0].replace('{z}', 9).replace('{x}', 386).replace('{y}', 193);
    const t0 = performance.now(); const resp = await fetch(url); const buf = await resp.arrayBuffer();
    out.tile = { status: resp.status, bytes: buf.byteLength, ms: Math.round(performance.now() - t0), enc: resp.headers.get('content-encoding') };
  } catch (e) { out.tileErr = String(e); }
  // 2. WebCodecs: прозрачное видео
  const cfgs = {
    vp9alpha: { codec: 'vp09.00.10.08', width: 1080, height: 1920, bitrate: 6e6, framerate: 30, alpha: 'keep' },
    vp9noalpha: { codec: 'vp09.00.10.08', width: 1080, height: 1920, bitrate: 6e6, framerate: 30 },
    vp8alpha: { codec: 'vp8', width: 1080, height: 1920, bitrate: 6e6, framerate: 30, alpha: 'keep' },
    h264: { codec: 'avc1.640033', width: 1080, height: 1920, bitrate: 6e6, framerate: 30 },
    av1alpha: { codec: 'av01.0.08M.08', width: 1080, height: 1920, bitrate: 6e6, framerate: 30, alpha: 'keep' },
  };
  out.codecs = {};
  for (const [k, c] of Object.entries(cfgs)) { try { const s = await VideoEncoder.isConfigSupported(c); out.codecs[k] = s.supported + (s.config && s.config.alpha ? ' alpha=' + s.config.alpha : ''); } catch (e) { out.codecs[k] = 'ERR ' + e.message; } }
  out.mediaRecorder = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8'].map(m => m + ':' + MediaRecorder.isTypeSupported(m)).join(' | ');
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
