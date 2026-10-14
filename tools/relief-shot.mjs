// Кадры «Дневника» с рельефом для глаз: node tools/relief-shot.mjs <файл.json> <префикс> [v|h]
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const [,, file = 'data/journey-wahrider.json', pre = 'out/relief', fmt = 'v'] = process.argv;
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:4180/');
await p.waitForFunction(() => window.__app);
if (file === 'demo') { await p.click('#demo'); await p.waitForFunction(() => window.__app.scene); } else await p.evaluate(async (f) => { const a = window.__app; a.loadJourney(await (await fetch(f)).json()); a.setMode('journey'); }, file);
await p.evaluate((f) => document.querySelector(`#fmt button[data-v="${f}"]`).click(), fmt);
await p.waitForFunction(() => window.__app.scene && window.__app.scene.duration > 5);
await p.waitForTimeout(6000);
const d = await p.evaluate(() => window.__app.scene.duration);
for (const k of [0.15, 0.4, 0.7]) {
  await p.evaluate((t) => { const s = document.querySelector('#seek, input[type=range]'); window.__t = t; }, d * k);
  const url = await p.evaluate(async (t) => { const a = window.__app, c = document.createElement('canvas'), pc = document.querySelector('canvas'); c.width = pc.width; c.height = pc.height; a.scene.draw(c.getContext('2d'), t); return c.toDataURL('image/png'); }, d * k);
  const fs = await import('node:fs'); fs.writeFileSync(`${pre}-${fmt}-${Math.round(k * 100)}.png`, Buffer.from(url.split(',')[1], 'base64'));
}
console.log('dur', d); await b.close();
