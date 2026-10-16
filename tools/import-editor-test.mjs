// Повтор файла сохраняет редактор; другая дата — новый день; обрезка не добавляет день.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const loop = day => {
  const pts = Array.from({ length: 61 }, (_, i) => {
    const a = Math.PI * 2 * i / 60, t = new Date(Date.UTC(2026, 8, day, 7, i)).toISOString();
    return `<trkpt lat="${(40 + .015 * Math.cos(a)).toFixed(6)}" lon="${(44 + .02 * Math.sin(a)).toFixed(6)}"><ele>100</ele><time>${t}</time></trkpt>`;
  }).join('');
  return { name: `loop-${day}.gpx`, mimeType: 'application/gpx+xml', buffer: Buffer.from(`<gpx version="1.1"><trk><name>Audit loop</name><trkseg>${pts}</trkseg></trk></gpx>`) };
};
const b = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const mode of process.env.CASE ? [process.env.CASE] : ['duplicate', 'duplicate-trim', 'saved', 'dates', 'trim', 'invalid', 'trim-pending']) {
    const c = await b.newContext(), p = await c.newPage(), errors = [];
    p.on('pageerror', e => { errors.push(e.message); console.error(mode, e.stack); });
    try {
      await p.route('https://nominatim.openstreetmap.org/**', r => r.fulfill({ contentType: 'application/json', body: '{}' }));
      await p.goto('http://localhost:4180/'); await p.waitForFunction(() => window.__app?.state.demoDay);
      await p.setInputFiles('#file', loop(1)); await p.waitForFunction(() => __app.state.seriesBase?.id === 'my');
      const snap = () => p.evaluate(() => {
        const s = __app.state;
        return { days: s.seriesBase.days.length, total: s.seriesBase.days.reduce((a, d) => a + d.km, 0), km: s.route.total,
          note: s.o.note, photos: s.o.photos.map(p => ({ caption: p.caption, url: p.url })), dates: s.seriesBase.days.map(d => d.date),
          historyPhotos: s.seriesBase.media.map(m => m.caption), historyNotes: s.seriesBase.notes.map(n => n.text) };
      });
      const initial = await snap();
      await p.click('#tabs button[data-t="text"]'); await p.fill('#note', 'Моя фраза первого дня');
      await p.click('#tabs button[data-t="photo"]'); await p.setInputFiles('#photos', 'art/unicycle-real.webp');
      await p.waitForFunction(() => __app.state.o.photos.length === 1);
      await p.fill('#photoList input', 'Снимок первого дня'); const edited = await snap();
      if (mode === 'saved') {
        await p.waitForTimeout(300);
        await p.evaluate(() => { const j = JSON.parse(JSON.stringify(__app.state.lastEp.J)); j.media = []; j.days.forEach(d => d.media = []); localStorage.setItem('route-story-my-journey', JSON.stringify(j)); });
        await p.reload(); await p.waitForFunction(() => window.__app?.state.demoDay);
        await p.click('#tabs button[data-t="text"]'); await p.fill('#startName', 'Иркутск'); await p.fill('#endName', 'Байкал');
        await p.setInputFiles('#file', loop(1)); await p.waitForTimeout(800);
        const after = await snap();
        assert.equal(after.days, 1); assert.equal(after.note, edited.note, 'выбор сохранённого дня оставил фразу демо');
        assert.deepEqual(after.photos, [], 'в своё путешествие попали демо-фото');
        assert.equal(await p.evaluate(() => !!__app.state.demoDay), false);
      } else if (mode === 'duplicate' || mode === 'duplicate-trim') {
        await p.setInputFiles('#file', loop(1)); await p.waitForTimeout(800);
        const after = await snap();
        assert.equal(after.days, 1); assert.equal(after.note, edited.note, 'повтор файла стёр фразу');
        assert.deepEqual(after.photos, edited.photos, 'повтор файла стёр фото/подпись');
        if (mode === 'duplicate-trim') {
          await p.evaluate(() => { const e = document.getElementById('trimA'); e.value = 20; e.dispatchEvent(new Event('input', { bubbles: true })); });
          await p.waitForTimeout(1200); const trimmed = await snap();
          assert.equal(trimmed.days, 1, 'обрезка после повтора добавила день');
          assert.equal(trimmed.note, edited.note); assert.deepEqual(trimmed.photos, edited.photos);
          assert.ok(trimmed.km / initial.km > .75 && trimmed.km / initial.km < .85);
        }
      } else if (mode === 'dates') {
        await p.setInputFiles('#file', loop(2)); await p.waitForTimeout(800);
        const after = await snap();
        assert.equal(after.days, 2, 'поездка в другую дату признана дубликатом');
        assert.deepEqual(after.dates, ['2026-09-01', '2026-09-02']);
        assert.ok(Math.abs(after.total - initial.total * 2) < .1);
        assert.equal(after.note, ''); assert.deepEqual(after.photos, []);
        assert.ok(after.historyPhotos.includes('Снимок первого дня')); assert.ok(after.historyNotes.includes(edited.note));
      } else {
        if (mode === 'trim-pending') {
          await p.evaluate(() => { const original = File.prototype.text; File.prototype.text = async function() { await new Promise(resolve => window.releaseTrimRead = resolve); return original.call(this); }; });
        }
        if (mode === 'invalid') {
          await p.setInputFiles('#file', { name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('not a route') });
          await p.waitForFunction(() => !document.getElementById('err').hidden);
        }
        await p.evaluate(() => { const e = document.getElementById('trimA'); e.value = 20; e.dispatchEvent(new Event('input', { bubbles: true })); });
        if (mode === 'trim-pending') {
          await p.waitForFunction(() => typeof window.releaseTrimRead === 'function');
          await p.click('#tabs button[data-t="text"]'); await p.fill('#note', 'Фраза во время обрезки');
          await p.waitForTimeout(600); assert.deepEqual(errors, [], 'предпросмотр строится по пустой временной базе');
          assert.notEqual(await p.evaluate(async () => (await RSDrafts.load())?.journey.days.length), 0, 'автосохранение записало временную пустую базу');
          await p.evaluate(() => releaseTrimRead()); edited.note = 'Фраза во время обрезки';
        }
        await p.waitForTimeout(1200); const after = await snap();
        assert.ok(after.km / initial.km > .75 && after.km / initial.km < .85, 'обрезка перестала работать после выбора файла');
        assert.equal(after.days, 1, 'обрезка добавила лишний день');
        assert.equal(after.note, edited.note, 'обрезка стёрла фразу'); assert.deepEqual(after.photos, edited.photos, 'обрезка стёрла фото');
      }
      if (mode === 'dates' && process.env.SAVE_FRAMES) {
        const frames = await p.evaluate(async () => {
          await Appearance.ready(); const { J, res } = __app.state.lastEp, out = [];
          const skins = { journal: ['paper', 'yeseva', 'geologica'], night: ['night', 'din', 'din'], editorial: ['magazine', 'geologica', 'geologica'], paper: ['trail', 'prata', 'onest'] };
          for (const fmt of ['v', 'h']) for (const [styleId, s] of Object.entries(skins)) {
            const W = fmt === 'v' ? 540 : 960, H = fmt === 'v' ? 960 : 540;
            const scene = Episode.createEpisodeScene({ journey: J, plan: res.plan, styleId, relief: false, appearance: Appearance.normalize({ ...Appearance.palettes[s[0]], heading: s[1], body: s[2] }) }, W, H);
            await scene.assetsReady;
            for (const family of ['cover', 'fin']) {
              const beat = res.plan.beats.find(b => Journal.FAM[b.recipe] === family);
              const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
              scene.draw(cv.getContext('2d'), beat.startSec + beat.durationSec * .8);
              out.push({ name: `${styleId}-${fmt}-${family}`, data: cv.toDataURL().split(',')[1] });
            }
          }
          return out;
        });
        mkdirSync('out/import-editor', { recursive: true });
        for (const f of frames) writeFileSync(`out/import-editor/${f.name}.png`, Buffer.from(f.data, 'base64'));
      }
      assert.deepEqual(errors, []); console.log('OK', mode);
    } finally { await c.close(); }
  }
} finally { await b.close(); }
