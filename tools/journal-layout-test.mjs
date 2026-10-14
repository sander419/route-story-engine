// Регрессия оформления: длинные подписи не выходят за кадр в обоих форматах.
// Синтетические строки используются только в тесте, не сохраняются в проектные данные.
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const p = await b.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://localhost:4180/');
  await p.waitForFunction(() => window.__app?.state?.lastEp);
  for (const fmt of ['v', 'h']) {
    const result = await p.evaluate(async fmt => {
      await document.fonts.ready;
      const base = await (await fetch('data/demo-journey.json')).json();
      const rt = RouteLib.prepare(RouteLib.parseAny(await (await fetch('samples/day47.gpx')).text(), 'test.gpx'));
      const line = []; for (let i = 0; i < rt.n; i += 2) line.push([rt.lon[i], rt.lat[i]]);
      const caption = 'Длинная подпись к фотографии: остановка на берегу, дорога вдоль воды и воспоминание о путешествии';
      const { journey } = Director.addDay(base, { km: 69, line, to: 'Очень длинное название конечного пункта маршрута', gain: 237, date: '2026-08-16' }, [{ kind: 'photo', url: 'media/demo/baikal-1.jpg', caption }], [{ text: 'Длинная главная фраза для проверки переноса строк на обложке' }]);
      const W = fmt === 'v' ? 540 : 960, H = fmt === 'v' ? 960 : 540, outside = []; let texts = 0;
      for (const type of ['returning-viewer', 'story-so-far']) {
        const { plan } = Director.direct(journey, type, { aspect: fmt === 'v' ? '9:16' : '16:9' });
        const scene = Episode.createEpisodeScene({ journey, plan, styleId: 'journal', showRelief: false }, W, H);
        await scene.assetsReady;
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const ctx = cv.getContext('2d'), original = ctx.fillText.bind(ctx);
        ctx.fillText = function(str, x, y, max) {
          const m = this.measureText(str), tr = this.getTransform();
          const points = [[x - m.actualBoundingBoxLeft, y - m.actualBoundingBoxAscent], [x + m.actualBoundingBoxRight, y + m.actualBoundingBoxDescent]].map(([a,b]) => tr.transformPoint({x:a,y:b}));
          if (this.globalAlpha > .1 && points.some(q => q.x < -2 || q.y < -2 || q.x > W + 2 || q.y > H + 2)) outside.push({ type, str: String(str), points: points.map(q => [q.x,q.y]) });
          texts++; return max == null ? original(str,x,y) : original(str,x,y,max);
        };
        for (const beat of plan.beats) scene.draw(ctx, beat.startSec + beat.durationSec * .7);
      }
      return { texts, outside };
    }, fmt);
    console.log(fmt, JSON.stringify(result));
    if (!result.texts || result.outside.length) throw new Error('Текст вышел за кадр');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Оба формата: длинные строки помещаются в кадр');
} finally { await b.close(); }
