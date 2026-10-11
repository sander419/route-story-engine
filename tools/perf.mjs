import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:4180/');
await p.waitForFunction(() => window.__app);
await p.evaluate(async () => { const a = window.__app; a.loadJourney(await (await fetch('data/journey-wahrider.json')).json()); a.setMode('journey'); });
await p.waitForFunction(() => window.__app.scene && window.__app.scene.duration > 5);
const r = await p.evaluate(async () => {
  const out = {};
  for (const [W, H] of [[720, 1280], [1080, 1920]]) {
    const sc = window.__app.buildScene(W, H); if (sc.assetsReady) await sc.assetsReady;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const res = [];
    for (const t of [1, 8, 14, 22, 30, 38, 44]) {
      for (let k = 0; k < 3; k++) for (const q of sc.tilesAt(t)) await (q.vec ? window.VMap.getTile(q.z, q.x, q.y) : window.RS.getTile(q.layer, q.z, q.x, q.y, true)).p;
      const t0 = performance.now(); sc.draw(c, t); res.push(Math.round(performance.now() - t0) + 'ms@z' + sc.cam(t).z.toFixed(1) + '/' + sc.tilesAt(t).length + 't');
    }
    out[W + 'x' + H] = res;
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
