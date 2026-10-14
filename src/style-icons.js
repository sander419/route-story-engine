/* Одна библиотека на стиль. Ручные стикеры сохранены в коде, но отключены. */
(function () {
  const families = { journal:'phosphor', editorial:'lucide', paper:'tabler', night:'bootstrap' };
  const names = { phosphor:'Phosphor Duotone', lucide:'Lucide', tabler:'Tabler Icons', bootstrap:'Bootstrap Icons' };
  const cache = new Map();
  function image(style, role, color) {
    const family = families[style] || 'phosphor', hex = /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#dfad72', key = family + '|' + role + '|' + hex;
    if (cache.has(key)) return cache.get(key);
    const svg = window.StyleIconData[family][role]; if (!svg) return null;
    const e = { ok:false, img:new Image(), family, role }; e.img._routeIcon = true;
    e.p = new Promise(resolve => { e.img.onload=()=>{e.ok=true;resolve();}; e.img.onerror=()=>resolve(); e.img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg.replace(/currentColor/g,hex)); });
    cache.set(key,e); return e;
  }
  window.StyleIcons = { legacyEnabled:false, families, names, image, familyName:style=>names[families[style] || 'phosphor'] };
})();
