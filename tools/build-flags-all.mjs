// Флаги всех стран: пакет flag-icons (MIT, https://github.com/lipis/flag-icons) → art/flags/<iso>-flag.webp (через браузер + PIL).
// Запуск: распаковать flag-icons-7.2.3.tgz в out/fi (см. NEXT-SESSION), затем: node tools/build-flags-all.mjs && python tools/build-flags-all.py
// Флаги из набора Codex (Wikimedia Commons, build-flags.py) не перезаписываются: у них есть гербы и свои записи об источнике.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const SRC = 'out/fi/package';
const list = JSON.parse(readFileSync(`${SRC}/country.json`, 'utf8')).filter((c) => c.iso);
const have = existsSync('art/flags/flags.json') ? JSON.parse(readFileSync('art/flags/flags.json', 'utf8')) : {};
mkdirSync('out/fi/png', { recursive: true });
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 320, height: 240 } });
let n = 0;
for (const c of list) {
  if (have[c.code] && have[c.code].flag && have[c.code].flag.source && /commons/.test(have[c.code].flag.source)) continue;
  const svg = readFileSync(`${SRC}/flags/4x3/${c.code}.svg`, 'utf8');
  await p.setContent(`<body style="margin:0;background:transparent"><img id="f" style="width:320px;height:240px;display:block" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body>`);
  await p.waitForFunction(() => document.getElementById('f').complete);
  await p.screenshot({ path: `out/fi/png/${c.code}.png`, omitBackground: true, clip: { x: 0, y: 0, width: 320, height: 240 } }); n++;
}
await b.close();
writeFileSync('out/fi/list.json', JSON.stringify(list.map((c) => ({ code: c.code, name: c.name }))));
console.log('rendered', n);
