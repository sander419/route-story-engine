/* Звук для ролика: встроенная музыка (сочиняется детерминированно под кадры серии) или своя из файла.
   Рендер — OfflineAudioContext, кодирование — WebCodecs AudioEncoder (AAC) прямо в MP4. Без сервера и лицензий. */
(function () {
  const SR = 48000;

  // детерминированный шум (для «вжуха» и реверберации)
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  /* ---- встроенная музыка: тёплая тема в ре мажоре, 84 уд/мин, акценты по кадрам ----
     cues: [{ t, recipe, dur }] — кадры серии (для тревел-трека можно передать пустой список) */
  async function compose(duration, cues = [], seed = 7) {
    const ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);
    const R = rng(seed);
    const master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    // реверберация: экспоненциальный шумовой хвост 2,6 с
    const ir = ctx.createBuffer(2, Math.floor(SR * 2.6), SR);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (R() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
    const verb = ctx.createConvolver(); verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.32; verb.connect(wet).connect(master);
    const bus = ctx.createGain(); bus.connect(master); bus.connect(verb);
    // финальное затухание
    master.gain.setValueAtTime(0.9, 0); master.gain.setValueAtTime(0.9, Math.max(0, duration - 2.6)); master.gain.linearRampToValueAtTime(0.0001, duration);

    const beat = 60 / 84, bar = beat * 4;
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    // ре мажор: D — A — Bm — G (по два такта)
    const CHORDS = [[62, 66, 69], [57, 61, 64], [59, 62, 66], [55, 59, 62]];
    const pull = cues.find((c) => c.recipe === 'pullback');
    const pullT = pull ? pull.t : duration * 0.8;
    const revealT = (cues.find((c) => c.recipe === 'route-reveal' || c.recipe === 'journey-recap') || { t: Math.min(3, duration * 0.15) }).t;

    // мягкий фон-«пэд»: три расстроенных осциллятора на ноту через фильтр
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.4;
    lp.frequency.setValueAtTime(700, 0); lp.frequency.linearRampToValueAtTime(1100, revealT + 2); lp.frequency.setValueAtTime(1100, pullT); lp.frequency.linearRampToValueAtTime(2600, Math.min(duration, pullT + 3));
    const padG = ctx.createGain(); padG.gain.value = 0.05; lp.connect(padG).connect(bus);
    for (let t0 = 0, k = 0; t0 < duration; t0 += bar * 2, k++) {
      const ch = CHORDS[k % 4], len = Math.min(bar * 2, duration - t0);
      for (const n of ch) for (const det of [-7, 0, 6]) {
        const o = ctx.createOscillator(); o.type = det === 0 ? 'triangle' : 'sawtooth'; o.frequency.value = hz(n); o.detune.value = det;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(det === 0 ? 0.5 : 0.22, t0 + 1.2); g.gain.setValueAtTime(det === 0 ? 0.5 : 0.22, t0 + len - 0.9); g.gain.linearRampToValueAtTime(0, t0 + len + 0.6);
        o.connect(g).connect(lp); o.start(t0); o.stop(t0 + len + 0.7);
      }
      // бас: корень октавой ниже, раз в такт
      for (let b = 0; b < 2; b++) {
        const tb = t0 + b * bar; if (tb >= duration) break;
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(ch[0] - 24);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, tb); g.gain.linearRampToValueAtTime(0.16, tb + 0.08); g.gain.exponentialRampToValueAtTime(0.02, tb + bar * 0.95);
        o.connect(g).connect(bus); o.start(tb); o.stop(tb + bar);
      }
    }
    // спокойный пульс (полутемп) — с момента, когда начинается путь
    for (let t = Math.ceil(revealT / (beat * 2)) * beat * 2; t < duration - 2; t += beat * 2) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.35);
    }
    // перебор на прорисовке пути и в финале
    const arp = (from, to) => {
      for (let t = Math.ceil(from / (beat / 2)) * (beat / 2), i = 0; t < Math.min(to, duration - 1.5); t += beat / 2, i++) {
        const k = Math.floor(t / (bar * 2)) % 4, ch = CHORDS[k], n = ch[i % 3] + 12 * (i % 6 < 3 ? 0 : 1);
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(n + 12);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(g).connect(bus); o.start(t); o.stop(t + 0.55);
      }
    };
    cues.filter((c) => c.recipe === 'route-reveal' || c.recipe === 'journey-recap' || c.recipe === 'pullback').forEach((c) => arp(c.t + 0.4, c.t + c.dur));
    if (!cues.length) arp(revealT, duration);
    // акценты: «вжух» на смене кадров, звон на фото
    const noise = ctx.createBuffer(1, SR, SR); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; }
    cues.forEach((c, i) => {
      if (i > 0 && c.t > 0.5) {
        const s = ctx.createBufferSource(); s.buffer = noise;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(300, c.t - 0.55); bp.frequency.exponentialRampToValueAtTime(2800, c.t + 0.1);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, c.t - 0.55); g.gain.exponentialRampToValueAtTime(0.06, c.t); g.gain.exponentialRampToValueAtTime(0.0001, c.t + 0.45);
        s.connect(bp).connect(g).connect(bus); s.start(c.t - 0.55); s.stop(c.t + 0.5);
      }
      if (c.recipe === 'photo-reveal' || c.recipe === 'highlights-reel' || c.recipe === 'checkpoint-arrival') {
        for (const [f, a] of [[hz(86), 0.05], [hz(93), 0.03], [hz(98), 0.018]]) {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
          const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, c.t + 0.15); g.gain.exponentialRampToValueAtTime(a, c.t + 0.17); g.gain.exponentialRampToValueAtTime(0.0001, c.t + 2.8);
          o.connect(g).connect(bus); o.start(c.t + 0.15); o.stop(c.t + 2.9);
        }
      }
    });
    return normalize(await ctx.startRendering(), 0.2);
  }

  /* ---- своя музыка: декодируем, подрезаем под длину ролика, мягко гасим конец ---- */
  async function fromFile(arrayBuffer, duration) {
    const dec = await new AudioContext({ sampleRate: SR }).decodeAudioData(arrayBuffer.slice(0));
    const ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);
    const s = ctx.createBufferSource(); s.buffer = dec;
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

  window.RSAudio = { compose, fromFile, encodeInto, supported, playAt, stop, SR };
})();
