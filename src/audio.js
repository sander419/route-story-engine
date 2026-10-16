/* Звук для ролика: только своя музыка из файла (встроенной музыки больше нет — убрана 14.10.2026 по решению автора).
   Кодирование — WebCodecs AudioEncoder (AAC) прямо в MP4. Без своего файла ролик без звука. */
(function () {
  const SR = 48000;
  const decoded = new WeakMap();
  function decode(file) {
    if (!decoded.has(file)) decoded.set(file,(async()=>{const ctx=new AudioContext({sampleRate:SR});try{return await ctx.decodeAudioData(file.slice(0));}finally{await ctx.close().catch(()=>{});}})());
    return decoded.get(file);
  }
  async function inspect(file) {const b=await decode(file);return {duration:b.duration};}

  /* ---- своя музыка: декодируем, подрезаем под длину ролика, мягко гасим конец ---- */
  async function fromFile(arrayBuffer, duration) {
    const dec = await decode(arrayBuffer);
    const ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);
    const s = ctx.createBufferSource(); s.buffer = dec; s.loop = dec.duration < duration;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.9, 0.6); g.gain.setValueAtTime(0.9, Math.max(0.7, duration - 2.5)); g.gain.linearRampToValueAtTime(0.0001, duration);
    s.connect(g).connect(ctx.destination); s.start(0);
    return ctx.startRendering();
  }

  /* громкость для соцсетей (~−14…−15 LUFS): подтягиваем по RMS, пики мягко ограничиваем ниже −1 дБ */
  function normalize(buf, targetRms) {
    let sum = 0, n = 0;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i += 4) { sum += d[i] * d[i]; n++; } }
    const rms = Math.sqrt(sum / Math.max(1, n)); if (rms < 1e-5) return buf;
    const k = Math.min(8, targetRms / rms), lim = 0.89;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) { const x = d[i] * k; d[i] = Math.abs(x) <= 0.6 ? x : Math.sign(x) * (0.6 + (lim - 0.6) * Math.tanh((Math.abs(x) - 0.6) / (lim - 0.6))); } }
    return buf;
  }

  /* ---- кодирование в AAC и упаковка в тот же MP4 ---- */
  async function supported() { try { return !!(window.AudioEncoder && (await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: 2, bitrate: 160000 })).supported); } catch (e) { return false; } }
  async function encodeInto(muxer, buf) {
    let err = null;
    const enc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { err = e; } });
    enc.configure({ codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: 2, bitrate: 160000 });
    const L = buf.getChannelData(0), Rch = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, N = 4800;
    for (let i = 0; i < buf.length; i += N) {
      const n = Math.min(N, buf.length - i), data = new Float32Array(n * 2);
      data.set(L.subarray(i, i + n), 0); data.set(Rch.subarray(i, i + n), n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i / SR) * 1e6), data });
      enc.encode(ad); ad.close();
      if (err) throw err;
    }
    await enc.flush(); enc.close();
    if (err) throw err;
  }

  /* ---- превью: проигрываем тот же звук синхронно с картинкой ---- */
  let actx = null, src = null;
  function playAt(buf, t) {
    stop(); if (!buf) return;
    try { actx = actx || new AudioContext({ sampleRate: SR }); if (actx.state === 'suspended') actx.resume(); src = actx.createBufferSource(); src.buffer = buf; src.connect(actx.destination); src.start(0, Math.max(0, Math.min(t, buf.duration - 0.01))); } catch (e) { /* без звука */ }
  }
  function stop() { try { if (src) src.stop(); } catch (e) { /* уже остановлен */ } src = null; }

  window.RSAudio = { fromFile, inspect, encodeInto, supported, playAt, stop, SR };
})();
