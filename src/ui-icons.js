/* Единые контурные пиктограммы управления, 24×24, stroke 2. Подписи остаются текстом. */
(function () {
  const paths = {
    route: '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M8 5h7a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h7"/>',
    text: '<path d="M4 5h16M12 5v14M8 19h8"/>',
    photo: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 3-3 6 6"/>',
    look: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.4 1.4 0 0 1 .8-2.6H17a4 4 0 0 0 4-4C21 6.3 17 3 12 3Z"/><path d="M8 7h.01M5.5 12h.01M8 16h.01M13 6.5h.01"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    play: '<path d="m8 4 12 8-12 8Z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
  };
  function icon(name) {
    const t = document.createElement('template');
    t.innerHTML = `<svg class="ui-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.route}</svg>`;
    return t.content.firstElementChild;
  }
  window.UIIcons = { icon };
})();
