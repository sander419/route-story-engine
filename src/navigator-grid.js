/* Абстрактный фон «Навигатора»: лёгкая экранная сетка без тайлов и зависимости от GPU. */
(function () {
  function draw(ctx, W, H, u) {
    const step = 120 * u;
    ctx.save();
    ctx.lineWidth = Math.max(1, 1.5 * u);
    ctx.strokeStyle = 'rgba(67,231,255,.14)';
    ctx.beginPath();
    for (let x = W / 2 % step; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = H / 2 % step; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    const cx = W / 2, cy = H * 0.44;
    ctx.strokeStyle = 'rgba(240,93,225,.13)';
    for (const r of [260, 520, 780]) {
      ctx.beginPath(); ctx.arc(cx, cy, r * u, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(67,231,255,.24)';
    ctx.beginPath();
    ctx.moveTo(cx - 32 * u, cy); ctx.lineTo(cx + 32 * u, cy);
    ctx.moveTo(cx, cy - 32 * u); ctx.lineTo(cx, cy + 32 * u);
    ctx.stroke();
    ctx.restore();
  }
  window.NavigatorGrid = { draw };
})();
