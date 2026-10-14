// Телефон: эмуляция Android (390×844, касания, pointer: coarse), процессор медленнее в THROTTLE раз (по умолчанию 4).
// Свой файл → экспорт с настройками по умолчанию → проверка готового MP4. Видеокарту не отключает: это проверка нагрузки на процессор,
// интерфейса и мобильных пределов рельефа, а не настоящий телефон.
// Запуск: node tools/phone-test.mjs   (сервер на 4180; URL=… — другой адрес; RELIEF=off — без рельефа; THROTTLE=6)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const URL_ = process.env.URL || 'http://localhost:4180/', THROTTLE = +(process.env.THROTTLE || 4), OUT = 'out/phone';
mkdirSync(OUT, { recursive: true });
let bad = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) bad++; };

const b = await chromium.launch({ channel: 'msedge', headless: true, args: process.env.SOFT ? ['--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });   // SOFT=1 — без видеокарты
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
await p.goto(URL_);
await p.waitForFunction(() => window.__app && window.__app.state.lastEp, null, { timeout: 120000 });

const ui = await p.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, res: document.getElementById('res').value, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, style: window.__app.state.styleId }));
ok(ui.coarse, 'телефон распознан (pointer: coarse)');
ok(ui.res === 'sd', `качество по умолчанию на телефоне: ${ui.res} (ожидали sd = HD 720)`);
ok(ui.sw <= ui.cw, `без горизонтальной прокрутки (${ui.sw}/${ui.cw})`);
ok(ui.style === 'journal', `стиль по умолчанию: ${ui.style}`);
const tap = await p.evaluate(() => [...document.querySelectorAll('button')].filter((x) => x.offsetParent && (x.getBoundingClientRect().width < 44 || x.getBoundingClientRect().height < 44) && !x.closest('.colors')).map((x) => x.textContent.trim().slice(0, 20)).slice(0, 6));
ok(tap.length === 0, `кнопки не меньше 44×44${tap.length ? ': ' + tap.join(', ') : ''}`);

if (process.env.RELIEF === 'off') { await p.click('#tabs button[data-t="look"]'); await p.selectOption('#relief', 'off'); }
await p.setInputFiles('#file', 'samples/samarkand-bukhara.gpx');
await p.waitForFunction(() => window.__app.state.route && !window.__app.state.routeIsDemo, null, { timeout: 120000 });
await p.waitForTimeout(2500);
const head = await p.evaluate(() => document.getElementById('headline').textContent);
ok(/Бухар|Самарканд/.test(head), `маршрут загружен: ${head.slice(0, 50)}`);
const vis = await p.evaluate(() => { const e = document.getElementById('export').getBoundingClientRect(); return e.width > 0 && e.top < innerHeight * 1.2; });
ok(vis, 'кнопка «Скачать видео» рядом с первым экраном');

const t0 = Date.now(); await p.tap('#export');
await p.waitForFunction(() => window.__lastExport || !document.getElementById('err').hidden, null, { timeout: 1200000 });
const sec = Math.round((Date.now() - t0) / 1000), err = await p.evaluate(() => (document.getElementById('err').hidden ? '' : document.getElementById('err').textContent));
ok(!err, `экспорт без ошибки${err ? ': ' + err : ''} (за ${sec} с при замедлении процессора ×${THROTTLE})`);
if (!err) {
  const b64 = await p.evaluate(async () => { const x = window.__lastExport; const buf = new Uint8Array(await (await fetch(x.url)).arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); });
  const f = `${OUT}/phone.mp4`; writeFileSync(f, Buffer.from(b64, 'base64'));
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height', '-of', 'json', f], { encoding: 'utf8' }));
  const v = j.streams.find((s) => s.codec_type === 'video') || {}, a = j.streams.find((s) => s.codec_type === 'audio');
  ok(v.codec_name === 'h264' && v.width === 720 && v.height === 1280, `файл: ${v.codec_name} ${v.width}×${v.height}, ${(+j.format.duration).toFixed(0)} с, ${(j.format.size / 1048576).toFixed(1)} МБ`);
  ok(!a, 'звука нет (встроенной музыки больше нет)');
}
ok(errs.length === 0, `ошибок страницы: ${errs.length}${errs.length ? ' — ' + errs[0] : ''}`);
await b.close();
console.log(bad ? `\nПАДЕНИЙ: ${bad}` : '\nВСЕ ПРОВЕРКИ ПРОШЛИ'); process.exit(bad ? 1 : 0);
