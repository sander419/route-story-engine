// Шрифты: свои файлы грузятся, цифры счётчиков одной ширины, нужные знаки не уходят на системный шрифт.
// Запуск: node tools/fonts-test.mjs   (сервер на 4180; код выхода 1 при провале)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const report = JSON.parse(readFileSync(new URL('../fonts/build-report.json', import.meta.url), 'utf8')).fonts;
let bad = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) bad++; };

const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage();
const external = [];
p.on('request', (r) => { const h = new URL(r.url()).host; if (/googleapis|gstatic/.test(h)) external.push(h); });
await p.goto(process.env.URL || 'http://localhost:4180/');
await p.waitForFunction(() => window.__app && window.__app.state.lastEp, null, { timeout: 60000 });
await p.waitForTimeout(800);

ok(external.length === 0, `запросов к Google Fonts: ${external.length}`);

// 1. все гарнитуры загружены (через document.fonts, а не check(): check() для незагруженных возвращает true)
const faces = await p.evaluate(async () => {
  const want = ['400 40px "Yeseva One"', '400 40px "Marck Script"', '700 40px "RS DINish"', '400 40px "RS Geologica"', '700 40px "RS Geologica"', '700 40px "RS Geologica Num"'];
  for (const w of want) await document.fonts.load(w, 'АаЯя0123');
  return [...document.fonts].map((f) => `${f.family.replace(/"/g, '')}|${f.status}`);
});
for (const fam of ['Yeseva One', 'Marck Script', 'RS DINish', 'RS Geologica', 'RS Geologica Num']) {
  ok(faces.some((f) => f === `${fam}|loaded`), `загружен: ${fam}`);
}

// 2. шрифт реально применяется на canvas и цифры у «цифровых» гарнитур одной ширины
const m = await p.evaluate(() => {
  const ctx = document.createElement('canvas').getContext('2d'); const out = {};
  const w = (font, t) => { ctx.font = font; return ctx.measureText(t).width; };
  const applied = (fam, wt) => Math.abs(w(`${wt} 100px "${fam}", serif`, 'Самарканд Бухара') - w(`${wt} 100px "НетТакогоШрифта", serif`, 'Самарканд Бухара')) > 1;
  const spread = (fam, wt) => { const ws = [...'0123456789'].map((d) => w(`${wt} 100px "${fam}", serif`, d)); return +(Math.max(...ws) - Math.min(...ws)).toFixed(2); };
  for (const [fam, wt] of [['Yeseva One', 400], ['Marck Script', 400], ['RS DINish', 700], ['RS Geologica', 400], ['RS Geologica', 700], ['RS Geologica Num', 600], ['RS Geologica Num', 700]]) out[`${fam} ${wt}`] = { applied: applied(fam, wt), spread: spread(fam, wt) };
  return out;
});
for (const [k, v] of Object.entries(m)) ok(v.applied, `на canvas применяется: ${k}`);
// допуск 2 % кегля: у вариативных шрифтов ширина табличных цифр на разной жирности расходится на ~1 % (у пропорциональных — 17–27 %)
for (const k of ['RS DINish 700', 'RS Geologica Num 600', 'RS Geologica Num 700']) ok(m[k].spread < 2, `цифры одной ширины: ${k} (разброс ${m[k].spread} px на 100 px)`);

// 3. знаки продукта: в каждом стиле каждый нужный знак есть хотя бы в одной нашей гарнитуре стека
const NEED = '→≈−№«»°АаЁёЙйЪъ0123456789+·';
const stacks = await p.evaluate(() => Object.fromEntries(Object.entries(window.RS.STYLES).map(([k, s]) => [k, { fHead: s.fHead, fNum: s.fNum, fBody: s.fBody }])));
const cover = (fam) => { const r = report[fam]; return r ? (c) => !(r.missingGlyphs || '').includes(c) : null; };
for (const [style, st] of Object.entries(stacks)) {
  for (const role of ['fHead', 'fNum', 'fBody']) {
    if (!st[role]) { ok(false, `${style}: нет ${role}`); continue; }
    const fams = [...st[role].matchAll(/"([^"]+)"/g)].map((x) => x[1]).filter((f) => report[f]);
    const lost = [...NEED].filter((c) => !fams.some((f) => cover(f)(c)));
    ok(fams.length > 0 && lost.length === 0, `${style}.${role}: ${fams.join(' → ')}${lost.length ? ' — уйдёт на системный шрифт: ' + lost.join('') : ''}`);
  }
}
await b.close();
console.log(bad ? `\nПАДЕНИЙ: ${bad}` : '\nВСЕ ПРОВЕРКИ ПРОШЛИ');
process.exit(bad ? 1 : 0);
