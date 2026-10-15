// Три экрана должны иметь разные детали даже при одинаковой палитре и шрифтах.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:4180/');
  await page.waitForFunction(() => window.__app?.state?.lastEp);
  const result = await page.evaluate(async save => {
    await Appearance.ready();
    const { J, res } = window.__app.state.lastEp, frames = [], checked = [];
    const photo = res.plan.beats.find(b => ['photo-reveal','highlights-reel'].includes(b.recipe));
    if (!photo) throw new Error('В примере нет фото для проверки');
    const skins = { journal: ['paper','yeseva','geologica'], night: ['night','din','din'], editorial: ['magazine','geologica','geologica'], paper: ['trail','prata','onest'] };
    for (const fmt of ['v','h']) for (const kind of ['photo','arrival','final']) {
      const W = fmt === 'v' ? 540 : 960, H = fmt === 'v' ? 960 : 540, u = .5, signatures = [];
      const b = kind === 'photo' ? { ...photo } : kind === 'arrival' ? { recipe: 'checkpoint-arrival', params: { label: 'Байкал', kind: 'city' } } : { recipe: 'day-summary', params: { km: 69, gain: 237 } };
      const plan = { ...res.plan, durationSec: 5, beats: [{ ...b, startSec: 0, durationSec: 5 }] };
      for (const theme of ['common','default']) for (const [styleId, skin] of Object.entries(skins)) {
        const appearance = Appearance.normalize({ ...Appearance.palettes[theme === 'common' ? 'magazine' : skin[0]], heading: theme === 'common' ? 'geologica' : skin[1], body: theme === 'common' ? 'geologica' : skin[2] });
        const scene = Episode.createEpisodeScene({ journey: J, plan, styleId, appearance, relief: false }, W, H);
        await scene.assetsReady;
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const ctx = cv.getContext('2d'), outside = [], original = ctx.fillText.bind(ctx);
        ctx.fillText = function(str,x,y) {
          const m = this.measureText(str), tr = this.getTransform();
          const qs = [[x-m.actualBoundingBoxLeft,y-m.actualBoundingBoxAscent],[x+m.actualBoundingBoxRight,y+m.actualBoundingBoxDescent]].map(([x,y])=>tr.transformPoint({x,y}));
          if (this.globalAlpha > .1 && qs.some(q=>q.x < -2 || q.y < -2 || q.x > W+2 || q.y > H+2)) outside.push(str);
          return original(str,x,y);
        };
        scene.draw(ctx,3);
        if (outside.length) throw new Error(`${fmt}/${kind}/${styleId}: текст за кадром ${outside}`);
        if (theme === 'common') {
          // Свободная область под подписью, без текста, шапки и карты.
          const y = kind === 'photo' ? H - (fmt === 'v' ? 255 : 245)*u : kind === 'arrival' ? (fmt === 'v' ? 695 : 595)*u : (fmt === 'v' ? 1210 : 1000)*u;
          const data = ctx.getImageData(86*u, y-18*u, 310*u, 60*u).data;
          let hash = 2166136261; for (const v of data) hash = Math.imul(hash ^ v,16777619)>>>0;
          signatures.push(hash);
        } else if (save) frames.push({ name: `${kind}-${styleId}-${fmt}`, data: cv.toDataURL('image/png').split(',')[1] });
      }
      if (new Set(signatures).size !== 4) throw new Error(`${fmt}/${kind}: детали стилей не различаются (${signatures})`);
      checked.push(`${fmt}/${kind}`);
    }
    return { checked, frames };
  }, !!process.env.SAVE_FRAMES);
  if (errors.length) throw new Error(errors.join('\n'));
  for (const f of result.frames) writeFileSync(`out/character-${f.name}.png`,Buffer.from(f.data,'base64'));
  console.log('OK: детали четырёх стилей различаются при общей палитре; текст помещается:',result.checked.join(', '));
} finally { await browser.close(); }
