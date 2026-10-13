/* Экспорт: покадровая отрисовка (быстрее и точнее реального времени) → H.264 → MP4.
   Запасной путь: MediaRecorder → WebM. */
(function () {
  const yieldNow = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function prefetch(scene, fps, duration, onProgress, signal) {
    const want = new Map();
    const frames = Math.ceil(duration * fps);
    for (let i = 0; i <= frames; i += 2) {
      for (const q of scene.tilesAt(Math.min(duration, i / fps))) {
        const key = (q.vec ? 'vec' : q.layer.id) + '/' + q.z + '/' + q.x + '/' + q.y;
        if (!want.has(key)) want.set(key, q);
      }
    }
    const list = [...want.values()];
    let done = 0, idx = 0;
    const worker = async () => {
      while (idx < list.length) {
        if (signal && signal.aborted) throw new Error('Отменено');
        const q = list[idx++];
        const e = q.vec ? window.VMap.getTile(q.z, q.x, q.y) : window.RS.getTile(q.layer, q.z, q.x, q.y, true);
        await e.p; done++;
        if (done % 8 === 0 || done === list.length) onProgress(done / list.length);
      }
    };
    await Promise.all(Array.from({ length: 10 }, worker));
    return list.length;
  }

  async function pickCodec(W, H, fps, bitrate) {
    if (!('VideoEncoder' in window)) return null;
    for (const codec of ['avc1.640033', 'avc1.640028', 'avc1.4d0028', 'avc1.42001f']) {
      try {
        const cfg = { codec, width: W, height: H, bitrate, framerate: fps };
        const r = await VideoEncoder.isConfigSupported(cfg);
        if (r.supported) return cfg;
      } catch (e) { /* пробуем следующий */ }
    }
    return null;
  }

  async function exportVideo({ makeScene, W, H, fps = 30, duration, onStage, signal, audio }) {
    const scene = makeScene(W, H);
    onStage('Загружаю карту…', 0);
    if (scene.assetsReady) await scene.assetsReady;
    await prefetch(scene, fps, duration, (p) => onStage('Загружаю карту…', p), signal);

    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const frames = Math.round(duration * fps);
    const bitrate = Math.round(W * H * fps * 0.11);
    const cfg = await pickCodec(W, H, fps, bitrate);

    if (cfg && window.Mp4Muxer) {
      const withAudio = !!(audio && window.RSAudio && (await window.RSAudio.supported()));
      const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H }, audio: withAudio ? { codec: 'aac', numberOfChannels: 2, sampleRate: window.RSAudio.SR } : undefined, fastStart: 'in-memory' });
      if (withAudio) { onStage('Записываю звук…', 0); await window.RSAudio.encodeInto(muxer, audio); }
      let encErr = null;
      const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { encErr = e; } });
      enc.configure({ ...cfg, latencyMode: 'quality', avc: { format: 'avc' } });
      for (let i = 0; i < frames; i++) {
        if (signal && signal.aborted) { enc.close(); throw new Error('Отменено'); }
        if (encErr) throw encErr;
        scene.draw(ctx, i / fps);
        const vf = new VideoFrame(cv, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
        enc.encode(vf, { keyFrame: i % 60 === 0 });
        vf.close();
        // ждём, пока кодировщик разгребёт очередь: по его же сигналу «dequeue» (холостой цикл здесь вешал страницу)
        while (enc.encodeQueueSize > 3) await new Promise((r) => { let fin = false; const f = () => { if (!fin) { fin = true; r(); } }; enc.addEventListener('dequeue', f, { once: true }); setTimeout(f, 80); });
        if (i % 3 === 0) { onStage('Рендерю кадры…', i / frames); await yieldNow(); }
      }
      onStage('Собираю файл…', 1);
      await enc.flush(); enc.close(); muxer.finalize();
      return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), ext: 'mp4', codec: cfg.codec };
    }

    // запасной путь: запись в реальном времени
    const safari = /^((?!chrome|chromium|android|edg).)*safari/i.test(navigator.userAgent);   // Safari/iPhone умеет MP4, а не WebM
    const mimes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4;codecs=avc1.42E01E', 'video/mp4'];
    const mime = (safari ? [...mimes.slice(3), ...mimes.slice(0, 3)] : mimes).find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
    if (!mime) throw new Error('Браузер не умеет записывать видео. Откройте страницу в Chrome или Edge.');
    const stream = cv.captureStream(fps);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise((r) => (rec.onstop = r));
    rec.start(250);
    const t0 = performance.now();
    for (;;) {
      if (signal && signal.aborted) { rec.stop(); throw new Error('Отменено'); }
      const t = (performance.now() - t0) / 1000;
      if (t >= duration) break;
      scene.draw(ctx, t);
      onStage('Записываю (WebM, в реальном времени)…', t / duration);
      await sleep(1000 / fps);
    }
    scene.draw(ctx, duration);
    await sleep(120);
    rec.stop(); await stopped;
    const isMp4 = /mp4/.test(mime);
    return { blob: new Blob(chunks, { type: isMp4 ? 'video/mp4' : 'video/webm' }), ext: isMp4 ? 'mp4' : 'webm', codec: mime };
  }

  window.RSExport = { exportVideo, prefetch };
})();
