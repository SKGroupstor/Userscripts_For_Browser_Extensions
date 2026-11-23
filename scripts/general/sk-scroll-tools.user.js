// ==UserScript==
// @name         SK Scroll Tools
// @namespace    skgroups
// @version      1.0
// @description  Jump to top/bottom and hands-free auto-scroll (tap to cycle speed, any touch/scroll input stops it)
// @match        *://*/*
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  function fab(label, title, onClick) {
    const slot = (window.__skFab = (window.__skFab || 0) + 1);
    const b = document.createElement('button');
    b.textContent = label;
    b.title = title;
    b.setAttribute('data-sk', '1');
    Object.assign(b.style, { position: 'fixed', left: '12px', bottom: (12 + 50 * (slot - 1)) + 'px', zIndex: 2147483647, width: '42px', height: '42px', borderRadius: '50%', border: 'none', background: '#111', color: '#fff', font: '600 15px -apple-system,sans-serif', opacity: '.75', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.4)' });
    b.onclick = onClick;
    document.documentElement.appendChild(b);
    return b;
  }

  const speeds = [0, 0.5, 1, 2, 4];
  let level = 0;
  let pos = 0;
  let raf = null;

  function tick() {
    if (!speeds[level]) { raf = null; return; }
    pos += speeds[level];
    window.scrollTo(0, pos);
    raf = requestAnimationFrame(tick);
  }

  function setLevel(n) {
    level = n;
    auto.textContent = level ? level + 'x' : '\u25B6';
    auto.style.background = level ? '#ff9500' : '#111';
    if (level && !raf) { pos = window.scrollY; raf = requestAnimationFrame(tick); }
  }

  fab('\u2193', 'Bottom', () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
  fab('\u2191', 'Top', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  const auto = fab('\u25B6', 'Auto-scroll', () => setLevel((level + 1) % speeds.length));

  ['wheel', 'touchstart', 'keydown'].forEach(t =>
    window.addEventListener(t, e => {
      if (level && !(e.target && e.target.closest && e.target.closest('[data-sk]'))) setLevel(0);
    }, { passive: true })
  );
})();
