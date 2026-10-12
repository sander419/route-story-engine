import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:4180/');
const m = () => p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  wide: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 4).map(e => (e.id || e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().right)) }));
console.log('start', JSON.stringify(await m()));
await p.evaluate(async () => { const a = window.__app; a.loadJourney(await (await fetch('data/journey-wahrider.json')).json()); a.setMode('journey'); });
await p.waitForFunction(() => window.__app.scene && window.__app.scene.duration > 5);
await p.waitForTimeout(800);
console.log('journey', JSON.stringify(await m()));
await p.evaluate(() => document.getElementById('export').scrollIntoView());
const png = await p.evaluate(async () => { const sc = window.__app.scene, cv = document.getElementById('cv'), c = cv.getContext('2d'); const t = 22; for (let k=0;k<3;k++) for (const q of sc.tilesAt(t)) await window.RS.getTile(q.layer,q.z,q.x,q.y,true).p; sc.draw(c, t); return cv.toDataURL(); });
(await import('node:fs')).writeFileSync('out/j-mobile.png', Buffer.from(png.split(',')[1], 'base64'));
await b.close();
