import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const hash = x => createHash('sha256').update(x).digest('hex');
const file = day => ({ name: `day-${day}.gpx`, mimeType: 'application/gpx+xml', buffer: Buffer.from('<gpx><trk><trkseg>' + Array.from({ length: 40 }, (_, i) => `<trkpt lat="${40 + i * .001}" lon="${44 + i * .001}"><time>2026-09-${String(day).padStart(2, '0')}T07:${String(i).padStart(2, '0')}:00Z</time></trkpt>`).join('') + '</trkseg></trk></gpx>') });
const path = `out/draft-profile-${Date.now()}`;
mkdirSync('out', { recursive: true });
let c;
async function open() {
  c = await chromium.launchPersistentContext(path, { channel: 'msedge', headless: true });
  const p = c.pages()[0]; await p.route('https://nominatim.openstreetmap.org/**', r => r.fulfill({ contentType: 'application/json', body: '{}' }));
  await p.goto('http://localhost:4180/'); await p.waitForFunction(() => window.__app?.state.demoDay); return p;
}
try {
  let p = await open();
  await p.setInputFiles('#file', file(1)); await p.waitForFunction(() => __app.state.seriesBase?.id === 'my');
  await p.click('#tabs button[data-t="text"]'); await p.fill('#note', 'Сохранённая фраза'); await p.fill('#startName', 'Мой старт'); await p.fill('#endName', 'Мой финиш');
  await p.click('#addNote'); await p.fill('#tnotes input:not([type])', 'Спица сломалась здесь');
  await p.click('#tabs button[data-t="photo"]'); await p.setInputFiles('#photos', 'art/unicycle-real.webp'); await p.waitForFunction(() => __app.state.o.photos.length === 1);
  await p.fill('#photoList input', 'Оригинал без пересжатия');
  await p.locator('#pmap').scrollIntoViewIfNeeded(); const box = await p.locator('#pmap').boundingBox(), pin = await p.evaluate(() => ({ xy: __pmapPins()[0], w: pmap.width, h: pmap.height }));
  await p.mouse.move(box.x + pin.xy[0] / pin.w * box.width, box.y + (pin.xy[1] - 38) / pin.h * box.height); await p.mouse.down(); await p.mouse.move(box.x + box.width * .8, box.y + box.height * .3, { steps: 8 }); await p.mouse.up();
  const position = await p.evaluate(() => __app.state.o.photos[0].s);
  await p.waitForTimeout(1200); await c.close();
  p = await open(); await p.click('#continue');
  await p.waitForFunction(() => __app.state.seriesBase?.id === 'my'); await p.waitForTimeout(600);
  const restored = await p.evaluate(async () => {
    const s = __app.state, photo = s.o.photos[0];
    return { note: s.o.note, from: s.o.startName, to: s.o.endName, notes: s.o.tnotes, caption: photo?.caption, position: photo?.s,
      bytes: photo ? Array.from(new Uint8Array(await (await fetch(photo.url)).arrayBuffer())) : null, route: !!s.route, total: s.route?.total };
  });
  assert.equal(restored.caption, 'Оригинал без пересжатия', 'после закрытия браузера потеряно фото/подпись');
  assert.equal(hash(Buffer.from(restored.bytes)), hash(readFileSync('art/unicycle-real.webp')), 'исходный файл изменён');
  assert.equal(restored.position, position); assert.equal(restored.note, 'Сохранённая фраза'); assert.equal(restored.from, 'Мой старт'); assert.equal(restored.to, 'Мой финиш');
  assert.deepEqual(restored.notes, [{ text: 'Спица сломалась здесь', f: .3 }]); assert.ok(restored.route);
  await p.click('#tabs button[data-t="photo"]'); assert.match(await p.locator('#photoList small').textContent(), /вручную/);
  assert.match(await p.locator('#draftStatus').textContent(), /сохранены/);
  if (process.env.SAVE_FRAMES) {
    const frames = await p.evaluate(async () => {
      await Appearance.ready(); const { J, res } = __app.state.lastEp, out = [];
      const skins = { journal: ['paper', 'yeseva', 'geologica'], night: ['night', 'din', 'din'], editorial: ['magazine', 'geologica', 'geologica'], paper: ['trail', 'prata', 'onest'] };
      for (const fmt of ['v', 'h']) for (const [styleId, s] of Object.entries(skins)) {
        const W = fmt === 'v' ? 540 : 960, H = fmt === 'v' ? 960 : 540;
        const scene = Episode.createEpisodeScene({ journey: J, plan: res.plan, styleId, relief: false, appearance: Appearance.normalize({ ...Appearance.palettes[s[0]], heading: s[1], body: s[2] }) }, W, H); await scene.assetsReady;
        const beat = res.plan.beats.find(b => Journal.FAM[b.recipe] === 'photo');
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H; scene.draw(cv.getContext('2d'), beat ? beat.startSec + beat.durationSec * .6 : res.plan.durationSec * .4);
        out.push({ name: `${styleId}-${fmt}`, data: cv.toDataURL().split(',')[1], photo: !!beat });
      } return out;
    });
    mkdirSync('out/draft', { recursive: true });
    for (const f of frames) { assert.ok(f.photo, 'в восстановленной серии нет фото'); writeFileSync(`out/draft/${f.name}.png`, Buffer.from(f.data, 'base64')); }
    await p.click('#tabs button[data-t="route"]'); await p.screenshot({ path: 'out/draft/status.png' });
  }
  if (process.env.EXPORT) {
    mkdirSync('out/draft', { recursive: true }); await p.evaluate(() => res.value = 'sd');
    for (const fmt of ['v', 'h']) {
      await p.evaluate(fmt => document.querySelector(`#fmt [data-v="${fmt}"]`).click(), fmt);
      const old = await p.evaluate(() => window.__lastExport?.url); await p.click('#export');
      await p.waitForFunction(old => window.__lastExport && __lastExport.url !== old, old, { timeout: 180000 });
      const wait = p.waitForEvent('download'); await p.locator('#result a').click(); const d = await wait, name = `out/draft/restored-${fmt}.mp4`; await d.saveAs(name);
      const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height', '-of', 'json', name], { encoding: 'utf8' })).streams[0];
      assert.equal(probe.codec_name, 'h264'); assert.deepEqual([probe.width, probe.height], fmt === 'v' ? [720, 1280] : [1280, 720]);
    }
  }
  await p.evaluate(() => { window.originalSave = RSDrafts.save; RSDrafts.save = async () => { throw new DOMException('Storage full', 'QuotaExceededError'); }; });
  await p.click('#tabs button[data-t="text"]'); await p.fill('#note', 'Фраза при ошибке хранения');
  await p.waitForFunction(() => draftStatus.textContent.includes('Не удалось сохранить'));
  assert.equal(await p.evaluate(() => __app.state.o.photos.length), 1, 'ошибка хранения очистила редактор');
  await p.evaluate(() => RSDrafts.save = originalSave); await p.fill('#note', 'Сохранённая фраза');
  await p.waitForFunction(() => draftStatus.textContent.includes('сохранены'));
  await p.setInputFiles('#file', file(1)); await p.waitForTimeout(700); assert.equal(await p.evaluate(() => __app.state.o.tnotes.length), 1);
  await p.evaluate(() => { trimA.value = 10; trimA.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(900);
  assert.equal(await p.evaluate(() => __app.state.o.tnotes.length), 1); assert.ok(await p.evaluate(() => __app.state.route.total) < restored.total);
  await p.setInputFiles('#file', file(2)); await p.waitForTimeout(700);
  assert.deepEqual(await p.evaluate(() => __app.state.o.tnotes), [], 'заметка старого дня попала в новый');
  await p.click('#tabs button[data-t="text"]'); await p.click('#addNote'); await p.fill('#tnotes input:not([type])', 'Мой день 2');
  await p.click('#tabs button[data-t="route"]'); await p.click('#day47'); await p.waitForTimeout(1000);
  assert.equal(await p.evaluate(() => __app.state.seriesBase.id), 'demo-samara-baikal', 'демо-день приклеен к своему путешествию');
  assert.deepEqual(await p.evaluate(() => __app.state.o.tnotes), [], 'своя заметка попала в демо');
  const oldJourney = await p.evaluate(() => JSON.parse(localStorage.getItem('route-story-my-journey')));
  await c.close(); p = await open();
  await p.evaluate(async () => { window.originalLoad = RSDrafts.load; window.heldDraft = await RSDrafts.load(); RSDrafts.load = () => new Promise(resolve => window.releaseDraft = resolve); });
  await p.click('#continue'); await p.setInputFiles('#file', file(3)); await p.waitForFunction(() => __app.state.seriesBase?.id === 'my');
  await p.evaluate(() => releaseDraft(heldDraft)); await p.waitForTimeout(600);
  assert.equal(await p.evaluate(() => __app.state.seriesBase.days.at(-1).date), '2026-09-03', 'запоздавший черновик заменил новый выбор');
  await p.click('#resetOwn'); await p.waitForTimeout(700);
  assert.equal(await p.evaluate(() => localStorage.getItem('route-story-my-journey')), null);
  assert.equal(await p.evaluate(async () => (await originalLoad()) ?? null), null);
  await c.close();
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const legacy = await b.newContext(); await legacy.addInitScript(j => { localStorage.setItem('route-story-my-journey', JSON.stringify(j)); Object.defineProperty(window, 'indexedDB', { value: { open() { throw new Error('Unavailable'); } } }); }, oldJourney);
    const page = await legacy.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://localhost:4180/'); await page.waitForFunction(() => window.__app?.state.demoDay); await page.click('#continue'); await page.waitForFunction(() => __app.state.seriesBase?.id === 'my');
    assert.match(await page.locator('#draftStatus').textContent(), /Не удалось открыть/); assert.deepEqual(errors, []); await legacy.close();
    const resetContext = await b.newContext(); await resetContext.addInitScript(j => localStorage.setItem('route-story-my-journey', JSON.stringify(j)), oldJourney);
    const resetPage = await resetContext.newPage(); await resetPage.goto('http://localhost:4180/'); await resetPage.waitForFunction(() => window.__app?.state.demoDay);
    const demo = await resetPage.evaluate(() => ({ route: __app.state.route.name, photos: __app.state.o.photos.length, note: __app.state.o.note }));
    await resetPage.click('#resetOwn'); await resetPage.waitForTimeout(600);
    assert.deepEqual(await resetPage.evaluate(() => ({ route: __app.state.route?.name, photos: __app.state.o.photos.length, note: __app.state.o.note })), demo, 'удаление своего черновика изменило открытый пример');
    await resetContext.close();
  } finally { await b.close(); }
  console.log('Черновик: закрытие браузера, исходные байты, текст/фото/позиции, границы дней, ошибка записи/открытия, позднее восстановление, сброс — OK');
} finally { if (c) await c.close().catch(() => {}); }
