// Продолжение своего путешествия восстанавливает поля последнего дня, а не поля демо.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const c = await b.newContext(), p = await c.newPage();
  await p.goto('http://localhost:4180/');
  await p.waitForFunction(() => window.__app?.state.demoDay);
  await p.setInputFiles('#file', 'samples/short-section.geojson');
  await p.waitForFunction(() => __app.state.seriesBase?.id === 'my');
  const J = await p.evaluate(() => JSON.parse(localStorage.getItem('route-story-my-journey')));
  await p.route('https://nominatim.openstreetmap.org/**', r => r.fulfill({ contentType: 'application/json', body: '{}' }));
  await p.click('#tabs button[data-t="text"]');
  await p.fill('#startName', 'Иркутск'); await p.fill('#endName', 'Байкал');
  const oldKm = await p.evaluate(() => __app.state.route.total);
  await p.setInputFiles('#file', 'samples/samarkand-bukhara.gpx');
  await p.waitForFunction(km => __app.state.route.total !== km, oldKm);
  const names = await p.evaluate(() => ({ from: document.getElementById('startName').value, to: document.getElementById('endName').value }));
  assert.notEqual(names.from, 'Иркутск', 'новый маршрут унаследовал старый старт без ответа сервиса');
  assert.notEqual(names.to, 'Байкал', 'новый маршрут унаследовал старый финиш без ответа сервиса');
  console.log('OK новый день не наследует прежние названия при недоступном сервисе');
  await c.close();
  const day = J.days.at(-1);
  day.from = 'Старт моего дня'; day.to = 'Финиш моего дня'; day.noteIds = ['resume-note'];
  J.notes = [{ id: 'resume-note', day: day.day, text: 'Моя сохранённая фраза' }];
  const next = await b.newContext(), page = await next.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(j => localStorage.setItem('route-story-my-journey', JSON.stringify(j)), J);
  await page.goto('http://localhost:4180/');
  await page.waitForFunction(() => window.__app?.state.demoDay);
  await page.click('#tabs button[data-t="text"]');
  await page.fill('#startName', 'Иркутск'); await page.fill('#endName', 'Байкал');
  await page.fill('#note', 'Демо-фраза');
  await page.click('#tabs button[data-t="route"]');
  await page.click('#continue');
  await page.waitForFunction(() => __app.state.seriesBase?.id === 'my');
  const restored = await page.evaluate(() => ({
    from: document.getElementById('startName').value, to: document.getElementById('endName').value,
    note: document.getElementById('note').value, ctxFrom: __app.state.lastEp.res.ctx.from,
    ctxTo: __app.state.lastEp.res.ctx.to, base: __app.state.seriesBase.id,
  }));
  assert.deepEqual(restored, { from: day.from, to: day.to, note: J.notes[0].text, ctxFrom: day.from, ctxTo: day.to, base: 'my' });
  if (process.env.SAVE_FRAMES) {
    const frames = await page.evaluate(async () => {
      await Appearance.ready();
      const { J, res } = __app.state.lastEp, out = [];
      const skins = { journal: ['paper', 'yeseva', 'geologica'], night: ['night', 'din', 'din'], editorial: ['magazine', 'geologica', 'geologica'], paper: ['trail', 'prata', 'onest'] };
      for (const fmt of ['v', 'h']) for (const [styleId, s] of Object.entries(skins)) {
        const W = fmt === 'v' ? 540 : 960, H = fmt === 'v' ? 960 : 540;
        const scene = Episode.createEpisodeScene({ journey: J, plan: res.plan, styleId, relief: false, appearance: Appearance.normalize({ ...Appearance.palettes[s[0]], heading: s[1], body: s[2] }) }, W, H);
        await scene.assetsReady;
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const beat = res.plan.beats[0]; scene.draw(cv.getContext('2d'), beat.startSec + beat.durationSec * .8);
        out.push({ name: `${styleId}-${fmt}`, data: cv.toDataURL().split(',')[1] });
      }
      return out;
    });
    for (const f of frames) writeFileSync(`out/resume-${f.name}.png`, Buffer.from(f.data, 'base64'));
  }
  assert.deepEqual(errors, []); await next.close();
  console.log('OK поля и контекст ролика восстановлены из сохранённого дня');
} finally { await b.close(); }
