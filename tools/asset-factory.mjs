import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildScenes } from './asset-factory-scenes.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RECIPE = JSON.parse(readFileSync(join(ROOT, 'asset-factory/travel-scrapbook.recipe.json'), 'utf8'));
const BASE = join(ROOT, 'assets/travel-scrapbook');
const OUT = join(BASE, 'generated');
const P = RECIPE.palette;
const assets = [];
const sha = (data) => createHash('sha256').update(data).digest('hex');
const n = (x) => Number(x.toFixed(2));
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const wrap = (body, w = 512, h = 512, defs = '') =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" fill="none">' +
  (defs ? '<defs>' + defs + '</defs>' : '') + body + '</svg>';
const put = (path, data) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); };
function add(id, category, variant, body, meta = {}) {
  const w = meta.width || 512, h = meta.height || 512;
  const data = wrap(body, w, h, meta.defs || '');
  const path = join(OUT, category, id + '.svg');
  put(path, data);
  assets.push({
    id, world: RECIPE.id, category, variant, kind: 'svg', path: relative(BASE, path).replaceAll('\\', '/'),
    preview: relative(BASE, path).replaceAll('\\', '/'), size: { width: w, height: h },
    transparent: true, tags: meta.tags || [category, variant],
    usage: meta.usage || 'Декоративный слой композиции',
    animation: meta.animation || 'none', source: 'procedural Route Story Asset Factory',
    license: 'MIT (код проекта)', attribution: 'не требуется', sha256: sha(data)
  });
}

const line = (d, color = P.ink, width = 8, extra = '') =>
  '<path d="' + d + '" stroke="' + color + '" stroke-width="' + width + '" stroke-linecap="round" stroke-linejoin="round" ' + extra + '/>';
const rect = (x, y, w, h, fill, rx = 0, stroke = '', sw = 0) =>
  '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + rx + '" fill="' + fill + '"' +
  (stroke ? ' stroke="' + stroke + '" stroke-width="' + sw + '"' : '') + '/>';
const circle = (x, y, r, fill, stroke = '', sw = 0) =>
  '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '"' +
  (stroke ? ' stroke="' + stroke + '" stroke-width="' + sw + '"' : '') + '/>';

const icons = {
  compass: '<circle cx="256" cy="256" r="116"/><path d="M256 94v44m0 236v44M94 256h44m236 0h44M315 197l-32 86-86 32 32-86z"/>',
  mountain: '<path d="M68 374 198 144l75 129 47-74 124 175H68Z"/><path d="m163 207 35 30 31-25m65 62 26 17 26-19"/>',
  lake: '<path d="M58 202c38 0 38 28 76 28s38-28 76-28 38 28 76 28 38-28 76-28 38 28 76 28M58 282c38 0 38 28 76 28s38-28 76-28 38 28 76 28 38-28 76-28 38 28 76 28M58 362c38 0 38 28 76 28s38-28 76-28 38 28 76 28 38-28 76-28 38 28 76 28"/>',
  sun: '<circle cx="256" cy="256" r="76"/><path d="M256 70v64m0 244v64M70 256h64m244 0h64M124 124l45 45m174 174 45 45m0-264-45 45M169 343l-45 45"/>',
  tent: '<path d="M66 374 256 112l190 262H66Zm190-262v262m-76 0 76-120 76 120"/>',
  camera: '<path d="M92 174h70l22-34h144l22 34h70v208H92V174Z"/><circle cx="256" cy="278" r="70"/><circle cx="379" cy="207" r="7"/>',
  train: '<rect x="124" y="92" width="264" height="296" rx="58"/><path d="M154 180h204v100H154zM153 350h206M180 388l-34 44m186-44 34 44"/><circle cx="180" cy="320" r="9"/><circle cx="332" cy="320" r="9"/>',
  pin: '<path d="M256 440S118 298 118 212a138 138 0 0 1 276 0c0 86-138 228-138 228Z"/><circle cx="256" cy="212" r="44"/>',
  clock: '<circle cx="256" cy="256" r="170"/><path d="M256 146v120l84 58"/>',
  wind: '<path d="M68 178h280c56 0 66-80 10-80-35 0-51 25-51 48M68 258h346c48 0 49 76-2 76-31 0-43-19-43-39M68 342h200c49 0 55 72 7 72-26 0-40-17-40-37"/>',
  ascent: '<path d="M84 390 212 262l74 74 142-190M324 146h104v104"/>',
  border: '<path d="M256 80v352M80 256h352M140 110l84 52-84 52v84l84 52-84 52M372 110l-84 52 84 52v84l-84 52 84 52"/>'
};

