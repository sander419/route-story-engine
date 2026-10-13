import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './asset-factory-server.mjs';

const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(ROOT, 'assets/travel-scrapbook');
const MANIFEST = join(BASE, 'manifest.json');
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const server = await serve(ROOT);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 2 });
  const faults = [];
  page.on('pageerror', (e) => faults.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400) faults.push(r.status() + ' ' + r.url()); });
  await page.goto(server.url + '/assets/travel-scrapbook/demo/');
  await page.locator('.slide svg').first().waitFor();
  await page.evaluate(() => document.getElementById('toggle').click());
  await page.addStyleTag({ content: '.slide figcaption{display:none!important}' });
  const previewDir = join(BASE, 'previews/scenes');
  mkdirSync(previewDir, { recursive: true });
  for (let i = 0; i < manifest.scenes.length; i++) {
    const scene = manifest.scenes[i];
    await page.locator('.chapter').nth(i).click();
    await page.waitForTimeout(2900);
    const path = join(previewDir, scene.id + '.png');
    await page.locator('.slide.active svg').screenshot({ path });
    scene.preview = 'previews/scenes/' + scene.id + '.png';
  }
  await page.locator('.chapter').nth(2).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(BASE, 'previews/demo-overview.png'), fullPage: true });
  manifest.overviewPreview = 'previews/demo-overview.png';
  if (faults.length) throw Error(faults.join('\n'));
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log('Asset Factory: ' + manifest.scenes.length + ' scene previews');
} finally {
  await browser.close();
  await server.close();
}
