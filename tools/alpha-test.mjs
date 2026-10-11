import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:4180/');
const b64 = await p.evaluate(async () => {
  const cv = document.createElement('canvas'); cv.width = 360; cv.height = 640; const c = cv.getContext('2d', { alpha: true });
  const st = cv.captureStream(30);
  const rec = new MediaRecorder(st, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 3e6 });
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(r => rec.onstop = r); rec.start(100);
  const t0 = performance.now();
  while (performance.now() - t0 < 1500) {
    const t = (performance.now() - t0) / 1000;
    c.clearRect(0, 0, 360, 640);
    c.fillStyle = 'rgba(255,60,90,0.95)'; c.beginPath(); c.arc(60 + t * 150, 320, 50, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(20, 40, 320, 60);
    await new Promise(r => setTimeout(r, 33));
  }
  rec.stop(); await done;
  const buf = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(s);
});
writeFileSync('out/alpha-test.webm', Buffer.from(b64, 'base64'));
console.log('saved', Buffer.from(b64, 'base64').length);
await b.close();
