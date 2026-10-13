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
    const profiles = Object.keys(window.RSAudio.PROFILES);
    const signatures = {};
    for (const id of ids) {
      const buf = await window.RSAudio.compose(8, [{ t: 2, recipe: 'route-reveal', dur: 4 }], 7, id);
      const samples = buf.getChannelData(0);
      let sum = 0, peak = 0, hash = 2166136261;
      for (let i = 0; i < samples.length; i += 101) {
        const v = samples[i]; sum += v * v; peak = Math.max(peak, Math.abs(v));
        hash = Math.imul(hash ^ (Math.round(v * 10000) & 65535), 16777619) >>> 0;
      }
      signatures[id] = { rms: Math.sqrt(sum / Math.ceil(samples.length / 101)), peak, hash };
    }
    return { ids, profiles, signatures, navigatorGrid: !!window.NavigatorGrid };
  });
  const ready = catalog.styles.filter((s) => s.status === 'implemented').map((s) => s.id);
  for (const id of ready) {
    if (!result.ids.includes(id) || !result.profiles.includes(id)) throw Error(`Style/profile missing: ${id}`);
    if (result.signatures[id].rms < 0.01 || result.signatures[id].peak > 0.9) throw Error(`Invalid audio level: ${id}`);
  }
  if (!result.navigatorGrid) throw Error('Navigator drawing module missing');
  if (new Set(ready.map((id) => result.signatures[id].hash)).size !== ready.length) throw Error('Audio profiles sound identical');
  if (errors.length) throw Error(errors.join('\n'));
  console.log(`OK ${ready.length} styles, ${ready.length} distinct non-silent audio profiles, no page errors`);
} finally {
  await b.close();
}