for (const [name, shape] of Object.entries(icons)) {
  const mark = '<g stroke="' + P.ink + '" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none">' + shape + '</g>';
  add('icon-' + name, 'icons', name, mark, { tags: ['icon', name, 'wayfinding'], usage: 'Пиктограмма факта или события; не подменяет реальное GPS-событие', animation: 'fade 600ms' });
  const back = '<path d="M95 90Q245 42 423 86L447 192Q480 341 398 431L140 446Q45 373 61 238Z" fill="' + P.paperLight + '" stroke="' + P.ink + '" stroke-width="9"/>';
  add('sticker-' + name, 'stickers', name, back + '<g transform="translate(97 100) scale(.62)" stroke="' + P.rust + '" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" fill="none">' + shape + '</g>',
    { tags: ['sticker', name, 'cutout'], usage: 'Наклейка на бумажный слой; один главный знак на кадр', animation: 'photo-lift 900ms' });
}

const frameKinds = ['archival', 'polaroid', 'postage', 'double-rule', 'torn', 'film', 'fieldnote', 'museum'];
for (const [i, name] of frameKinds.entries()) {
  let body = '';
  if (name === 'polaroid') body = rect(28, 24, 456, 468, P.paperLight, 5, P.rule, 4) + rect(54, 50, 404, 342, 'none', 1, P.ink, 5);
  else if (name === 'film') {
    body = rect(20, 36, 472, 440, P.ink, 9) + rect(72, 60, 368, 392, 'none', 2, P.paperLight, 5);
    for (let y = 70; y < 450; y += 55) body += rect(34, y, 23, 28, P.paperLight, 3) + rect(455, y, 23, 28, P.paperLight, 3);
  } else if (name === 'postage') {
    body = rect(34, 34, 444, 444, P.paperLight, 0, P.rust, 5);
    for (let x = 38; x < 476; x += 34) body += circle(x, 34, 8, P.paper) + circle(x, 478, 8, P.paper);
    for (let y = 38; y < 476; y += 34) body += circle(34, y, 8, P.paper) + circle(478, y, 8, P.paper);
    body += rect(65, 65, 382, 382, 'none', 0, P.rust, 3);
  } else if (name === 'torn') {
    body = '<path d="M35 50 85 44 126 53 169 43 220 50 259 43 309 53 360 43 409 50 475 43 469 99 478 150 468 203 478 255 469 310 478 363 467 411 474 470 423 463 374 476 318 465 270 476 220 466 169 476 120 465 78 476 40 464 45 412 35 360 44 307 35 253 45 203 35 152 44 101Z" fill="' + P.paperLight + '" stroke="' + P.rule + '" stroke-width="3"/>' + rect(68, 70, 376, 372, 'none', 0, P.ink, 3);
  } else {
    body = rect(34, 34, 444, 444, 'none', name === 'museum' ? 14 : 2, name === 'museum' ? P.rust : P.ink, name === 'archival' ? 11 : 5);
    if (name === 'double-rule' || name === 'museum') body += rect(50, 50, 412, 412, 'none', 0, P.rule, 3);
    if (name === 'fieldnote') body += line('M75 85h100M75 105h65M75 405h360M75 425h220', P.rule, 4);
    if (name === 'archival') body += circle(256, 34, 9, P.rust) + circle(256, 478, 9, P.rust);
  }
  add('frame-' + name, 'frames', name, body, { tags: ['frame', name, 'photo'], usage: 'Рамка поверх фото; выравнивать фото по внутреннему окну', animation: 'photo-lift 900ms' });
}

