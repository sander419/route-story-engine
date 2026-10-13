import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export function buildScenes({ ROOT, BASE, RECIPE, put, sha }) {
  const P = RECIPE.palette;
  const demo = RECIPE.demo;
  const gpx = readFileSync(join(ROOT, demo.route), 'utf8');
  const pts = [...gpx.matchAll(/<trkpt lat="([^"]+)" lon="([^"]+)"><ele>([^<]+)<\/ele>/g)]
    .map((m) => ({ lat: Number(m[1]), lon: Number(m[2]), ele: Number(m[3]) }));
  if (pts.length < 20 || pts.some((p) => !Number.isFinite(p.lat + p.lon + p.ele))) throw Error('Invalid demo GPX');
  const minLat = Math.min(...pts.map((p) => p.lat)), maxLat = Math.max(...pts.map((p) => p.lat));
  const minLon = Math.min(...pts.map((p) => p.lon)), maxLon = Math.max(...pts.map((p) => p.lon));
  const maxEle = Math.max(...pts.map((p) => p.ele));
  const minEle = Math.min(...pts.map((p) => p.ele));
  let meters = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    meters += 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  const routeKm = Math.round(meters / 1000);
  const photoCredits = JSON.parse(readFileSync(join(ROOT, demo.photoCredits), 'utf8'));
  for (const p of demo.photos) if (!photoCredits[p.split('/').pop()]) throw Error('Missing photo credit: ' + p);
  const E = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  const round = (x) => Number(x.toFixed(1));
  const href = (p) => '../../../../' + p.replaceAll('\\', '/');
  const asset = (category, id, x, y, w, h, opacity = 1, rotate = 0) =>
    '<image class="layer-' + category + '" href="../../generated/' + category + '/' + id + '.svg" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
    '" opacity="' + opacity + '" transform="rotate(' + rotate + ' ' + (x + w / 2) + ' ' + (y + h / 2) + ')"/>';
  const texture = '<image href="../../source/paper-fiber.png" width="1080" height="1920" preserveAspectRatio="xMidYMid slice"/>';
  const wash = (x, y, w, h, op = 0.72) =>
    '<image href="../../source/watercolor-wash.png" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" opacity="' + op + '"/>';
  const txt = (x, y, text, size, color = P.ink, family = 'Georgia,serif', weight = 400, extra = '') =>
    '<text x="' + x + '" y="' + y + '" fill="' + color + '" font-family="' + family + '" font-size="' + size + '" font-weight="' + weight +
    '" ' + extra + '>' + E(text) + '</text>';
  const rule = (x1, y1, x2, y2, color = P.rule, width = 3, extra = '') =>
    '<path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '" stroke="' + color + '" stroke-width="' + width + '" ' + extra + '/>';
  const route = (x, y, w, h, opts = {}) => {
    const pad = 16, dx = Math.max(1e-9, maxLon - minLon), dy = Math.max(1e-9, maxLat - minLat);
    const worldW = dx * Math.cos(((minLat + maxLat) / 2) * Math.PI / 180), worldH = dy;
    const scale = Math.min((w - pad * 2) / worldW, (h - pad * 2) / worldH);
    const dw = worldW * scale, dh = worldH * scale;
    const ox = x + (w - dw) / 2, oy = y + (h - dh) / 2;
    const projected = pts.map((p) => [
      round(ox + (p.lon - minLon) * Math.cos(((minLat + maxLat) / 2) * Math.PI / 180) * scale),
      round(oy + (maxLat - p.lat) * scale)
    ]);
    const d = projected.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
    const stroke = opts.color || P.rust, sw = opts.width || 10;
    const ghost = '<path d="' + d + '" fill="none" stroke="' + P.ink + '" stroke-width="' + (sw + 16) + '" opacity=".09" stroke-linecap="round" stroke-linejoin="round"/>';
    const main = '<path class="' + (opts.dash ? 'route-static' : 'route-ink') + '" d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round" pathLength="1000" ' +
      (opts.dash ? 'stroke-dasharray="' + opts.dash + '"' : '') + '/>';
    const start = projected[0], end = projected.at(-1);
    const pins = '<circle cx="' + start[0] + '" cy="' + start[1] + '" r="14" fill="' + P.paperLight + '" stroke="' + P.ink + '" stroke-width="6"/>' +
      '<circle cx="' + end[0] + '" cy="' + end[1] + '" r="17" fill="' + stroke + '" stroke="' + P.paperLight + '" stroke-width="5"/>';
    return { svg: ghost + main + pins, start, end, d };
  };
  const photo = (id, name, x, y, w, h, angle = 0) => {
    const p = href('media/demo/' + name);
    return '<g class="layer-photo"><g transform="rotate(' + angle + ' ' + (x + w / 2) + ' ' + (y + h / 2) + ')">' +
      '<rect x="' + (x - 20) + '" y="' + (y - 20) + '" width="' + (w + 40) + '" height="' + (h + 120) + '" fill="' + P.paperLight +
      '" stroke="' + P.rule + '" stroke-width="3" filter="url(#shadow)"/>' +
      '<clipPath id="' + id + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/></clipPath>' +
      '<image href="' + p + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + id + ')"/>' +
      '</g></g>';
  };
  const base = (inner) => '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">' +
    '<defs><filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#352e22" flood-opacity=".22"/></filter></defs>' +
    texture + inner + '</svg>';
  const footer = (y = 1802) => rule(80, y, 1000, y, P.rule, 2) +
    txt(80, y + 42, demo.routeDisclosure, 20, P.ink, 'Arial,sans-serif') +
    txt(80, y + 75, 'Фото: Thomas D. Fischer · CC BY-SA 4.0', 20, P.ink, 'Arial,sans-serif');
  const scenes = [];
  const push = (id, name, description, inner, layers) => {
    const data = base(inner);
    const path = join(BASE, 'demo/scenes', id + '.svg');
    put(path, data);
    scenes.push({
      id, name, description, file: relative(BASE, path).replaceAll('\\', '/'),
      preview: relative(BASE, path).replaceAll('\\', '/'), format: '9:16', size: { width: 1080, height: 1920 },
      layers, routeSource: demo.route, routeEvidence: demo.routeDisclosure,
      photoCredits: demo.photoCredits, durationMs: RECIPE.motion.pageHoldMs,
      source: 'Route Story Asset Factory', sha256: sha(data)
    });
  };

  const r1 = route(100, 720, 880, 610, { color: P.rust, width: 12 });
  push('01-cover', 'Обложка', 'Большой редакционный титр, маршрут и вход в материал',
    wash(74, 340, 940, 810, 0.66) +
    asset('paper-overlays', 'paper-ruled', 65, 450, 940, 940, 0.35) +
    asset('tapes', 'tape-linen', 80, 100, 340, 96, 0.8, -7) +
    txt(88, 310, 'ПУТЕВОЙ ДНЕВНИК', 38, P.rust, 'Arial,sans-serif', 700, 'letter-spacing="8"') +
    txt(85, 505, 'Иркутск', 126, P.ink, 'Georgia,serif', 600) +
    txt(90, 650, '→ Байкал', 120, P.ink, 'Georgia,serif', 600) +
    r1.svg + asset('stamps', 'stamp-compass', 724, 1160, 265, 265, 0.7, 10) +
    txt(92, 1515, 'ДЕНЬ 47', 46, P.rust, 'Arial,sans-serif', 700, 'letter-spacing="9"') +
    txt(92, 1615, 'Дорога к озеру', 64, P.ink) + footer(),
    ['paper-fiber', 'watercolor-wash', 'paper-ruled', 'tape-linen', 'route-real', 'stamp-compass', 'typography']);

  const r2 = route(100, 480, 880, 910, { color: P.ink, width: 10 });
  push('02-map', 'Маршрут', 'Геометрия пути из GPX на бумажной странице',
    asset('paper-overlays', 'paper-coordinate', 38, 290, 1004, 1180, 0.47) +
    asset('topography', 'topo-03', 64, 425, 920, 900, 0.55) +
    txt(86, 202, 'ДОРОГА', 44, P.rust, 'Arial,sans-serif', 700, 'letter-spacing="10"') +
    txt(86, 340, 'От города к воде', 76, P.ink) + r2.svg +
    asset('stamps', 'stamp-pin', 757, 1240, 230, 230, 0.65, 12) +
    txt(90, 1528, 'ИРКУТСК', 42, P.ink, 'Arial,sans-serif', 700, 'letter-spacing="5"') +
    txt(90, 1610, routeKm + ' км до Листвянки', 58, P.rust) + footer(),
    ['paper-fiber', 'paper-coordinate', 'topo-03', 'route-real', 'stamp-pin', 'typography']);

  push('03-photo', 'Фотография', 'Полароидный кадр и короткая запись путешествия',
    wash(100, 145, 895, 850, 0.8) +
    asset('tapes', 'tape-grid', 565, 170, 400, 105, 0.85, 8) +
    photo('photo1', 'baikal-1.jpg', 110, 370, 860, 820, -4) +
    asset('stickers', 'sticker-camera', 725, 1120, 230, 230, 0.95, 14) +
    txt(92, 1400, 'Первый взгляд', 90, P.ink) +
    txt(92, 1490, 'Берег Байкала · день 47', 43, P.rust, 'Arial,sans-serif', 700) +
    asset('tapes', 'tape-hatch', 74, 1600, 370, 100, 0.65, -6) + footer(),
    ['paper-fiber', 'watercolor-wash', 'tape-grid', 'photo-baikal-1', 'sticker-camera', 'typography']);

  const smoothEle = pts.map((p, i) => {
    const around = pts.slice(Math.max(0, i - 3), Math.min(pts.length, i + 4));
    return around.reduce((sum, q) => sum + q.ele, 0) / around.length;
  });
  const elevPts = pts.map((p, i) => [86 + i / (pts.length - 1) * 908, 1290 - (smoothEle[i] - minEle) / Math.max(1, maxEle - minEle) * 430]);
  const elevD = elevPts.map((p, i) => (i ? 'L' : 'M') + round(p[0]) + ' ' + round(p[1])).join(' ');
  push('04-elevation', 'Рельеф', 'Профиль высоты из GPX и декоративные изолинии',
    asset('topography', 'topo-07', 45, 320, 990, 780, 0.82) +
    txt(84, 210, 'ЛИНИИ МЕСТНОСТИ', 38, P.rust, 'Arial,sans-serif', 700, 'letter-spacing="7"') +
    txt(82, 380, 'Высота пути', 96, P.ink) +
    '<path d="' + elevD + '" fill="none" stroke="' + P.rust + '" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>' +
    rule(85, 1300, 995, 1300, P.ink, 4) +
    asset('tickets', 'ticket-summit', 560, 1375, 430, 360, 0.95, 6) +
    txt(90, 1515, 'ВЫСШАЯ ТОЧКА', 37, P.ink, 'Arial,sans-serif', 700, 'letter-spacing="4"') +
    txt(88, 1625, String(maxEle) + ' м', 112, P.rust) + footer(),
    ['paper-fiber', 'topo-07', 'elevation-real', 'ticket-summit', 'typography']);

  const r5 = route(122, 205, 835, 640, { color: P.rust, width: 10 });
  push('05-arrival', 'Прибытие', 'Второй фотокадр, штамп и финиш маршрута',
    r5.svg + asset('stamps', 'stamp-lake', 720, 670, 280, 280, 0.87, -11) +
    photo('photo2', 'baikal-2.jpg', 110, 855, 860, 640, 3) +
    asset('tapes', 'tape-wave', 67, 785, 380, 94, 0.75, -8) +
    txt(88, 1652, 'Листвянка', 100, P.ink) +
    txt(92, 1725, 'ФИНИШ ДНЕВНОГО ПУТИ', 33, P.rust, 'Arial,sans-serif', 700, 'letter-spacing="6"') + footer(),
    ['paper-fiber', 'route-real', 'stamp-lake', 'photo-baikal-2', 'tape-wave', 'typography']);

  const r6 = route(100, 690, 880, 550, { color: P.ink, width: 8, dash: '20 11' });
  push('06-end', 'Финальная страница', 'Итог путешествия как собранная страница, готовая к следующему дню',
    wash(60, 75, 960, 980, 0.7) +
    asset('frames', 'frame-archival', 54, 470, 972, 920, 0.5) +
    asset('tickets', 'ticket-arrival', 685, 120, 280, 220, 0.9, -9) +
    txt(150, 310, 'ГЛАВА 47', 50, P.rust, 'Arial,sans-serif', 700, 'letter-spacing="8"') +
    txt(147, 420, 'Байкал', 126, P.ink) +
    r6.svg + asset('stickers', 'sticker-lake', 760, 1150, 210, 210, 0.9, 12) +
    txt(90, 1550, 'Продолжение следует', 78, P.ink) +
    txt(90, 1632, 'Следующий день — новая страница', 38, P.rust, 'Arial,sans-serif', 600) + footer(),
    ['paper-fiber', 'watercolor-wash', 'frame-archival', 'ticket-arrival', 'route-real', 'sticker-lake', 'typography']);

  const inline = (s) => readFileSync(join(BASE, s.file), 'utf8')
    .replaceAll('../../source/', '../source/')
    .replaceAll('../../generated/', '../generated/')
    .replaceAll('../../../../media/', '../../../media/');
  const slides = scenes.map((s, i) =>
    '<figure class="slide' + (i === 0 ? ' active' : '') + '" data-index="' + i + '">' + inline(s) +
    '<figcaption><strong>' + String(i + 1).padStart(2, '0') + ' · ' + E(s.name) +
    '</strong><span>' + E(s.description) + '</span></figcaption></figure>').join('');
  const thumbs = scenes.map((s, i) =>
    '<button class="chapter' + (i === 0 ? ' active' : '') + '" data-index="' + i + '"><div class="chapter-art">' + inline(s) +
    '</div><span>' + String(i + 1).padStart(2, '0') + ' · ' + E(s.name) + '</span></button>').join('');
  const html = '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Travel Scrapbook · сцены</title><link rel="stylesheet" href="../motion.css"><style>' +
    'body{margin:0;background:#20241f;color:#efe3c6;font:16px Inter,Segoe UI,sans-serif}main{display:grid;grid-template-columns:minmax(300px,520px) minmax(300px,1fr);gap:48px;max-width:1400px;margin:auto;padding:36px}h1{font:600 clamp(42px,5vw,75px) Georgia,serif;margin:16px 0}p{line-height:1.55;color:#ced4c6}.stage{position:relative;width:min(100%,440px);aspect-ratio:9/16;overflow:hidden;background:#efe3c6;box-shadow:0 30px 90px #0009;border:8px solid #363d34}.slide{position:absolute;inset:0;margin:0;opacity:0;transform:scale(1.035) translateY(12px);transition:opacity .8s ease,transform 1.2s cubic-bezier(.22,1,.36,1);pointer-events:none}.slide.active{opacity:1;transform:scale(1) translateY(0)}.slide>svg{width:100%;height:100%;display:block}.slide figcaption{position:absolute;left:0;right:0;bottom:0;background:#20241fdc;color:#fff;padding:13px 18px;display:flex;gap:5px;flex-direction:column;font-size:12px}.slide figcaption strong{font-size:15px}.controls{display:flex;gap:12px;margin:20px 0}.controls button,.chapter{border:1px solid #67745e;background:#354033;color:#efe3c6;border-radius:8px;cursor:pointer}.controls button{padding:12px 18px}.chapters{display:grid;grid-template-columns:repeat(3,minmax(100px,1fr));gap:12px;margin-top:32px}.chapter{padding:7px;text-align:left;opacity:.65}.chapter.active{border-color:#d5a878;opacity:1}.chapter-art{width:100%;aspect-ratio:9/11;overflow:hidden}.chapter-art svg{width:100%;height:auto;display:block}.chapter span{display:block;padding:6px;font-size:13px}.eyebrow{color:#d5a878;font-size:13px;letter-spacing:.22em;text-transform:uppercase}@media(max-width:850px){main{display:block;padding:16px}.stage{margin:auto}.chapters{grid-template-columns:repeat(3,1fr)}}@media(prefers-reduced-motion:reduce){.slide{transition:none;transform:none!important}}' +
    '</style><main><section><div class="stage">' + slides + '</div><div class="controls"><button id="toggle">Пауза</button><button id="next">Следующая сцена</button></div></section>' +
    '<section><div class="eyebrow">Route Story · Asset Factory</div><h1>Travel Scrapbook</h1><p>Шесть многослойных сцен из одного GPX, двух фотографий и семейства процедурных SVG. Бумага и акварель созданы генеративно; детали, маршрут и превью собираются локально.</p><p>' +
    E(demo.routeDisclosure) + '. Фото: Thomas D. Fischer, CC BY-SA 4.0.</p><p><a style="color:#e7bf91" href="../">Открыть каталог ассетов →</a></p><div class="chapters">' + thumbs + '</div></section></main>' +
    '<script>let current=0,playing=true;const slides=[...document.querySelectorAll(".slide")],chapters=[...document.querySelectorAll(".chapter")];function show(i){current=(i+slides.length)%slides.length;slides.forEach((x,n)=>x.classList.toggle("active",n===current));chapters.forEach((x,n)=>x.classList.toggle("active",n===current))}chapters.forEach(x=>x.onclick=()=>show(+x.dataset.index));document.getElementById("next").onclick=()=>show(current+1);document.getElementById("toggle").onclick=()=>{playing=!playing;document.getElementById("toggle").textContent=playing?"Пауза":"Играть"};setInterval(()=>{if(playing)show(current+1)},4200)</script></html>';
  put(join(BASE, 'demo/index.html'), html);
  return scenes;
}
