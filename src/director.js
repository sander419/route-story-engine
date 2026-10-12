/* Episode Director — детерминированный монтажёр серии.
   Journey State + новый день → EpisodePlan (обычный JSON) + журнал решений.
   Никакой случайности: одинаковый вход → одинаковый план. Работает и в браузере (window.Director), и в node (require). */
(function (root) {
  'use strict';
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const r1 = (x) => Math.round(x * 10) / 10;
  const r2 = (x) => Math.round(x * 100) / 100;

  /* FNV-1a: «зерно» плана для трассировки (не для случайности) */
  function hash(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); }

  /* ================= Journey State ================= */
  /** @typedef {{day:number,date?:string,line:number[][],km:number,from?:string,to?:string,gain?:number,media?:string[],noteIds?:string[]}} Day */
  /** @typedef {{id:string,day:number,kind:'photo'|'video',url:string,caption?:string}} Media */
  /** @typedef {{id:string,day:number,text:string}} Note */
  /** @typedef {{day:number,kind:'origin'|'country'|'chapter'|'city'|'milestone',label:string}} Checkpoint */

  function summarize(J) {
    const days = [...J.days].sort((a, b) => a.day - b.day);
    const perDay = days.map((d) => d.km);
    const totalKm = perDay.reduce((a, b) => a + b, 0);
    const last = days[days.length - 1];
    const pos = last ? last.line[last.line.length - 1] : null;
    return { totalKm: r1(totalKm), daysCount: days.length, currentDay: last ? last.day : 0, position: pos, perDay };
  }

  /* Добавить новый день → новое состояние + отчёт «что изменилось» */
  function addDay(J, seg, media = [], notes = []) {
    const before = summarize(J);
    const day = seg.day || before.currentDay + 1;
    const ids = media.map((m, i) => m.id || `d${day}-m${i + 1}`);
    const nids = notes.map((n, i) => n.id || `d${day}-n${i + 1}`);
    const d = { ...seg, day, media: ids, noteIds: nids };
    const next = {
      ...J,
      days: [...J.days.filter((x) => x.day !== day), d].sort((a, b) => a.day - b.day),
      media: [...(J.media || []), ...media.map((m, i) => ({ ...m, id: ids[i], day }))],
      notes: [...(J.notes || []), ...notes.map((n, i) => ({ ...n, id: nids[i], day }))],
      checkpoints: [...(J.checkpoints || [])],
      episodes: [...(J.episodes || [])],
    };
    const after = summarize(next);
    const crossed = [];
    for (let k = Math.floor(before.totalKm / 1000) + 1; k <= Math.floor(after.totalKm / 1000); k++) crossed.push(k * 1000);
    crossed.forEach((km) => next.checkpoints.push({ day, kind: 'milestone', label: `${km.toLocaleString('ru-RU')} км` }));
    if (seg.to && !next.checkpoints.some((c) => c.day === day && c.label === seg.to)) next.checkpoints.push({ day, kind: seg.toKind || 'city', label: seg.to });
    return {
      journey: next,
      change: { day, km: r1(seg.km), media: ids.length, notes: nids.length, totalBefore: before.totalKm, totalAfter: after.totalKm, milestones: crossed, arrival: seg.to || null },
    };
  }

  /* ================= Контекст для решений ================= */
  const IMPORTANCE = { origin: 5, country: 4, chapter: 3, milestone: 2, city: 1 };

  /* Сжатие истории: старт → 1–3 главных вехи → вчера. Чем длиннее путь, тем НЕ длиннее пересказ. */
  function compressHistory(J, uptoDay, max = 4) {
    const cps = (J.checkpoints || []).filter((c) => c.day < uptoDay).sort((a, b) => a.day - b.day || IMPORTANCE[b.kind] - IMPORTANCE[a.kind]);
    if (!cps.length) return [];
    const origin = cps.find((c) => c.kind === 'origin') || cps[0];
    const recent = cps[cps.length - 1];
    // середина: важные вехи (страна, глава), но равномерно по всему пути — не кучей в начале
    const k = Math.max(0, max - 2), pool = cps.filter((c) => c !== origin && c !== recent);
    const strong = pool.filter((c) => IMPORTANCE[c.kind] >= 3), base = strong.length >= k ? strong : pool;
    const middle = k === 0 || !base.length ? [] : [...new Set(Array.from({ length: Math.min(k, base.length) }, (_, i) => base[Math.round(((i + 0.5) * base.length) / Math.min(k, base.length) - 0.5)]))];
    const out = [origin, ...middle]; if (recent !== origin) out.push(recent);
    return out.map((c) => ({ day: c.day, kind: c.kind, label: c.label }));
  }

  function sinuosity(line) {
    if (!line || line.length < 3) return 1;
    let path = 0; for (let i = 1; i < line.length; i++) path += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    const a = line[0], b = line[line.length - 1]; const chord = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
    return path / chord;
  }

  /* Места по пути: самые значимые и не кучей. Чем длиннее день, тем больше мест, но не больше трёх (правила кадра). */
  const PLACE_RANK = { city: 3, town: 2, village: 1 };
  function pickWaypoints(list, km, skip = []) {
    if (!list || !list.length) return [];
    const max = km < 20 ? 1 : km < 80 ? 2 : 3;
    const pool = list.filter((w) => w && w.name && w.frac > 0.12 && w.frac < 0.88 && !skip.includes(w.name))
      .sort((a, b) => (PLACE_RANK[b.kind] || 0) - (PLACE_RANK[a.kind] || 0) || (b.pop || 0) - (a.pop || 0) || a.name.localeCompare(b.name));
    const out = [];
    for (const w of pool) {
      if (out.length >= max) break;
      if (out.some((o) => Math.abs(o.frac - w.frac) < 0.18 || o.name === w.name)) continue;
      out.push(w);
    }
    return out.sort((a, b) => a.frac - b.frac).map((w) => ({ name: w.name, lon: w.lon, lat: w.lat, frac: r2(w.frac), kind: w.kind || 'town' }));
  }
  function hoursText(h) { const m = Math.round(h * 60); return m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч ${String(m % 60).padStart(2, '0')} мин`; }

  function buildContext(J, episodeType, opts = {}) {
    const S = summarize(J);
    const days = [...J.days].sort((a, b) => a.day - b.day);
    const seg = days[days.length - 1];
    const media = (J.media || []).filter((m) => m.day === seg.day && m.kind === 'photo');
    const allPhotos = (J.media || []).filter((m) => m.kind === 'photo');
    const note = (J.notes || []).find((n) => n.day === seg.day) || null;
    const median = [...S.perDay].sort((a, b) => a - b)[Math.floor(S.perDay.length / 2)] || seg.km;
    const prevTotal = r1(S.totalKm - seg.km);
    const crossedK = Math.floor(S.totalKm / 1000) > Math.floor(prevTotal / 1000) ? Math.floor(S.totalKm / 1000) * 1000 : null;
    const dayMilestone = seg.day % 50 === 0 ? seg.day : null;   // «День 1» вехой не считаем: это просто начало
    const arrival = (J.checkpoints || []).find((c) => c.day === seg.day && c.kind !== 'milestone') || null;
    return {
      type: episodeType, aspect: opts.aspect || '9:16',
      journeyId: J.id, title: J.title, traveler: J.traveler || '',
      day: seg.day, date: seg.date || null, seg,
      newKm: r1(seg.km), totalKm: S.totalKm, prevTotalKm: prevTotal, daysCount: S.daysCount, perDay: S.perDay, position: S.position,
      photos: media, allPhotos, note, noteWords: note ? note.text.trim().split(/\s+/).length : 0,
      gain: seg.gain || 0, sinuosity: r2(sinuosity(seg.line)),
      // факты, которые режиссёр достаёт из самого трека (без фото и заметок)
      from: seg.from || null, to: seg.to || null, name: seg.name || null,
      waypoints: pickWaypoints(seg.waypoints, seg.km, [seg.from, seg.to]),
      profile: seg.profile && seg.profile.length >= 8 ? seg.profile : null,
      maxEle: seg.maxEle != null ? seg.maxEle : null, minEle: seg.minEle != null ? seg.minEle : null, maxAt: seg.maxAt || null, maxKm: seg.maxKm != null ? seg.maxKm : null,
      movingH: seg.movingH || 0, avgKmh: seg.avgKmh || 0,
      isLong: seg.km > median * 1.8 && seg.km > 60, isShort: seg.km < 15,
      milestoneKm: crossedK, dayMilestone, arrival,
      history: compressHistory(J, seg.day),
      checkpoints: (J.checkpoints || []).slice(),
      recent: (J.episodes || []).slice(-(opts.memory || 4)),
      schematic: !!J.schematic, seasonLine: J.seasonLine || null,
    };
  }

  /* ================= Shot Recipes (решения; отрисовка — отдельно, в episode.js) ================= */
  // каждая функция base(ctx) возвращает компоненты полезности 0..1
  const RECIPES = [
    // один трек без истории: «День 1» ни о чём не говорит — называем сам маршрут
    { id: 'trip-title', types: ['new-viewer', 'returning-viewer'], beats: ['hook'], min: 3, max: 4, flex: true,
      eligible: (c) => c.daysCount === 1,
      base: () => ({ relevance: 1, novelty: 1, emotion: 0.4, visual: 0.6, milestone: 0 }),
      pref: () => 3.4,
      params: (c) => ({ from: c.from, to: c.to, name: c.name, date: c.date, km: c.newKm }) },
    { id: 'day-card', types: ['new-viewer', 'returning-viewer'], beats: ['hook'], min: 2.6, max: 3.6, flex: true,
      eligible: (c) => c.daysCount >= 2,
      base: (c) => ({ relevance: 1, novelty: c.type === 'returning-viewer' ? 0.9 : 0.6, emotion: 0.2, visual: 0.4, milestone: c.dayMilestone ? 1 : 0 }),
      pref: (c) => 3,
      params: (c) => ({ day: c.day, date: c.date, title: c.title, traveler: c.traveler, totalKm: c.prevTotalKm }) },
    { id: 'progress-overview', beats: ['hook', 'context'], min: 3.5, max: 5.5, flex: true,
      eligible: (c) => c.daysCount >= 2 && c.type !== 'story-so-far',
      base: (c, beat) => ({ relevance: beat === 'context' ? 0.9 : 0.7, novelty: c.type === 'new-viewer' ? 0.8 : 0.2, emotion: 0.3, visual: 0.8, milestone: c.milestoneKm ? 0.6 : 0 }),
      pref: () => 4.5,
      params: (c) => ({ totalKm: c.prevTotalKm, days: c.day - 1, history: c.history }) },
    { id: 'overview-to-detail', beats: ['context'], min: 3.4, max: 5, flex: true,
      eligible: (c) => c.daysCount >= 2 && c.type !== 'story-so-far',
      base: (c) => ({ relevance: 0.85, novelty: 0.6, emotion: 0.2, visual: 0.7, milestone: 0 }),
      pref: () => 4.2,
      params: () => ({ from: 'journey', to: 'segment' }) },
    { id: 'route-reveal', beats: ['new-leg'], min: 5, max: 18, flex: true, hero: true, signature: true,
      eligible: (c) => c.type !== 'story-so-far',
      base: (c) => ({ relevance: 1, novelty: 1, emotion: c.waypoints.length ? 0.6 : 0.4, visual: c.sinuosity > 1.25 || c.waypoints.length ? 0.7 : 0.5, milestone: 0 }),
      // с местами по пути линия идёт от места к месту: на каждое — не меньше ~3,4 с (ничего не мелькает)
      pref: (c) => (c.waypoints.length ? 2.4 + (c.waypoints.length + 1) * 3.4 : clamp(5.5 + Math.log10(Math.max(1, c.newKm)) * 0.6, 5.5, 7.5)),
      minFor: (c) => (c.waypoints.length ? 2 + (c.waypoints.length + 1) * 3.1 : 5),
      maxFor: (c) => (c.waypoints.length ? 18 : 8),
      params: (c) => ({ day: c.day, km: c.newKm, waypoints: c.waypoints }) },
    { id: 'camera-follow', beats: ['new-leg'], min: 3.6, max: 6.5, flex: true, hero: true,
      eligible: () => false,   // отключено: слежение за точкой дёргает камеру (правила кадра)
      base: (c) => ({ relevance: 1, novelty: 1, emotion: 0.5, visual: clamp(0.5 + (c.sinuosity - 1) + c.gain / 2000, 0, 1), milestone: 0 }),
      pref: () => 5,
      params: (c) => ({ day: c.day, km: c.newKm }) },
    { id: 'checkpoint-arrival', types: ['new-viewer', 'returning-viewer'], beats: ['achievement', 'moment'], min: 3, max: 4.2, flex: true,
      eligible: (c) => !!(c.arrival || c.milestoneKm || c.dayMilestone),
      base: (c, beat) => ({ relevance: beat === 'achievement' ? 1 : 0.5, novelty: 0.8, emotion: 0.5, visual: 0.6, milestone: c.milestoneKm || c.dayMilestone || (c.arrival && c.arrival.kind === 'country') ? 1 : 0.4 }),
      pref: () => 3.6,
      params: (c) => ({ label: c.arrival ? c.arrival.label : c.milestoneKm ? `${c.milestoneKm.toLocaleString('ru-RU')} км` : `День ${c.day}`, kind: c.arrival ? c.arrival.kind : 'milestone', milestoneKm: c.milestoneKm, dayMilestone: c.dayMilestone }) },
    { id: 'photo-reveal', types: ['new-viewer', 'returning-viewer'], beats: ['moment'], min: 4, max: 11.5, flex: true, hero: true,
      eligible: (c) => c.photos.length > 0,
      base: (c) => ({ relevance: 1, novelty: 0.9, emotion: 1, visual: 0.8, milestone: 0, mediaQ: 0.8 }),
      pref: (c) => 4.2 + 3.6 * (Math.min(c.photos.length, 3) - 1),
      params: (c) => ({ mediaIds: c.photos.slice(0, 3).map((m) => m.id) }) },
    { id: 'high-point', types: ['new-viewer', 'returning-viewer'], beats: ['moment'], min: 3.4, max: 4.6, flex: true,
      eligible: (c) => !!c.maxAt && c.maxEle != null && c.minEle != null && c.maxEle - c.minEle >= 250,
      base: (c) => ({ relevance: 0.8, novelty: 0.8, emotion: 0.5, visual: clamp(0.5 + (c.maxEle - c.minEle) / 2000, 0.5, 1), milestone: 0 }),
      pref: () => 4,
      params: (c) => ({ ele: Math.round(c.maxEle), at: c.maxAt, km: c.maxKm }) },
    { id: 'time-on-road', types: ['new-viewer', 'returning-viewer'], beats: ['fact'], min: 3, max: 4.2, flex: true,
      eligible: (c) => c.movingH >= 0.4 && c.avgKmh > 0,
      base: (c) => ({ relevance: 0.8, novelty: 0.8, emotion: c.movingH >= 6 ? 0.7 : 0.45, visual: 0.4, milestone: 0 }),
      pref: () => 3.6,
      params: (c) => ({ text: hoursText(c.movingH), hours: r2(c.movingH), avgKmh: r1(c.avgKmh) }) },
    { id: 'note-card', types: ['new-viewer', 'returning-viewer'], beats: ['moment', 'reflection'], min: 3.5, max: 6, flex: true,
      eligible: (c) => !!c.note,
      base: (c) => ({ relevance: 0.9, novelty: 0.8, emotion: 0.85, visual: 0.4, milestone: 0 }),
      pref: (c) => clamp(3 + c.noteWords * 0.3, 3.8, 6),
      params: (c) => ({ text: shortNote(c.note.text) }) },
    { id: 'location-card', types: ['new-viewer', 'returning-viewer'], beats: ['moment'], min: 3, max: 4, flex: true,
      eligible: (c) => !!c.position,
      base: (c) => ({ relevance: 0.55, novelty: 0.5, emotion: 0.25, visual: 0.5, milestone: 0 }),
      pref: () => 3.5,
      params: (c) => ({ label: c.seg.to || null, lon: r2(c.position[0]), lat: r2(c.position[1]) }) },
    { id: 'distance-counter', beats: ['proof'], min: 3, max: 4.2, flex: true,
      eligible: (c) => !c.schematic,
      base: (c) => ({ relevance: 0.8, novelty: 0.6, emotion: 0.3, visual: 0.5, milestone: c.milestoneKm ? 1 : 0 }),
      pref: () => 3.6,
      params: (c) => ({ newKm: c.newKm, totalKm: c.totalKm, gain: c.gain || null }) },
    { id: 'day-barcode', beats: ['proof'], min: 3.5, max: 5, flex: true,
      eligible: (c) => c.daysCount >= 5 && !c.schematic,
      base: (c) => ({ relevance: 0.75, novelty: 0.5, emotion: 0.3, visual: 0.9, milestone: c.dayMilestone ? 1 : 0 }),
      pref: () => 4.2,
      params: (c) => ({ perDay: c.perDay.map(r1), current: c.day, totalKm: c.totalKm }) },
    { id: 'elevation-profile', types: ['new-viewer', 'returning-viewer'], beats: ['proof'], min: 3.4, max: 5, flex: true,
      eligible: (c) => c.gain >= 150,
      base: (c) => ({ relevance: 0.75, novelty: 0.8, emotion: 0.4, visual: clamp(c.gain / 1200, c.profile ? 0.7 : 0.4, 1), milestone: 0 }),
      pref: (c) => (c.profile ? 4.4 : 3.6),
      params: (c) => ({ gain: c.gain, day: c.day, profile: c.profile, maxEle: c.maxEle != null ? Math.round(c.maxEle) : null, minEle: c.minEle != null ? Math.round(c.minEle) : null }) },
    { id: 'pullback', beats: ['outro'], min: 5.5, max: 8.5, flex: true, hero: true, signature: true,
      eligible: (c) => c.daysCount >= 2,
      base: (c) => ({ relevance: 1, novelty: 0.7, emotion: 0.7, visual: 1, milestone: c.milestoneKm ? 0.6 : 0 }),
      pref: () => 7,
      params: (c) => ({ totalKm: c.totalKm, day: c.day, showFullRoute: true, showCurrentPosition: true }) },
    // один трек: финал — итог дня тремя числами, а не «путешествие продолжается»
    { id: 'day-summary', types: ['new-viewer', 'returning-viewer'], beats: ['outro'], min: 4, max: 5.5, flex: true,
      eligible: (c) => c.daysCount === 1,
      base: () => ({ relevance: 1, novelty: 0.6, emotion: 0.5, visual: 0.7, milestone: 0 }),
      pref: () => 4.6,
      params: (c) => ({ km: c.newKm, from: c.from, to: c.to, name: c.name, gain: c.gain || null, time: c.movingH >= 0.4 ? hoursText(c.movingH) : null, date: c.date }) },
    { id: 'progress-poster', beats: ['outro'], min: 3.5, max: 5, flex: true,
      eligible: () => true,
      base: (c) => ({ relevance: 0.8, novelty: 0.4, emotion: 0.5, visual: 0.6, milestone: 0 }),
      pref: () => 4.2,
      params: (c) => ({ totalKm: c.totalKm, day: c.day }) },
    // story-so-far
    { id: 'season-card', beats: ['hook'], types: ['story-so-far'], min: 3, max: 4, flex: true,
      eligible: () => true,
      base: () => ({ relevance: 1, novelty: 0.6, emotion: 0.4, visual: 0.5, milestone: 0 }),
      pref: () => 3.5,
      params: (c) => ({ title: c.title, traveler: c.traveler, days: c.day, totalKm: c.totalKm, line: c.seasonLine || null }) },
    { id: 'journey-recap', beats: ['context'], types: ['story-so-far'], min: 8, max: 27, flex: true, hero: true,
      eligible: (c) => c.daysCount >= 2,
      base: () => ({ relevance: 1, novelty: 0.7, emotion: 0.6, visual: 1, milestone: 0.6 }),
      pref: (c) => clamp(1 + compressHistory({ checkpoints: c.checkpoints }, c.day + 1, 5).length * 5, 8, 27),
      params: (c) => ({ history: compressHistory({ checkpoints: c.checkpoints }, c.day + 1, 5) }) },
    { id: 'highlights-reel', beats: ['moment'], types: ['story-so-far'], min: 7.5, max: 16.5, flex: true, hero: true,
      eligible: (c) => c.allPhotos.length >= 2,
      base: () => ({ relevance: 1, novelty: 0.8, emotion: 1, visual: 0.8, milestone: 0, mediaQ: 0.8 }),
      pref: (c) => 0.5 + Math.min(4, c.allPhotos.length) * 4,
      params: (c) => ({ mediaIds: spread(c.allPhotos, 4).map((m) => m.id) }) },
  ];
  const BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

  function shortNote(text) {
    const w = text.trim().split(/\s+/);
    if (w.length <= 12) return text.trim();
    const first = text.split(/(?<=[.!?…])\s+/)[0];
    return first.split(/\s+/).length <= 12 ? first : w.slice(0, 11).join(' ') + '…';
  }
  function spread(arr, n) { if (arr.length <= n) return arr.slice(); const out = []; for (let i = 0; i < n; i++) out.push(arr[Math.round((i * (arr.length - 1)) / (n - 1))]); return out; }

  /* ================= Типы эпизода и биты ================= */
  const TYPES = {
    'new-viewer': [['hook', true], ['context', true], ['new-leg', true], ['achievement', false], ['fact', false], ['moment', false], ['reflection', false], ['proof', false], ['outro', true]],
    'returning-viewer': [['hook', true], ['new-leg', true], ['achievement', false], ['fact', false], ['moment', false], ['reflection', false], ['proof', false], ['outro', true]],
    'story-so-far': [['hook', true], ['context', true], ['moment', false], ['proof', false], ['outro', true]],
  };
  // длительность от содержания: лучше дольше, чем мелькание (правила кадра)
  const DURATION = { 'new-viewer': [30, 42, 24, 50], 'returning-viewer': [26, 38, 20, 46], 'story-so-far': [40, 58, 30, 66] };

  /* ================= Скоринг ================= */
  const W = { relevance: 4, novelty: 3, emotion: 3, visual: 2, milestone: 2, mediaQ: 2, repetition: 4, redundancy: 3, durationCost: 1 };
  const OPTIONAL_MIN = 7;   // необязательный бит берём, только если лучший вариант набирает больше

  function score(recipe, ctx, beat, chosen) {
    const b = recipe.base(ctx, beat);
    // повторы: как часто этот рецепт стоял в том же бите последних серий
    const slotUses = ctx.recent.filter((e) => (e.byBeat || {})[beat] === recipe.id).length;
    const anyUses = ctx.recent.filter((e) => (e.recipes || []).includes(recipe.id)).length;
    const repetition = clamp(slotUses / 3 + anyUses / 12, 0, recipe.signature ? 0.35 : 1);   // фирменные кадры повтор не вытесняет
    const redundancy = chosen.includes(recipe.id) ? 1 : 0;
    const durationCost = clamp((recipe.pref(ctx) - 2) / 6, 0, 1);
    const parts = { relevance: b.relevance || 0, novelty: b.novelty || 0, emotion: b.emotion || 0, visual: b.visual || 0, milestone: b.milestone || 0, mediaQ: b.mediaQ || 0, repetition, redundancy, durationCost };
    const total = W.relevance * parts.relevance + W.novelty * parts.novelty + W.emotion * parts.emotion + W.visual * parts.visual + W.milestone * parts.milestone + W.mediaQ * parts.mediaQ - W.repetition * parts.repetition - W.redundancy * parts.redundancy - W.durationCost * parts.durationCost;
    return { total: r2(total), parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, r2(v)])) };
  }

  const mkShot = (rc, ctx, beat, required, sc) => ({ beat, recipe: rc.id, durationSec: r2(rc.pref(ctx)), min: rc.minFor ? r2(rc.minFor(ctx)) : rc.min, max: rc.maxFor ? rc.maxFor(ctx) : rc.max, hero: !!rc.hero, required, score: sc, params: rc.params(ctx) });

  /* ================= Сборка плана ================= */
  function direct(J, episodeType, opts = {}) {
    const ctx = buildContext(J, episodeType, opts);
    const beats = TYPES[episodeType];
    if (!beats) throw new Error('Неизвестный тип эпизода: ' + episodeType);
    const chosen = [], shots = [], log = [], spare = [];
    for (const [beat, required] of beats) {
      const cands = RECIPES.filter((r) => r.beats.includes(beat) && (!r.types || r.types.includes(episodeType)));
      const evals = cands.map((r) => {
        const ok = !!r.eligible(ctx);
        return ok ? { id: r.id, eligible: true, ...score(r, ctx, beat, chosen) } : { id: r.id, eligible: false };
      });
      const elig = evals.filter((e) => e.eligible).sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));
      const best = elig[0];
      let reason;
      if (!best) reason = required ? 'нет подходящих рецептов — нужен fallback' : 'нет данных для бита — пропущен';
      else if (!required && best.total < OPTIONAL_MIN) reason = `лучший вариант слабый (${best.total} < ${OPTIONAL_MIN}) — бит пропущен`;
      else reason = elig.length > 1 ? `${best.id} выше ${elig[1].id} на ${r2(best.total - elig[1].total)}` : `${best.id} — единственный подходящий`;
      const take = best && (required || best.total >= OPTIONAL_MIN);
      if (best && !take) spare.push({ beat, id: best.id, score: best.total });
      log.push({ beat, required, candidates: evals, selected: take ? best.id : null, reason });
      if (take) {
        const rc = BY_ID[best.id];
        chosen.push(rc.id);
        shots.push(mkShot(rc, ctx, beat, required, best.total));
      } else if (required) {
        return finish(fallbackPlan(ctx, J), ctx, log, 'обязательный бит «' + beat + '» не собран');
      }
    }
    const fit = fitDuration(shots, episodeType, spare, ctx, beats.map((b) => b[0]));
    return finish(fit.shots, ctx, log, null, fit.note);
  }

  /* Подгонка длительности: не растягиваем ради 30 секунд; сжимаем гибкие кадры, затем убираем слабейший необязательный */
  function fitDuration(shots, type, spare = [], ctx = null, order = []) {
    const [pLo, pHi, hMin, hMax] = DURATION[type];
    let list = shots.map((s) => ({ ...s }));
    const sum = () => list.reduce((a, s) => a + s.durationSec, 0);
    const notes = [];
    if (sum() > pHi) {
      // сжать все гибкие кадры к минимуму пропорционально «запасу»
      const over = sum() - pHi, slack = list.reduce((a, s) => a + (s.durationSec - s.min), 0);
      if (slack > 0) { const k = Math.min(1, over / slack); list.forEach((s) => { s.durationSec = r2(s.durationSec - (s.durationSec - s.min) * k); }); notes.push(`сжато на ${r1(Math.min(over, slack))} с`); }
      while (sum() > hMax) {
        const opt = list.filter((s) => !s.required).sort((a, b) => a.score - b.score)[0];
        if (!opt) break;
        list = list.filter((s) => s !== opt); notes.push(`убран слабейший необязательный кадр ${opt.recipe}`);
      }
    } else if (sum() < pLo) {
      // удлинить героические кадры, момент и финал в пределах их максимума
      let need = pLo - sum();
      for (const s of [...list].sort((a, b) => Number(b.hero) - Number(a.hero) || b.score - a.score)) {
        if (need <= 0) break; const add = Math.min(need, s.max - s.durationSec); s.durationSec = r2(s.durationSec + add); need -= add;
      }
      notes.push('удлинены главные кадры');
      // всё ещё коротко — возвращаем пропущенные необязательные биты (по порядку повествования), если они не повторяют соседа
      for (const sp of spare.sort((a, b) => b.score - a.score)) {
        if (sum() >= hMin) break;
        const r = BY_ID[sp.id]; const pos = order.indexOf(sp.beat);
        let at = list.findIndex((s) => order.indexOf(s.beat) > pos); if (at < 0) at = list.length;
        if ((list[at - 1] && list[at - 1].recipe === r.id) || (list[at] && list[at].recipe === r.id) || list.some((s) => s.recipe === r.id)) continue;
        list.splice(at, 0, { ...mkShot(r, ctx, sp.beat, false, sp.score), durationSec: r2(Math.min(r.max, Math.max(r.pref(ctx), hMin - sum()))) });
        notes.push(`добавлен ${r.id}, чтобы не было короче ${hMin} с`);
      }
    }
    // новый участок — не позже ~10 с: сжимаем кадры перед ним
    const nl = list.findIndex((s) => s.beat === 'new-leg');
    if (nl > 0) {
      let start = list.slice(0, nl).reduce((a, s) => a + s.durationSec, 0);
      for (let i = 0; i < nl && start > 10; i++) { const cut = Math.min(start - 10, list[i].durationSec - list[i].min); list[i].durationSec = r2(list[i].durationSec - cut); start -= cut; }
    }
    return { shots: list, note: notes.join('; ') };
  }

  function fallbackPlan(ctx) {
    const ids = ['day-card', 'route-reveal', 'distance-counter', ctx.daysCount >= 2 ? 'pullback' : 'progress-poster'];
    return ids.map((id, i) => mkShot(BY_ID[id], ctx, ['hook', 'new-leg', 'proof', 'outro'][i], true, 0));
  }

  function finish(shots, ctx, log, fallbackReason, fitNote) {
    let t = 0;
    const beats = shots.map((s) => { const b = { beat: s.beat, recipe: s.recipe, startSec: r2(t), durationSec: s.durationSec, params: s.params }; t += s.durationSec; return b; });
    const seedSrc = JSON.stringify([ctx.journeyId, ctx.day, ctx.type, ctx.aspect, ctx.newKm, ctx.photos.map((m) => m.id), ctx.note && ctx.note.text, ctx.recent.map((e) => e.episodeId), ctx.from, ctx.to, ctx.waypoints.map((w) => w.name), ctx.movingH, ctx.maxEle]);
    const plan = {
      episodeId: `day-${ctx.day}-${ctx.type}`, journeyId: ctx.journeyId, episodeNumber: ctx.day, episodeType: ctx.type, aspect: ctx.aspect,
      seed: hash(seedSrc), durationSec: r2(t), fallback: fallbackReason || null, fitting: fitNote || '', beats,
    };
    return { plan, log, ctx };
  }

  /* ================= Проверка плана ================= */
  function validate(plan, J) {
    const errors = [], warnings = [];
    const [, , hMin, hMax] = DURATION[plan.episodeType] || [0, 0, 18, 30];
    if (plan.durationSec < hMin - 0.01 || plan.durationSec > hMax + 0.01) errors.push(`длительность ${plan.durationSec} с вне ${hMin}–${hMax}`);
    const types = TYPES[plan.episodeType]; if (!types) errors.push('неизвестный тип');
    for (const [beat, req] of types || []) if (req && !plan.beats.some((b) => b.beat === beat)) errors.push(`нет обязательного бита ${beat}`);
    const mediaIds = new Set((J.media || []).map((m) => m.id));
    plan.beats.forEach((b, i) => {
      const r = BY_ID[b.recipe]; if (!r) { errors.push(`нет рецепта ${b.recipe}`); return; }
      if (b.durationSec < r.min - 0.01 || b.durationSec > r.max + 0.01) warnings.push(`${b.recipe}: ${b.durationSec} с вне ${r.min}–${r.max}`);
      (b.params.mediaIds || []).forEach((id) => { if (!mediaIds.has(id)) errors.push(`${b.recipe}: нет медиа ${id}`); });
      if (b.recipe === 'photo-reveal' && !(b.params.mediaIds || []).length) errors.push('photo-reveal без фото');
      if (b.params.text && b.params.text.split(/\s+/).length > 12) warnings.push(`${b.recipe}: текст длиннее 12 слов`);
      if (i > 0 && plan.beats[i - 1].recipe === b.recipe) errors.push(`${b.recipe} два раза подряд`);
      if (b.recipe === 'route-reveal' || b.recipe === 'camera-follow') { if (!J.days.some((d) => d.day === b.params.day)) errors.push('нет сегмента дня ' + b.params.day); if (b.startSec > 10.01) warnings.push(`новый участок начинается на ${b.startSec} с (> 10 с)`); }
    });
    if (plan.beats.length > 8) warnings.push(`кадров ${plan.beats.length} (> 8)`);
    return { ok: errors.length === 0, errors, warnings };
  }

  /* Память серии: что использовали (для разнообразия следующих серий) */
  function summaryOf(plan) {
    const byBeat = {}; plan.beats.forEach((b) => { byBeat[b.beat] = b.recipe; });
    return { episodeId: plan.episodeId, episodeType: plan.episodeType, recipes: plan.beats.map((b) => b.recipe), byBeat, hookRecipe: byBeat.hook, momentRecipe: byBeat.moment, outroRecipe: byBeat.outro };
  }

  const API = { summarize, addDay, buildContext, direct, validate, summaryOf, compressHistory, pickWaypoints, RECIPES, TYPES, DURATION, hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Director = API;
})(typeof window !== 'undefined' ? window : globalThis);
