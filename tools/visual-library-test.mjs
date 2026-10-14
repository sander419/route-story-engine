import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const catalog = JSON.parse(readFileSync(new URL('../design/visual-library.json', import.meta.url), 'utf8'));
const assets = JSON.parse(readFileSync(new URL('../design/asset-catalog.json', import.meta.url), 'utf8'));
for (const asset of assets.assets) {
  for (const key of catalog.assetPolicy.requiredFields) if (!(key in asset)) throw Error(`Asset ${asset.id}: missing ${key}`);
}
const b = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const p = await b.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://localhost:4180/');
  const result = await p.evaluate(async () => {
    const ids = Object.keys(window.RS.STYLES);
    return { ids, navigatorGrid: !!window.NavigatorGrid };
  });
  const ready = catalog.styles.filter((s) => s.status === 'implemented').map((s) => s.id);
  for (const id of ready) {
    if (!result.ids.includes(id)) throw Error(`Style missing: ${id}`);
  }
  if (!result.navigatorGrid) throw Error('Navigator drawing module missing');
  if (errors.length) throw Error(errors.join('\n'));
  console.log(`OK ${ready.length} styles, ${ready.length} styles available (music removed), no page errors`);
} finally {
  await b.close();
}
