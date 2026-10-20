// ==UserScript==
// @name         SK Copy Table as CSV
// @namespace    skgroups
// @version      1.0
// @description  Floating button: tap to cycle through tables on the page (highlighted), long-press to copy the highlighted table as CSV
// @match        *://*/*
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const slot = (window.__skFab = (window.__skFab || 0) + 1);
  let idx = -1;
  let current = null;
  let pressTimer = null;
  let longPressed = false;

  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.setAttribute('data-sk', '1');
    Object.assign(t.style, { position: 'fixed', left: '50%', bottom: '80px', transform: 'translateX(-50%)', background: '#111', color: '#fff', padding: '8px 14px', borderRadius: '8px', font: '14px -apple-system,sans-serif', zIndex: 2147483647, maxWidth: '80vw' });
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const a = document.createElement('textarea');
      a.value = text; a.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove();
    }
  }

  function tables() {
    return [...document.querySelectorAll('table')].filter(t => t.rows.length > 1);
  }

  function toCSV(table) {
    return [...table.rows].map(r =>
      [...r.cells].map(c => '"' + c.innerText.trim().replace(/\s+/g, ' ').replace(/"/g, '""') + '"').join(',')
    ).join('\n');
  }

  function highlight(t) {
    if (current) current.style.outline = '';
    current = t;
    if (t) { t.style.outline = '3px solid #ff9500'; t.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }

  const b = document.createElement('button');
  b.textContent = 'CSV';
  b.title = 'Tap: next table. Long-press: copy as CSV';
  b.setAttribute('data-sk', '1');
  Object.assign(b.style, { position: 'fixed', left: '12px', bottom: (12 + 50 * (slot - 1)) + 'px', zIndex: 2147483647, width: '42px', height: '42px', borderRadius: '50%', border: 'none', background: '#111', color: '#fff', font: '600 12px -apple-system,sans-serif', opacity: '.75', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.4)' });

  const start = () => {
    longPressed = false;
    pressTimer = setTimeout(async () => {
      longPressed = true;
      if (!current) return toast('Tap first to pick a table');
      await copy(toCSV(current));
      toast('Table copied as CSV');
    }, 600);
  };
  const end = () => clearTimeout(pressTimer);

  b.addEventListener('touchstart', start, { passive: true });
  b.addEventListener('touchend', end);
  b.addEventListener('mousedown', start);
  b.addEventListener('mouseup', end);
  b.addEventListener('click', () => {
    if (longPressed) return;
    const list = tables();
    if (!list.length) return toast('No tables found');
    idx = (idx + 1) % list.length;
    highlight(list[idx]);
    toast('Table ' + (idx + 1) + ' of ' + list.length + ' (long-press to copy)');
  });

  document.documentElement.appendChild(b);
})();
