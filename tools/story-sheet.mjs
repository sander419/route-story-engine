// Раскадровка ролика через интерфейс: кадр каждые N секунд → out/story-<стиль>-<kind>-<fmt>.jpg (лист). node tools/story-sheet.mjs <стиль> <short|long> [v|h] [шаг c]
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const [,, style = 'journal', kind = 'short', fmt = 'v', step = '1.5'] = process.argv;
const b = await chromium.launch({ channel: 'msedge', headless: true }); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto(process.env.URL || 'http://localhost:4180/'); await p.waitForFunction(() => window.__app && window.__app.scene && window.__app.state.demoDay, null, { timeout: 60000 });
await p.evaluate(([st, k, f]) => { document.querySelector(`#styles button[data-id="${st}"]`).click(); document.querySelector(`#fmt button[data-v="${f}"]`).click(); document.querySelector(`#kind button[data-v="${k}"]`).click(); }, [style, kind, fmt]);
await p.waitForTimeout(1500);
const r = await p.evaluate(async (step) => {
  const sc = window.__app.scene; await sc.assetsReady; const out = [], dur = sc.duration;
  for (let t = 0.6; t < dur; t += step) { if (sc.tilesAt) for (let k = 0; k < 3; k++) for (const q of sc.tilesAt(t)) await window.VMap.getTile(q.z, q.x, q.y).p;
    const cv = document.createElement('canvas'); cv.width = sc.W; cv.height = sc.H; sc.draw(cv.getContext('2d'), t); const sm = document.createElement('canvas'); sm.width = sc.W / 2; sm.height = sc.H / 2; sm.getContext('2d').drawImage(cv, 0, 0, sm.width, sm.height); out.push(sm.toDataURL('image/jpeg', 0.8)); }
  return { out, dur, beats: window.__app.state.lastEp.res.plan.beats.map((x) => `${x.startSec}+${x.durationSec} ${x.recipe}`) };
}, +step);
r.out.forEach((d, i) => writeFileSync(`out/ss-${String(i).padStart(2, '0')}.jpg`, Buffer.from(d.split(',')[1], 'base64')));
const cols = fmt === 'v' ? 10 : 6, name = `out/story-${style}-${kind}-${fmt}.jpg`;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', 'out/ss-%02d.jpg', '-vf', `tile=${cols}x${Math.ceil(r.out.length / cols)}`, '-frames:v', '1', name]);
console.log(name, r.dur.toFixed(1) + ' с', '\n' + r.beats.join(' | '));
await b.close();