const ticketKinds = ['rail', 'ferry', 'road', 'summit', 'arrival', 'passport'];
for (const [i, name] of ticketKinds.entries()) {
  const c = [P.rust, P.lake, P.olive][i % 3];
  let body = '<path d="M42 100h428v108a31 31 0 0 0 0 62v140H42V270a31 31 0 0 0 0-62V100Z" fill="' + P.paperLight + '" stroke="' + c + '" stroke-width="8"/>';
  body += line('M360 111v287', c, 5, 'stroke-dasharray="8 13"');
  body += rect(66, 125, 270, 13, c) + rect(66, 170, 210, 5, P.rule) + rect(66, 210, 225, 5, P.rule);
  body += line('M72 358h250M72 379h190', P.rule, 4);
  body += circle(414, 342, 28, 'none', c, 6) + line('M394 342h40M414 322v40', c, 4);
  if (name === 'passport') body += rect(380, 140, 68, 90, 'none', 5, c, 4);
  if (name === 'summit') body += line('m390 230 24-41 24 41', c, 6);
  add('ticket-' + name, 'tickets', name, body, { tags: ['ticket', name, 'paper'], usage: 'Пустой билетный модуль; текст маршрута кладётся отдельным слоем', animation: 'slide 850ms' });
}

const stampKinds = ['compass', 'mountain', 'lake', 'sun', 'tent', 'camera', 'train', 'pin'];
for (const name of stampKinds) {
  const shape = icons[name];
  const body = circle(256, 256, 205, 'none', P.rust, 10) + circle(256, 256, 175, 'none', P.rust, 4) +
    '<g transform="translate(166 166) scale(.35)" stroke="' + P.rust + '" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" fill="none">' + shape + '</g>' +
    circle(256, 72, 8, P.rust) + circle(256, 440, 8, P.rust);
  add('stamp-' + name, 'stamps', name, body, { tags: ['stamp', name, 'ink'], usage: 'Штамп события; использовать только когда событие есть в данных', animation: 'stamp 650ms' });
}

const tapeKinds = ['linen', 'stripe', 'grid', 'dots', 'hatch', 'ledger', 'wave', 'check'];
for (const [i, name] of tapeKinds.entries()) {
  let body = '<path d="M8 18 64 23 126 16 192 21 253 16 321 21 388 16 453 22 504 15v107l-54-5-65 7-65-7-65 5-64-6-65 7-66-6-52 5V18Z" fill="' + (i % 2 ? P.lake : P.olive) + '" fill-opacity=".72"/>';
  for (let x = 28; x < 500; x += 38) {
    if (name === 'dots') body += circle(x, 69, 5, P.paperLight);
    else if (name === 'grid' || name === 'ledger') body += line('M' + x + ' 22v97', P.paperLight, 2);
    else if (name === 'check') body += line('m' + x + ' 68 8 8 15-18', P.paperLight, 3);
    else if (name === 'wave') body += line('M' + x + ' 66q10-18 20 0', P.paperLight, 3);
    else body += line('M' + x + ' 22l' + (name === 'hatch' ? 33 : 0) + ' 96', P.paperLight, name === 'linen' ? 1 : 3);
  }
  if (name === 'grid' || name === 'ledger') body += line('M12 67h488', P.paperLight, 2);
  add('tape-' + name, 'tapes', name, body, { width: 512, height: 140, tags: ['washi', name, 'adhesive'], usage: 'Крепление фото или карты; допускается поворот ±8°', animation: 'fade 600ms' });
}

