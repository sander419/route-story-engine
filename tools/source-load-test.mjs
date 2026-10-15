// Запоздавшее демо не меняет выбранный файл и не стирает ошибку его загрузки.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const resource of ['data/demo-journey.json', 'samples/day47.gpx']) {
    for (const lateFail of [false, true]) {
    for (const invalid of [false, true]) {
      const c = await b.newContext(), p = await c.newPage(), errors = [];
      p.on('pageerror', e => errors.push(e.message));
      let release, arrived;
      const gate = new Promise(r => release = r), held = new Promise(r => arrived = r);
      await p.route('**/' + resource, async route => {
        arrived(); await gate;
        await route.fulfill({ status: lateFail ? 503 : 200, body: lateFail ? 'unavailable' : readFileSync(resource), contentType: resource.endsWith('.json') ? 'application/json' : 'application/xml' });
      });
      try {
        await p.goto('http://localhost:4180/', { waitUntil: 'domcontentloaded' });
        await held;
        await p.setInputFiles('#file', invalid
          ? { name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('not a route') }
          : 'samples/short-section.geojson');
        await p.waitForFunction(bad => bad ? !document.getElementById('err').hidden : window.__app.state.route && !window.__app.state.routeIsDemo, invalid);
        const get = () => p.evaluate(() => {
          const s = __app.state;
          return { mode: s.mode, base: s.seriesBase?.id, km: s.route?.total, demo: !!s.demoDay, photos: s.o.photos.length, note: s.o.note, error: document.getElementById('err').hidden ? '' : document.getElementById('err').textContent };
        });
        const before = await get();
        const response = p.waitForResponse(r => r.url().endsWith('/' + resource));
        release(); await (await response).finished(); await p.waitForTimeout(1200);
        const after = await get(), label = resource + '/' + (lateFail ? 'late-failure/' : '') + (invalid ? 'invalid' : 'own');
        if (invalid) assert.equal(after.error, before.error, label + ': фоновое демо стёрло ошибку');
        else {
          assert.equal(after.base, 'my', label + ': своё путешествие заменено');
          assert.equal(after.mode, 'series', label + ': ранняя загрузка ушла в старый режим');
          assert.equal(after.km, before.km, label + ': свой маршрут заменён');
          assert.equal(after.demo, false, label + ': вернулось демо');
          assert.equal(after.photos, 0, label + ': появились демо-фото');
          assert.equal(after.note, '', label + ': появилась демо-фраза');
          assert.equal(after.error, '', label + ': ошибка устаревшего запроса');
        }
        assert.deepEqual(errors, [], label + ': ошибки страницы');
        console.log('OK', label);
      } finally { release(); await c.close(); }
    }
    }
  }
  const c = await b.newContext(), p = await c.newPage();
  try {
    await p.goto('http://localhost:4180/');
    await p.waitForFunction(() => window.__app?.state.demoDay);
    await p.click('#wj');
    await p.waitForFunction(() => __app.state.seriesBase?.schematic);
    await p.click('#day47');
    await p.waitForFunction(() => __app.state.demoDay && __app.state.seriesBase?.id === 'demo-samara-baikal');
    console.log('OK обычный запуск → герой → демо-день');
  } finally { await c.close(); }
} finally { await b.close(); }
