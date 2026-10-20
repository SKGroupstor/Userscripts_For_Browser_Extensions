// ==UserScript==
// @name         SK Word Count & Reading Time
// @namespace    skgroups
// @version      1.0
// @description  Tap the button to see word count and estimated reading time for the page (or your current selection)
// @match        *://*/*
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const slot = (window.__skFab = (window.__skFab || 0) + 1);

  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.setAttribute('data-sk', '1');
    Object.assign(t.style, { position: 'fixed', left: '50%', bottom: '80px', transform: 'translateX(-50%)', background: '#111', color: '#fff', padding: '8px 14px', borderRadius: '8px', font: '14px -apple-system,sans-serif', zIndex: 2147483647, textAlign: 'center' });
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  const b = document.createElement('button');
  b.textContent = 'Wc';
  b.title = 'Word count';
  b.setAttribute('data-sk', '1');
  Object.assign(b.style, { position: 'fixed', left: '12px', bottom: (12 + 50 * (slot - 1)) + 'px', zIndex: 2147483647, width: '42px', height: '42px', borderRadius: '50%', border: 'none', background: '#111', color: '#fff', font: '600 13px -apple-system,sans-serif', opacity: '.75', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.4)' });
  b.addEventListener('mousedown', e => e.preventDefault());
  b.onclick = () => {
    const sel = (window.getSelection().toString() || '').trim();
    const main = document.querySelector('article, main, [role="main"]') || document.body;
    const text = sel || main.innerText || '';
    const words = (text.match(/\S+/g) || []).length;
    const mins = Math.max(1, Math.round(words / 225));
    toast((sel ? 'Selection: ' : 'Page: ') + words.toLocaleString() + ' words \u00B7 ~' + mins + ' min read');
  };
  document.documentElement.appendChild(b);
})();
