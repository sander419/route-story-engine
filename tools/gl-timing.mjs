import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const modes = { swift: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], gpu: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] };
for (const [name, args] of Object.entries(modes)) {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args });
  const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  await p.goto('http://localhost:4180/out/spike.html');
  await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  const gl = await p.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const e = c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
  const res = await p.evaluate(async () => {
    const m = window.__map, pts = window.__pts, times = [];
    for (let k = 0; k < 8; k++) {
      const t0 = performance.now(), i = Math.floor((k / 8) * (pts.length - 1));
      m.jumpTo({ center: pts[i], zoom: 11.2, pitch: 62, bearing: 30 + k * 7 });
      await new Promise(r => { const chk = () => (m.loaded() && m.areTilesLoaded()) ? r() : setTimeout(chk, 30); setTimeout(chk, 50); });
      m.redraw?.(); m.getCanvas().toDataURL('image/jpeg', 0.5);
      times.push(Math.round(performance.now() - t0));
    }
    // повторный проход по тем же местам: тайлы уже в кэше
    const warm = [];
    for (let k = 0; k < 8; k++) {
      const t0 = performance.now(), i = Math.floor((k / 8) * (pts.length - 1));
      m.jumpTo({ center: pts[i], zoom: 11.2, pitch: 62, bearing: 30 + k * 7 + 1 });
      await new Promise(r => { const chk = () => (m.loaded() && m.areTilesLoaded()) ? r() : setTimeout(chk, 10); setTimeout(chk, 10); });
      m.redraw?.(); m.getCanvas().toDataURL('image/jpeg', 0.5);
      warm.push(Math.round(performance.now() - t0));
    }
    return { cold: times, warm };
  });
  console.log(name, '|', gl, '|', JSON.stringify(res));
  await b.close();
}