const routeKinds = ['ink', 'pencil', 'stitched', 'double', 'dotted', 'wash', 'survey', 'field'];
const routePath = 'M35 385C90 360 108 235 174 278S262 365 310 226 405 144 475 105';
for (const [i, name] of routeKinds.entries()) {
  let body = '';
  if (name === 'double') body = line(routePath, P.paperLight, 22) + line(routePath, P.rust, 8);
  else if (name === 'wash') body = line(routePath, P.lake, 32, 'opacity=".25"') + line(routePath, P.ink, 5);
  else if (name === 'stitched') body = line(routePath, P.ink, 8, 'stroke-dasharray="2 18"');
  else if (name === 'dotted') body = line(routePath, P.rust, 10, 'stroke-dasharray="1 20"');
  else if (name === 'survey') body = line(routePath, P.ink, 4, 'stroke-dasharray="30 8 4 8"');
  else if (name === 'field') body = line(routePath, P.olive, 16, 'opacity=".28"') + line(routePath, P.ink, 5, 'stroke-dasharray="46 10"');
  else body = line(routePath, name === 'pencil' ? P.rule : P.ink, name === 'pencil' ? 5 : 9, name === 'pencil' ? 'opacity=".75"' : '');
  body += circle(35, 385, 10, P.paperLight, P.ink, 5) + circle(475, 105, 10, P.rust);
  add('route-' + name, 'routes', name, body, { tags: ['route', name, 'parametric'], usage: 'Системный образец штриха; в сцене его геометрия заменяется реальным треком', animation: 'ink-draw 2400ms' });
}

for (let variant = 1; variant <= 8; variant++) {
  let body = '';
  for (let j = 0; j < 9; j++) {
    const y = 50 + j * 51, amp = 13 + (variant % 3) * 6, phase = variant * 0.7 + j * 0.4;
    let d = 'M0 ' + n(y + Math.sin(phase) * amp);
    for (let x = 16; x <= 512; x += 16) d += ' L' + x + ' ' + n(y + Math.sin(x / (51 + variant * 3) + phase) * amp + Math.cos(x / 90 + j) * 6);
    body += line(d, j % 3 === 0 ? P.rust : P.olive, j % 3 === 0 ? 2.5 : 1.7, 'opacity="' + (0.24 + variant * 0.025).toFixed(2) + '"');
  }
  add('topo-' + String(variant).padStart(2, '0'), 'topography', 'contours-' + variant, body,
    { tags: ['topography', 'contour', 'decorative'], usage: 'Декоративные изолинии; не выдавать за высоты реального маршрута', animation: 'fade 600ms' });
}

for (const [name, gap] of [['ruled', 56], ['ledger', 48], ['dot-grid', 40], ['coordinate', 64]]) {
  let body = '';
  if (name === 'dot-grid') {
    for (let x = 24; x < 512; x += gap) for (let y = 24; y < 512; y += gap) body += circle(x, y, 2, P.rule);
  } else {
    for (let y = gap; y < 512; y += gap) body += line('M0 ' + y + 'h512', P.rule, name === 'coordinate' ? 1.2 : 1.8, 'opacity=".45"');
    if (name !== 'ruled') for (let x = gap; x < 512; x += gap) body += line('M' + x + ' 0v512', P.rule, 1, 'opacity=".4"');
    if (name === 'ruled') body += line('M72 0v512', P.rust, 2, 'opacity=".42"');
  }
  add('paper-' + name, 'paper-overlays', name, body,
    { tags: ['paper', 'grid', name], usage: 'Прозрачный оверлей поверх бумажной текстуры', animation: 'none' });
}

for (const r of RECIPE.rasterSources) {
  const p = join(ROOT, r.path);
  if (!existsSync(p)) throw Error('Missing raster source: ' + p);
  const bytes = readFileSync(p);
  if (bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw Error('Not a PNG: ' + p);
  assets.push({
    id: r.id, world: RECIPE.id, category: 'textures', variant: r.id, kind: 'png',
    path: relative(BASE, p).replaceAll('\\', '/'), preview: relative(BASE, p).replaceAll('\\', '/'),
    size: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }, transparent: bytes[25] === 6,
    tags: ['texture', r.id, 'generated'], usage: r.id === 'paper-fiber' ? 'Фон страницы' : 'Акварельный слой за маршрутом или фото',
    animation: 'fade 900ms', source: r.origin, prompt: r.prompt, license: 'проектный сгенерированный ассет',
    attribution: 'не требуется', sha256: sha(bytes)
  });
}

