// Полоса Журнала: контраст цифр, подписей и профиля в двух форматах.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const p = await b.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://localhost:4180/');
  await p.waitForFunction(() => window.__app?.state?.lastEp);
  const result = await p.evaluate(async save => {
    await Appearance.ready();
    const { J, res } = window.__app.state.lastEp, results = [], frames = [];
    for (const fmt of ['v', 'h']) for (const [styleId, preset] of [['editorial','magazine'], ['journal','paper'], ['night','night'], ['paper','trail'], ['editorial','night']]) {
      const appearance = Appearance.normalize({ ...Appearance.palettes[preset], preset });
      const W = fmt === 'v' ? 540 : 960, H = fmt === 'v' ? 960 : 540, u = .5;
      const beats = [
        { recipe: 'distance-counter', startSec: 0, durationSec: 5, params: { newKm: 69, totalKm: 4129 } },
        { recipe: 'elevation-profile', startSec: 5, durationSec: 5, params: { gain: 237, profile: [100,110,130,120,180,210,200,170,140], maxEle: 210, day: res.plan.episodeNumber } },
      ];
      const scene = Episode.createEpisodeScene({ journey: J, plan: { ...res.plan, beats, durationSec: 10 }, styleId, appearance, relief: false }, W, H);
      await scene.assetsReady;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d'), orig = ctx.fillText.bind(ctx), texts = [];
      ctx.fillText = function(str, x, y) {
        const q = this.getTransform().transformPoint({x,y});
        if (this.globalAlpha > .5) texts.push({ str: String(str), color: this.fillStyle, x: q.x, y: q.y });
        return orig(str,x,y);
      };
      for (const [kind, t] of [['road', 3], ['profile', 8]]) {
        texts.length = 0; scene.draw(ctx, t);
        if (styleId === 'editorial') {
          const x = fmt === 'v' ? 20 : W - 10, y = H - 45;
          const rgb = [...ctx.getImageData(x,y,1,1).data].slice(0,3);
          const wanted = [1,3,5].map(i => parseInt(appearance.text.slice(i,i+2),16));
          if (rgb.some((v,i) => Math.abs(v-wanted[i]) > 2)) throw new Error(`${fmt}/${preset}/${kind}: нет сплошной полосы (${rgb})`);
          const metric = texts.filter(q => q.y >= (fmt === 'v' ? 1380 : 350)*u && (fmt === 'v' || q.x >= 1390*u) && q.y < H-30);
          if (!metric.length || metric.some(q => q.color !== appearance.bg)) throw new Error(`${fmt}/${preset}/${kind}: неверный цвет цифр/подписей ${JSON.stringify(metric)}`);
          if (kind === 'profile' && !metric.some(q => q.str.includes('над уровнем моря'))) throw new Error('Не проверена подпись профиля');
        }
        if (save) frames.push({ name: `${styleId}-${preset}-${fmt}-${kind}`, data: cv.toDataURL('image/png').split(',')[1] });
        results.push(`${fmt}/${styleId}/${preset}/${kind}`);
      }
    }
    return { results, frames };
  }, !!process.env.SAVE_FRAMES);
  for (const f of result.frames) writeFileSync(`out/band-${f.name}.png`, Buffer.from(f.data,'base64'));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('OK', result.results.join(', '));
} finally { await b.close(); }
