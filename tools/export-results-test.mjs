// Готовые результаты: оба формата доступны, отмена их не прячет, имя соответствует кадру.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
const OUT = 'out/export-results'; mkdirSync(OUT, { recursive: true });
const modes = process.env.CASE ? [process.env.CASE] : ['urls', 'cancel', 'format'];
try {
  for (const mode of modes) {
    const c = await b.newContext(), p = await c.newPage(), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    try {
      await p.goto('http://localhost:4180/');
      await p.waitForFunction(() => window.__app?.state.demoDay);
      await p.evaluate(() => document.getElementById('res').value = 'sd');
      const wait = old => p.waitForFunction(url => window.__lastExport && __lastExport.url !== url, old, { timeout: 180000 });
      const available = () => p.evaluate(async () => {
        const out = [];
        for (const a of document.querySelectorAll('#result a')) {
          try { const r = await fetch(a.href); out.push(r.ok && (await r.blob()).size > 10000); }
          catch { out.push(false); }
        }
        return out;
      });
      if (mode === 'format') {
        await p.evaluate(() => {
          document.querySelector('#fmt [data-v="h"]').click();
          document.getElementById('export').click();
          document.querySelector('#fmt [data-v="v"]').click();
        });
        await wait(null);
        assert.match(await p.locator('#result a').getAttribute('download'), /16x9\.mp4$/, 'имя взято из изменённого формата вместо формата экспорта');
      } else {
        await p.click('#export'); await wait(null);
        if (mode === 'urls') {
          const first = await p.evaluate(() => __lastExport.url);
          await p.click('#again'); await wait(first);
          assert.deepEqual(await available(), [true, true], 'первый MP4 недоступен после второго экспорта');
        } else {
          await p.evaluate(() => { document.getElementById('export').click(); document.getElementById('export').click(); });
          await p.waitForFunction(() => document.getElementById('prog').hidden && document.getElementById('export').textContent === 'Скачать видео');
          assert.equal(await p.locator('#result').isVisible(), true, 'отмена спрятала прошлый результат');
          assert.deepEqual(await available(), [true], 'отмена повредила прошлый файл');
        }
      }
      const links = p.locator('#result a'), n = await links.count();
      for (let i = 0; i < n; i++) {
        const promise = p.waitForEvent('download'); await links.nth(i).click(); const d = await promise;
        const file = `${OUT}/${mode}-${i}.mp4`; await d.saveAs(file);
        const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height', '-of', 'json', file], { encoding: 'utf8' })).streams[0];
        assert.equal(probe.codec_name, 'h264');
        const horizontal = mode === 'format' || (mode === 'urls' && i === 1);
        assert.deepEqual([probe.width, probe.height], horizontal ? [1280, 720] : [720, 1280]);
      }
      assert.deepEqual(errors, []);
      await p.screenshot({ path: `${OUT}/${mode}.png`, fullPage: true });
      console.log('OK', mode, n, 'настоящих MP4');
    } finally { await c.close(); }
  }
} finally { await b.close(); }
