import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json'); const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const p = await b.newPage();
  // Реальный демо-трек у Байкала: фиксируем известную страну вместо зависимости от ответа сети.
  await p.route('https://nominatim.openstreetmap.org/**', r => r.fulfill({ contentType: 'application/json', body: '{"address":{"country":"Россия"}}' }));
  await p.goto('http://localhost:4180/'); await p.waitForFunction(() => window.__app?.state.lastEp?.J.days.at(-1).country === 'Россия');
  const result = await p.evaluate(async () => {
    await Appearance.ready(); const { J, res } = __app.state.lastEp, frames = []; let count = 0;
    const photoStart = res.plan.beats.find(b => Journal.FAM[b.recipe] === 'photo').startSec;
    const skins = { journal: ['paper','yeseva','geologica'], night: ['night','din','din'], editorial: ['magazine','geologica','geologica'], paper: ['trail','prata','onest'] };
    for (const fmt of ['v','h']) for (const [styleId, sk] of Object.entries(skins)) {
      const W = fmt === 'v' ? 540 : 960, H = fmt === 'v' ? 960 : 540, u = .5;
      const sc = Episode.createEpisodeScene({ journey: J, plan: res.plan, styleId, relief: false, appearance: Appearance.normalize({ ...Appearance.palettes[sk[0]], heading: sk[1], body: sk[2] }) }, W,H); await sc.assetsReady;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
      const fillText = ctx.fillText.bind(ctx), drawImage = ctx.drawImage.bind(ctx); let texts = [], symbols = [], saved = false, countryFrames = 0;
      const rect = (x,y,w,h) => { const t = ctx.getTransform(), a = t.transformPoint({x,y}), b = t.transformPoint({x:x+w,y:y+h}); return [a.x,a.y,b.x,b.y]; };
      ctx.fillText = function(s,x,y) { if (this.globalAlpha > .5) { const m = this.measureText(s); texts.push({ s, box: rect(x-m.actualBoundingBoxLeft,y-m.actualBoundingBoxAscent,m.actualBoundingBoxLeft+m.actualBoundingBoxRight,m.actualBoundingBoxAscent+m.actualBoundingBoxDescent) }); } return fillText(s,x,y); };
      ctx.drawImage = function(im,...a) { if (im.src?.includes('/flags/') && a.length === 4 && this.globalAlpha > .5) symbols.push(rect(...a)); return drawImage(im,...a); };
      for (let t = 0; t < sc.duration; t += .25) {
        texts = []; symbols = []; sc.draw(ctx,t); count++;
        const country = texts.find(q => q.s === 'Россия'); if (!country) continue; countryFrames++;
        const group = [country.box,...symbols], union = [Math.min(...group.map(b=>b[0])), Math.min(...group.map(b=>b[1])), Math.max(...group.map(b=>b[2])), Math.max(...group.map(b=>b[3]))];
        for (const q of texts.filter(q => q !== country)) {
          const a = union, z = q.box;
          if (a[0]<z[2] && a[2]>z[0] && a[1]<z[3] && a[3]>z[1]) throw new Error(`${fmt}/${styleId}/${t}: страна перекрывает ${q.s}`);
        }
        const title = texts.find(q => q.s === 'Байкал');
        if (title && union[1] - title.box[3] < 20*u) throw new Error(`${fmt}/${styleId}/${t}: недостаточный отступ от Байкала`);
        if (title && !saved && t > photoStart + 1.2) { frames.push({ name: `${styleId}-${fmt}`, data: cv.toDataURL().split(',')[1] }); saved = true; }
      }
      if (!saved || countryFrames < 4) throw new Error(`${fmt}/${styleId}: последовательность с Байкалом не проверена`);
    } return { frames,count };
  });
  assert.equal(result.frames.length,8); mkdirSync('out/symbol-sequence',{recursive:true});
  for (const f of result.frames) writeFileSync(`out/symbol-sequence/${f.name}.png`,Buffer.from(f.data,'base64'));
  console.log(`Настоящая демо-последовательность: ${result.count} кадров, 4 стиля v/h, Байкал/Россия без наложений — OK`);
} finally { await b.close(); }
