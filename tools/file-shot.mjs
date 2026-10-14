// Кадры «Дневника» для своего файла маршрута: node tools/file-shot.mjs <файл> <префикс> [доли времени через запятую]
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const [,, file, pre = 'out/fs', ks = '0.2,0.35,0.5,0.7'] = process.argv;
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto('http://localhost:4180/');
await p.waitForFunction(() => window.__app && window.__app.state.lastEp, null, { timeout: 60000 });
await p.setInputFiles('#file', file); await p.waitForTimeout(6000);
const d = await p.evaluate(() => window.__app.scene.duration); console.log('dur', d);
for (const k of ks.split(',').map(Number)) {
  const url = await p.evaluate(async (t) => { const sc = window.__app.scene, pc = document.querySelector('canvas'), c = document.createElement('canvas'); c.width = pc.width; c.height = pc.height; sc.draw(c.getContext('2d'), t); return c.toDataURL('image/png'); }, d * k);
  writeFileSync(`${pre}-${Math.round(k * 100)}.png`, Buffer.from(url.split(',')[1], 'base64'));
}
await b.close();
