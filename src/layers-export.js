/* Экспорт слоёв для монтажа: прозрачный фон.
   • PNG-кадры в ZIP — точные, читаются любым редактором (Premiere, DaVinci, After Effects, Final Cut, CapCut…)
   • WebM VP9 с прозрачностью — один файл (запись в реальном времени, нужен Chromium) */
(function () {
  const yieldNow = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---- ZIP без сжатия (PNG уже сжаты) ---- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function ZipWriter() {
    const parts = [], central = []; let offset = 0;
    const enc = new TextEncoder(), DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
    return {
      add(name, u8) {
        const nm = enc.encode(name), crc = crc32(u8);
        const h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
        h.setUint16(10, DOS_TIME, true); h.setUint16(12, DOS_DATE, true); h.setUint32(14, crc, true);
        h.setUint32(18, u8.length, true); h.setUint32(22, u8.length, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
        parts.push(h.buffer, nm, u8);
        const c = new DataView(new ArrayBuffer(46));
        c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
        c.setUint16(12, DOS_TIME, true); c.setUint16(14, DOS_DATE, true); c.setUint32(16, crc, true);
        c.setUint32(20, u8.length, true); c.setUint32(24, u8.length, true); c.setUint16(28, nm.length, true);
        c.setUint32(42, offset, true);
        central.push(c.buffer, nm);
        offset += 30 + nm.length + u8.length;
      },
      finish() {
        const cdSize = central.reduce((a, b) => a + (b.byteLength ?? b.length), 0), n = central.length / 2;
        const e = new DataView(new ArrayBuffer(22));
        e.setUint32(0, 0x06054b50, true); e.setUint16(8, n, true); e.setUint16(10, n, true); e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
        return new Blob([...parts, ...central, e.buffer], { type: 'application/zip' });
      },
    };
  }

  const READMEs = (name, W, H, fps, frames) => `Слои для монтажа — ${name}
Разрешение ${W}x${H}, ${fps} кадров/с, ${frames} кадров. Фон прозрачный (PNG с альфа-каналом).

Как использовать
• DaVinci Resolve / Premiere / After Effects / Final Cut: импортируйте первый файл (frame_0001.png) как «последовательность изображений», частота ${fps} к/с, и положите на дорожку над своим видео.
• CapCut и мобильные редакторы: если PNG-последовательность не принимается, превратите её в видео с прозрачностью командой ниже.

Конвертация в MOV ProRes 4444 с прозрачностью (нужен ffmpeg):
  ffmpeg -framerate ${fps} -i frame_%04d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le layer.mov

Конвертация в WebM VP9 с прозрачностью:
  ffmpeg -framerate ${fps} -i frame_%04d.png -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 layer.webm

Карта: © OpenStreetMap contributors, OpenFreeMap, Esri (для спутникового фона). Сделано в Route Story.
`;

  async function prefetchAll(scene, fps, duration, onStage, signal) {
    // повторяем догрузку тайлов тем же способом, что и обычный экспорт
    await window.RSExport.prefetch(scene, fps, duration, (p) => onStage('Загружаю карту…', p), signal);
  }

  /* layers: { map, route, hud } — какие слои рисовать в этом файле */
  async function exportLayerFile({ makeScene, W, H, fps = 30, duration, layers, format, name, onStage, signal }) {
    const scene = makeScene(W, H);
    onStage('Загружаю карту…', 0);
    if (scene.assetsReady) await scene.assetsReady;
    await prefetchAll(scene, fps, duration, onStage, signal);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { alpha: true });
    const frames = Math.round(duration * fps);
    const opts = { layers, transparent: true };

    if (format === 'png') {
      const zip = new ZipWriter();
      for (let i = 0; i < frames; i++) {
        if (signal && signal.aborted) throw new Error('Отменено');
        scene.draw(ctx, i / fps, opts);
        const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
        zip.add(`frame_${String(i + 1).padStart(4, '0')}.png`, new Uint8Array(await blob.arrayBuffer()));
        if (i % 2 === 0) { onStage('Сохраняю кадры…', i / frames); await yieldNow(); }
      }
      zip.add('README.txt', new TextEncoder().encode(READMEs(name, W, H, fps, frames)));
      onStage('Собираю архив…', 1);
      return { blob: zip.finish(), ext: 'zip', kind: 'png', frames };
    }

    // WebM VP9 с прозрачностью: запись в реальном времени
    const mime = 'video/webm;codecs=vp9';
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported(mime)) throw new Error('Этот браузер не умеет WebM с прозрачностью. Выберите PNG-кадры или откройте страницу в Chrome / Edge.');
    const stream = cv.captureStream(fps);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(W * H * fps * 0.16) });
    const chunks = []; rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise((r) => (rec.onstop = r));
    scene.draw(ctx, 0, opts);
    rec.start(250);
    const t0 = performance.now();
    for (;;) {
      if (signal && signal.aborted) { rec.stop(); throw new Error('Отменено'); }
      const t = (performance.now() - t0) / 1000;
      if (t >= duration) break;
      scene.draw(ctx, t, opts);
      onStage('Записываю WebM в реальном времени…', t / duration);
      await sleep(1000 / fps);
    }
    scene.draw(ctx, duration, opts);
    await sleep(150); rec.stop(); await stopped;
    return { blob: new Blob(chunks, { type: 'video/webm' }), ext: 'webm', kind: 'webm', frames };
  }

  window.RSLayers = { exportLayerFile, ZipWriter, crc32 };
})();
