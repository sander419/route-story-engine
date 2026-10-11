import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 540, height: 960 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
p.on('console', m => m.type()==='error' && console.log('console:', m.text().slice(0,160)));
await p.goto('http://localhost:4180/out/spike.html');
await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
for (const [i, f] of [[0, 0.2], [1, 0.5], [2, 0.8]].entries?.() ?? []) {}
for (const [idx, f] of [[0, 0.15], [1, 0.5], [2, 0.85]]) {
  const t0 = Date.now();
  const png = await p.evaluate(async (f) => {
    const m = window.__map, pts = window.__pts, i = Math.floor(f * (pts.length - 1)), a = pts[i], c = pts[Math.min(pts.length - 1, i + 8)];
    const bearing = (Math.atan2(c[0] - a[0], c[1] - a[1]) * 180) / Math.PI;
    m.jumpTo({ center: a, zoom: 11.2, pitch: 62, bearing });
    await new Promise(r => { const chk = () => (m.loaded() && m.areTilesLoaded()) ? r() : setTimeout(chk, 60); setTimeout(chk, 100); });
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return m.getCanvas().toDataURL('image/png');
  }, f);
  writeFileSync(`out/spike-${idx}.png`, Buffer.from(png.split(',')[1], 'base64'));
  console.log('frame', idx, (Date.now() - t0) + 'ms');
}
await b.close();
