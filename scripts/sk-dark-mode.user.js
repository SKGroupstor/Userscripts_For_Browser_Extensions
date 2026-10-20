// ==UserScript==
// @name         SK Dark Mode Toggle
// @namespace    skgroups
// @version      1.0
// @description  Floating button that inverts any page into dark mode (remembered per site)
// @match        *://*/*
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const KEY = 'sk_dark_' + location.hostname;
  const slot = (window.__skFab = (window.__skFab || 0) + 1);
  const style = document.createElement('style');
  style.id = 'sk-dark-style';
  style.textContent =
    'html{filter:invert(1) hue-rotate(180deg)!important;background:#fff!important}' +
    'img,video,canvas,picture,svg image,[style*="background-image"],[data-sk]{filter:invert(1) hue-rotate(180deg)!important}';

  const get = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
  const set = v => { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch {} };

  function apply(on) {
    const existing = document.getElementById('sk-dark-style');
    if (on && !existing) document.documentElement.appendChild(style);
    if (!on && existing) existing.remove();
  }

  let on = get();
  apply(on);

  const b = document.createElement('button');
  b.textContent = '\u263E';
  b.title = 'Toggle dark mode';
  b.setAttribute('data-sk', '1');
  Object.assign(b.style, { position: 'fixed', left: '12px', bottom: (12 + 50 * (slot - 1)) + 'px', zIndex: 2147483647, width: '42px', height: '42px', borderRadius: '50%', border: 'none', background: '#111', color: '#fff', font: '600 18px -apple-system,sans-serif', opacity: '.75', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.4)' });
  b.onclick = () => { on = !on; set(on); apply(on); };
  document.documentElement.appendChild(b);
})();