const scenes = buildScenes({ ROOT, BASE, OUT, RECIPE, assets, put, sha });
const motions = JSON.parse(readFileSync(join(ROOT, 'asset-factory/travel-scrapbook.motion.json'), 'utf8'));
put(join(BASE, 'motion.json'), JSON.stringify(motions, null, 2) + '\n');
const manifest = {
  schemaVersion: 1, world: RECIPE.id, recipe: '../../asset-factory/travel-scrapbook.recipe.json',
  generatedBy: 'node tools/asset-factory.mjs', assetCount: assets.length, sceneCount: scenes.length,
  palette: RECIPE.palette, typography: RECIPE.typography, motion: RECIPE.motion, motionLibrary: 'motion.json',
  assets, scenes
};
put(join(BASE, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const options = ['all', ...new Set(assets.map((a) => a.category))];
const cards = assets.map((a) =>
  '<article class="asset" data-category="' + esc(a.category) + '"><div class="thumb"><img src="' + esc(a.preview) + '" loading="lazy" alt=""></div>' +
  '<div class="meta"><strong>' + esc(a.id) + '</strong><small>' + esc(a.category) + ' · ' + a.size.width + '×' + a.size.height + ' · ' + (a.transparent ? 'alpha' : 'opaque') + '</small>' +
  '<p>' + esc(a.usage) + '</p></div></article>').join('');
const html = '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Travel Scrapbook · Asset Factory</title><style>body{margin:0;background:#20241f;color:#f4ecd9;font:15px Inter,system-ui,sans-serif}header{padding:48px max(24px,5vw);border-bottom:1px solid #5b6457}h1{font:600 clamp(36px,6vw,72px) Georgia,serif;margin:0 0 8px}p{line-height:1.5}nav{display:flex;gap:8px;flex-wrap:wrap;margin-top:24px}button{background:#39443b;border:1px solid #64705e;color:#f4ecd9;border-radius:40px;padding:10px 16px;cursor:pointer}button.on{background:#bb7957;color:#1d221e}.grid{padding:32px max(24px,5vw);display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:20px}.asset{background:#30392f;border:1px solid #4b5b4b;border-radius:14px;overflow:hidden}.thumb{height:210px;display:grid;place-items:center;background:linear-gradient(45deg,#d7d0bc 25%,#e9e2d0 25% 50%,#d7d0bc 50% 75%,#e9e2d0 75%);background-size:24px 24px}.thumb img{max-width:85%;max-height:85%;object-fit:contain}.meta{padding:14px}.meta strong{display:block;font-size:14px}.meta small{color:#b7c3b4}.meta p{font-size:12px;color:#d5ddcc;min-height:34px}</style>' +
  '<header><h1>Travel Scrapbook</h1><p>' + assets.length + ' ассетов · ' + scenes.length + ' сцен · один воспроизводимый рецепт</p><p><a style="color:#eac59b" href="demo/">Открыть анимированную демонстрацию →</a></p><nav>' +
  options.map((o) => '<button data-filter="' + esc(o) + '"' + (o === 'all' ? ' class="on"' : '') + '>' + esc(o) + '</button>').join('') +
  '</nav></header><main class="grid">' + cards + '</main><script>document.querySelectorAll("button[data-filter]").forEach(b=>b.onclick=()=>{document.querySelectorAll("button[data-filter]").forEach(x=>x.classList.toggle("on",x===b));document.querySelectorAll(".asset").forEach(x=>x.hidden=b.dataset.filter!=="all"&&x.dataset.category!==b.dataset.filter)})</script></html>';
put(join(BASE, 'index.html'), html);
if (!process.argv.includes('--no-preview')) await import('./asset-factory-preview.mjs');
if (!process.argv.includes('--no-preview')) await import('./asset-factory-test.mjs');
console.log('Travel Scrapbook: ' + assets.length + ' assets, ' + scenes.length + ' scenes');
