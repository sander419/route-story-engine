import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const p = await b.newPage(); await p.goto('http://localhost:4180/'); await p.waitForFunction(() => window.__app?.state.demoDay);
  const frames = await p.evaluate(async () => {
    await Appearance.ready(); const { J: base, res } = __app.state.lastEp, frames = [];
    const photo = res.plan.beats.find(b => b.recipe === 'photo-reveal');
    const skins = { journal: ['paper','yeseva','geologica'], night: ['night','din','din'], editorial: ['magazine','geologica','geologica'], paper: ['trail','prata','onest'] };
    for (const country of ['Казахстан', 'Турция', 'Неизвестная страна']) for (const fmt of ['v','h']) for (const kind of ['photo','arrival']) for (const [styleId, sk] of Object.entries(skins)) for (const showFlags of [true, false]) {
      const W = fmt === 'v' ? 540 : 960, H = fmt === 'v' ? 960 : 540, u = .5;
      const J = { ...base, days: base.days.map(d => ({ ...d, country })), dayNotes: null };
      const shot = kind === 'photo' ? photo : { recipe: 'checkpoint-arrival', params: { label: 'Длинное название места прибытия на маршруте', kind: 'city' } };
      const plan = { ...res.plan, durationSec: 5, beats: [{ ...shot, startSec: 0, durationSec: 5 }] };
      const scene = Episode.createEpisodeScene({ journey: J, plan, styleId, showFlags, relief: false, appearance: Appearance.normalize({ ...Appearance.palettes[sk[0]], heading: sk[1], body: sk[2] }) }, W, H); await scene.assetsReady;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'), imgs = [], texts = [];
      const draw = ctx.drawImage.bind(ctx), text = ctx.fillText.bind(ctx);
      const rect = (x,y,w,h) => { const t = ctx.getTransform(), a = t.transformPoint({x,y}), b = t.transformPoint({x:x+w,y:y+h}); return [a.x,a.y,b.x,b.y]; };
      ctx.drawImage = function(im, ...a) { if (im.src?.includes('/flags/') && a.length === 4 && this.globalAlpha > .1) imgs.push({ src: im.src, box: rect(...a) }); return draw(im,...a); };
      ctx.fillText = function(s,x,y) { const m = this.measureText(s); if (this.globalAlpha > .5) texts.push({ s, box: rect(x-m.actualBoundingBoxLeft,y-m.actualBoundingBoxAscent,m.actualBoundingBoxLeft+m.actualBoundingBoxRight,m.actualBoundingBoxAscent+m.actualBoundingBoxDescent) }); return text(s,x,y); };
      scene.draw(ctx,3);
      const name = `${country}/${fmt}/${kind}/${styleId}/${showFlags}`;
      if (showFlags && country !== 'Неизвестная страна') {
        const label = texts.find(t => t.s === country); if (!label) throw new Error(name + ': флаг не связан с названием страны');
        const flag = imgs.find(im => im.src.includes('-flag.')); if (!flag) throw new Error(name + ': нет флага');
        const center = b => [(b[0]+b[2])/2,(b[1]+b[3])/2];
        if (Math.abs(center(flag.box)[1] - center(label.box)[1]) > 40*u) throw new Error(name + ': флаг оторван от подписи');
        if (country === 'Казахстан' && !imgs.some(im => im.src.includes('-emblem.'))) throw new Error(name + ': герб не вписан в группу');
        if (country === 'Турция' && imgs.some(im => im.src.includes('-emblem.'))) throw new Error(name + ': выдуман герб');
      } else if (imgs.length || texts.some(t => t.s === country)) throw new Error(name + ': символы показаны без данных или при выключенной настройке');
      for (const im of imgs) {
        const a = im.box; if (a[0] < 0 || a[1] < 0 || a[2] > W || a[3] > H) throw new Error(name + ': символ за кадром');
        for (const t of texts) { const q = t.box; if (a[0]<q[2] && a[2]>q[0] && a[1]<q[3] && a[3]>q[1]) throw new Error(name + ': символ перекрывает ' + t.s); }
      }
      if (country === 'Казахстан' && showFlags) frames.push({ name: `${kind}-${styleId}-${fmt}`, data: cv.toDataURL().split(',')[1] });
    } return frames;
  });
  assert.equal(frames.length, 16); mkdirSync('out/country-layout', { recursive: true });
  for (const f of frames) writeFileSync(`out/country-layout/${f.name}.png`, Buffer.from(f.data,'base64'));
  console.log('Страна: флаг, название и герб вместе; без наложений, неизвестных данных и выдуманного герба — 96 кадров OK');
} finally { await b.close(); }
