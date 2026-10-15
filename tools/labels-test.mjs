// Свои надписи и логотип доходят до кадра: node tools/labels-test.mjs
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', (e) => { console.log('pageerror:', e.message); process.exitCode = 1; });
await p.goto('http://localhost:4180/'); await p.waitForFunction(() => window.__app && window.__app.scene && window.__app.state.demoDay, null, { timeout: 60000 });
await p.evaluate(() => { const i = document.querySelector('#labelsGrid input[data-k="набор высоты"]'); i.value = 'Подъём'; i.dispatchEvent(new Event('input', { bubbles: true })); const j = document.querySelector('#labelsGrid input[data-k="день"]'); j.value = 'сутки'; j.dispatchEvent(new Event('input', { bubbles: true })); });
await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 300; c.height = 120; const g = c.getContext('2d'); g.fillStyle = '#dc2828'; g.fillRect(0, 0, 300, 120); const b = await new Promise((r) => c.toBlob(r, 'image/png')); const f = new File([b], 'logo.png', { type: 'image/png' }); const dt = new DataTransfer(); dt.items.add(f); const inp = document.getElementById('logoFile'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(4500);
const r = await p.evaluate(async () => {
  const sc = window.__app.scene, beats = window.__app.state.lastEp.res.plan.beats, el = beats.find((x) => x.recipe === 'elevation-profile'), cv = document.createElement('canvas'); cv.width = 540; cv.height = 960;
  const ctx = cv.getContext('2d'), texts = [], imgs = []; const ft = ctx.fillText.bind(ctx), di = ctx.drawImage.bind(ctx);
  ctx.fillText = (s, ...a) => { texts.push(String(s)); return ft(s, ...a); }; ctx.drawImage = (im, ...a) => { imgs.push((im && im.src ? im.src.slice(0, 22) : 'canvas')); return di(im, ...a); };
  sc.draw(ctx, el.startSec + 2); return { texts, imgs, logo: window.__app.state.logo && window.__app.state.logo.where, stored: !!localStorage.getItem('rs-logo-v1') };
});
const has = (s) => r.texts.some((t) => t.includes(s));
console.log('подъём:', has('ПОДЪЁМ'), '| старое «набор высоты» осталось:', has('НАБОР ВЫСОТЫ'), '| сутки:', has('СУТКИ'), '| логотип рисуется:', r.imgs.some((x) => x.startsWith('data:image/png')), '| сохранено:', r.stored);
const ok = has('ПОДЪЁМ') && !has('НАБОР ВЫСОТЫ') && has('СУТКИ') && r.imgs.some((x) => x.startsWith('data:image/png')) && r.stored;
await b.close(); console.log(ok ? 'OK' : 'ПАДЕНИЕ'); if (!ok) process.exit(1);
