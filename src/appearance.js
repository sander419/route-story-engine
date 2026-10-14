/* Шрифты из Typography Collection 2026 и палитры ролика. Только локальные ресурсы. */
(function () {
  const palettes = {
    coast: { name: 'Ночной берег', bg: '#152a32', text: '#f2efe5', muted: '#bbc8c5', accent: '#dfad72', route: '#e9b56e', land: '#93a18d', water: '#638d9c', photoText: '#fff5e5', finalBg: '#cbb48f', finalText: '#17282a' },
    forest: { name: 'Хвоя и лён', bg: '#24382f', text: '#f3edda', muted: '#c1c9b6', accent: '#c5aa70', route: '#e8c57e', land: '#8b9d7c', water: '#748f93', photoText: '#fff4df', finalBg: '#d4c7a9', finalText: '#28382e' },
    clay: { name: 'Глина и песок', bg: '#3c302c', text: '#f6eddd', muted: '#d2c0ae', accent: '#d49b7d', route: '#f0bc88', land: '#ac9d83', water: '#6f9195', photoText: '#fff2df', finalBg: '#cfa187', finalText: '#352b27' },
    chalk: { name: 'Мел и графит', bg: '#eae7df', text: '#27363b', muted: '#596b70', accent: '#8c533c', route: '#b2603d', land: '#a8ad97', water: '#779aa6', photoText: '#fff6e5', finalBg: '#334b56', finalText: '#f3ecdc' },
  };
  const fonts = {
    cormorant: { name: 'Cormorant Garamond', family: '"Cormorant Garamond", "RS Geologica", Georgia, serif', weight: 600 },
    prata: { name: 'Prata', family: '"Prata", "RS Geologica", Georgia, serif', weight: 400 },
    din: { name: 'DINish', family: '"RS DINish", sans-serif', weight: 700 },
    geologica: { name: 'Geologica', family: '"RS Geologica", sans-serif', weight: 600 },
    onest: { name: 'Onest', family: '"Onest", sans-serif', weight: 600 },
  };
  const defaults = { ...palettes.coast, shade: '#122127', preset: 'coast', heading: 'cormorant', body: 'geologica' };
  const colorKeys = ['bg', 'text', 'muted', 'accent', 'route', 'land', 'water', 'shade', 'photoText', 'finalBg', 'finalText'];
  function normalize(value) {
    const v = value && typeof value === 'object' ? value : defaults, out = { ...defaults };
    for (const k of colorKeys) if (/^#[0-9a-f]{6}$/i.test(v[k] || '')) out[k] = v[k].toLowerCase();
    for (const k of ['heading', 'body']) if (Object.hasOwn(fonts, v[k]) && (k !== 'body' || ['onest','geologica','din'].includes(v[k]))) out[k] = v[k];
    out.preset = Object.hasOwn(palettes, v.preset) ? v.preset : 'custom'; return out;
  }
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const rgba = (hex, alpha) => `rgba(${rgb(hex).join(',')},${alpha})`;
  function contrast(a, b) {
    const luminance = c => rgb(c).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
    const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  }
  function style(base, value) {
    const a = normalize(value), h = fonts[a.heading], b = fonts[a.body];
    return { ...base, bg: a.bg, ink: a.text, dim: a.muted, accent: a.accent, fHead: h.family, headW: h.weight, fBody: b.family, fNum: fonts.din.family, numW: 700,
      line: { ...base.line, stops: [a.route, a.route] }, panel: a.bg, head: a.text,
      ...(base.vec ? { vec: { ...base.vec, water: a.water, park: a.land, label: a.text, halo: a.bg } } : {}) };
  }
  const ready = () => Promise.all(['600 48px "Cormorant Garamond"', '400 48px "Prata"', '400 32px "Onest"', '600 32px "Onest"', '700 48px "RS DINish"'].map(f => document.fonts.load(f, 'Байкал 0123'))).then(() => document.fonts.ready);
  window.Appearance = { palettes, fonts, defaults, colorKeys, normalize, rgba, contrast, style, ready };
})();
