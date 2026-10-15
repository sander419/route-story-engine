import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json'); const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const p = await b.newPage(); await p.goto('http://localhost:4180/'); await p.waitForFunction(() => window.__app?.state.demoDay);
  assert.equal(await p.locator('#play').getAttribute('aria-label'), 'Пауза', 'кнопка паузы объявляет действие Играть');
  await p.click('#play'); assert.equal(await p.locator('#play').getAttribute('aria-label'), 'Играть');
  for (const tab of ['route','text','photo','look']) {
    const button = p.locator(`#tabs [data-t="${tab}"]`); await button.click();
    assert.equal(await button.getAttribute('aria-current'), 'step'); assert.equal(await button.locator('svg').count(), 1);
  }
  await p.click('#styles [data-id="night"]'); assert.equal(await p.locator('#styles [aria-pressed="true"]').getAttribute('data-id'), 'night');
  await p.click('#fmt [data-v="h"]'); assert.equal(await p.locator('#fmt [aria-pressed="true"]').getAttribute('data-v'), 'h');
  assert.equal(await p.locator('#err').getAttribute('role'), 'alert'); assert.equal(await p.locator('#prog').getAttribute('role'), 'progressbar');
  const startProgress = await p.evaluate(() => { prog.setAttribute('aria-valuenow','100'); document.getElementById('export').click(); const n = +prog.getAttribute('aria-valuenow'); document.getElementById('export').click(); return n; });
  assert.ok(startProgress < 100, 'новый экспорт объявляет старые 100%');
  await p.waitForFunction(() => document.getElementById('prog').hidden, null, { timeout: 90000 });
  await p.setInputFiles('#file', 'samples/day47.gpx'); await p.waitForFunction(() => __app.state.seriesBase?.id === 'my');
  await p.click('#tabs [data-t="photo"]'); await p.setInputFiles('#photos', 'art/unicycle-real.webp'); await p.waitForFunction(() => __app.state.o.photos.length === 1);
  const initial = await p.evaluate(() => __app.state.o.photos[0].s), range = p.getByRole('slider', { name: 'Место фото 1 на маршруте', exact: true });
  await range.focus(); await p.keyboard.press('ArrowRight');
  assert.ok(await p.evaluate(() => __app.state.o.photos[0].s) > initial, 'клавиатура не двигает фото');
  assert.match(await p.locator('#photoList small').textContent(), /вручную/); assert.match(await range.getAttribute('aria-valuetext'), /км/);
  assert.equal(await p.evaluate(() => document.activeElement.id), 'photo-position-0', 'ползунок теряет фокус при движении');
  mkdirSync('out/controls', { recursive: true }); await p.screenshot({ path: 'out/controls/desktop.png', fullPage: true });
  await p.setViewportSize({ width: 390, height: 844 }); await p.click('#tabs [data-t="look"]'); await p.waitForTimeout(250); await p.screenshot({ path: 'out/controls/phone.png', fullPage: true });
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log('Иконки, состояния действий/выбора, ошибки, прогресс и клавиатурное место фото — OK');
} finally { await b.close(); }
