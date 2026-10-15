// Полный путь оформления: настройки → перезагрузка → пиксели предпросмотра → MP4 обоих форматов.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
let bad = 0;
const ok = (c,m) => { console.log((c ? 'OK ' : 'FAIL ') + m); if (!c) bad++; };
try {
  const p = await b.newPage({ viewport: { width:1440, height:900 } }), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:4180/');
  await p.waitForFunction(() => window.__app?.state?.lastEp);
  await p.click('#tabs button[data-t="look"]');
  await p.selectOption('#headingFont', 'prata'); await p.selectOption('#bodyFont', 'onest');
  await p.click('[data-palette="forest"]');
  ok(await p.evaluate(() => __app.state.appearance.heading === 'prata' && __app.state.appearance.body === 'onest'), 'палитра сохраняет выбор шрифтов');
  await p.evaluate(() => {
    const values = { bg:'#294647', text:'#ffe4a8', muted:'#c5e0dd', accent:'#d4b18a', route:'#eac570', land:'#91aa7d', water:'#63899d', shade:'#15383f', photoText:'#fff5dc', finalBg:'#b2cfa7', finalText:'#20372b' };
    for (const [key,value] of Object.entries(values)) { const input = document.getElementById('hex-' + key); input.value = value; input.dispatchEvent(new Event('change')); }
  });
  await p.reload(); await p.waitForFunction(() => window.__app?.state?.lastEp);
  const saved = await p.evaluate(() => __app.state.appearance);
  ok(saved.heading === 'prata' && saved.body === 'onest' && saved.bg === '#294647' && saved.finalBg === '#b2cfa7', 'шрифты и цвета сохранены после перезагрузки');
  const faces = await p.evaluate(async () => { await Appearance.ready(); return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g,'')); });
  ok(['Cormorant Garamond','Onest','Prata'].every(f => faces.includes(f)), 'все новые локальные шрифты загружены');
  const safe = await p.evaluate(() => Appearance.normalize({bg:'url(bad)', heading:'__proto__'}));
  ok(safe.bg === '#152a32' && safe.heading === 'cormorant', 'некорректные сохранённые значения заменяются безопасными');
  for (const fmt of ['v','h']) {
    await p.evaluate(fmt => { document.querySelector(`#fmt button[data-v="${fmt}"]`).click(); const e = document.getElementById('res'); e.value = 'sd'; e.dispatchEvent(new Event('change')); }, fmt);
    await p.waitForTimeout(600);
    const frames = await p.evaluate(async () => {
      const scene = __app.scene; await scene.assetsReady;
      const beats = __app.state.lastEp.res.plan.beats, cv = document.createElement('canvas'); cv.width=scene.W; cv.height=scene.H;
      const ctx = cv.getContext('2d'), fonts = new Set(), fillText = ctx.fillText.bind(ctx);
      ctx.fillText = function(...args) { fonts.add(this.font); return fillText(...args); };
      const shots = [];
      for (const recipe of ['day-card','route-reveal','photo-reveal','pullback']) {
        const beat = beats.find(q => q.recipe === recipe); if (!beat) continue;
        scene.draw(ctx, beat.startSec + beat.durationSec * .75); shots.push(cv.toDataURL('image/jpeg',.85));
      }
      const pixel = [...ctx.getImageData(2,2,1,1).data];
      return { shots, pixel, fonts:[...fonts] };
    });
    ok(frames.pixel.slice(0,3).join(',') === '178,207,167', `${fmt}: свой цвет финала реально нарисован`);
    ok(frames.fonts.some(f => f.includes('Prata')) && frames.fonts.some(f => f.includes('Onest')), `${fmt}: выбранные шрифты применены на canvas`);
    frames.shots.forEach((data,i) => writeFileSync(`out/appearance-${fmt}-${i}.jpg`,Buffer.from(data.split(',')[1],'base64')));
    await p.click('#export');
    await p.waitForFunction(() => window.__lastExport || !document.getElementById('err').hidden, null, {timeout:180000});
    const data = await p.evaluate(async () => {
      if (!document.getElementById('err').hidden) throw new Error(document.getElementById('err').textContent);
      const blob = await (await fetch(__lastExport.url)).blob();
      return new Promise(resolve => { const r = new FileReader(); r.onload=()=>resolve(r.result); r.readAsDataURL(blob); });
    });
    const file = `out/appearance-${fmt}.mp4`; writeFileSync(file,Buffer.from(data.split(',')[1],'base64'));
    const probe = JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_name,width,height','-of','json',file],{encoding:'utf8'}));
    const stream = probe.streams[0]; ok(stream.codec_name === 'h264' && stream.width === (fmt === 'v' ? 720:1280), `${fmt}: MP4 H.264 нужного формата`);
    const sample = execFileSync('ffmpeg',['-v','error','-ss','23','-i',file,'-vf','crop=2:2:2:2,scale=1:1','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1']);
    ok(sample.length === 3 && [178,207,167].every((n,i) => Math.abs(sample[i]-n) <= 12), `${fmt}: цвет настроек присутствует в готовом MP4`);
    await p.evaluate(() => { window.__lastExport = null; });
  }
  await p.click('#tabs button[data-t="look"]');
  await p.locator('#appearanceBox details:not(.labels) summary').click();
  await p.locator('#appearanceBox').screenshot({path:'out/appearance-controls.png'});
  await p.click('#appearanceReset');
  ok(await p.evaluate(() => __app.state.appearance.heading === 'cormorant' && __app.state.appearance.preset === 'coast'), 'сброс возвращает исходную пару и палитру');
  ok(errors.length === 0, 'без ошибок страницы: ' + errors.join('; '));
} finally { await b.close(); }
if (bad) process.exit(1);
