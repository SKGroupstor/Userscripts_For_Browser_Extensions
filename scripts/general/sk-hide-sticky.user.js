// ==UserScript==
// @name         SK Hide Sticky Elements
// @namespace    skgroups
// @version      1.0
// @description  One tap hides all fixed/sticky overlays (headers, chat widgets, popups, banners); tap again to restore
// @match        *://*/*
// @noframes
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/general/sk-hide-sticky.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/general/sk-hide-sticky.user.js
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const slot = (window.__skFab = (window.__skFab || 0) + 1);
  let hidden = [];

  function toggle() {
    if (hidden.length) {
      hidden.forEach(({ el, prev }) => { el.style.display = prev; });
      hidden = [];
      b.style.background = '#111';
      return;
    }
    document.querySelectorAll('body *').forEach(el => {
      if (el.closest('[data-sk]')) return;
      const pos = getComputedStyle(el).position;
      if (pos === 'fixed' || pos === 'sticky') {
        hidden.push({ el, prev: el.style.display });
        el.style.display = 'none';
      }
    });
    b.style.background = hidden.length ? '#ff9500' : '#111';
  }

  const b = document.createElement('button');
  b.textContent = 'Hide';
  b.title = 'Hide / restore sticky elements';
  b.setAttribute('data-sk', '1');
  Object.assign(b.style, { position: 'fixed', left: '12px', bottom: (12 + 50 * (slot - 1)) + 'px', zIndex: 2147483647, width: '42px', height: '42px', borderRadius: '50%', border: 'none', background: '#111', color: '#fff', font: '600 11px -apple-system,sans-serif', opacity: '.75', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.4)' });
  b.onclick = toggle;
  document.documentElement.appendChild(b);
})();
