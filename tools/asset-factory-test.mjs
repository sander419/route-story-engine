import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { serve } from './asset-factory-server.mjs';

const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const root = resolve(import.meta.dirname, '..');
const base = join(root, 'assets/travel-scrapbook');
const manifest = JSON.parse(readFileSync(join(base, 'manifest.json'), 'utf8'));
const motions = JSON.parse(readFileSync(join(base, manifest.motionLibrary), 'utf8'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
if (manifest.assetCount < 50 || manifest.assetCount > 100) throw Error('Asset count outside first target');
if (manifest.sceneCount !== 6) throw Error('Expected six scenes');
if (motions.motions.length < 5) throw Error('Motion library is incomplete');
if (new Set(manifest.assets.map((a) => a.id)).size !== manifest.assetCount) throw Error('Duplicate asset ID');
for (const a of manifest.assets) {
  const path = join(base, a.path);
  if (!existsSync(path)) throw Error('Missing asset: ' + a.id);
  for (const key of ['preview', 'size', 'transparent', 'tags', 'license', 'sha256']) if (!(key in a)) throw Error(a.id + ': missing ' + key);
  if (sha(path) !== a.sha256) throw Error('Asset checksum mismatch: ' + a.id);
}
for (const s of manifest.scenes) {
  if (!existsSync(join(base, s.file)) || !existsSync(join(base, s.preview))) throw Error('Missing scene or preview: ' + s.id);
  if (sha(join(base, s.file)) !== s.sha256) throw Error('Scene checksum mismatch: ' + s.id);
}

const server = await serve(root);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
  const faults = [];
  page.on('pageerror', (e) => faults.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400) faults.push(r.status() + ' ' + r.url()); });
  await page.goto(server.url + '/assets/travel-scrapbook/');
  await page.locator('.asset img').first().waitFor();
  const catalog = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('.asset img')];
    imgs.forEach((x) => { x.loading = 'eager'; });
    await Promise.all(imgs.map((x) => x.decode().catch(() => null)));
    return { cards: document.querySelectorAll('.asset').length, failed: imgs.filter((x) => !x.naturalWidth).map((x) => x.src) };
  });
  if (catalog.cards !== manifest.assetCount || catalog.failed.length) throw Error('Catalog preview failure: ' + JSON.stringify(catalog));
  await page.goto(server.url + '/assets/travel-scrapbook/demo/');
  await page.locator('.slide svg').first().waitFor();
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.getElementById('toggle').click());
  for (let i = 0; i < manifest.sceneCount; i++) {
    await page.locator('.chapter').nth(i).click();
    const ok = await page.locator('.slide.active svg').count();
    if (!ok) throw Error('Scene preview failed: ' + manifest.scenes[i].id);
  }
  await page.locator('.chapter').nth(1).click();
  const routeLine = page.locator('.slide.active .route-ink').first();
  const firstOffset = await routeLine.evaluate((x) => parseFloat(getComputedStyle(x).strokeDashoffset));
  await page.waitForTimeout(2700);
  const lastOffset = await routeLine.evaluate((x) => parseFloat(getComputedStyle(x).strokeDashoffset));
  if (!(firstOffset > 100 && Math.abs(lastOffset) < 1)) throw Error('Ink animation did not complete');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.chapter').nth(0).click();
  const reducedOffset = await page.locator('.slide.active .route-ink').first()
    .evaluate((x) => parseFloat(getComputedStyle(x).strokeDashoffset));
  if (Math.abs(reducedOffset) > 1) throw Error('Reduced-motion route remains hidden');
  if (faults.length) throw Error(faults.join('\n'));
  console.log('OK ' + manifest.assetCount + ' previews, ' + manifest.sceneCount + ' scenes, ink motion and reduced motion, no browser errors');
} finally {
  await browser.close();
  await server.close();
}
