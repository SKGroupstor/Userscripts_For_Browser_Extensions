// ==UserScript==
// @name         SK Page Change Watcher
// @namespace    skgroups
// @version      1.0
// @description  Auto-reloads a page on an interval and alerts you when its content changes (optionally watch just one CSS selector) - handy for stock/price checks
// @match        *://*/*
// @noframes
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/general/sk-page-change-watcher.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/general/sk-page-change-watcher.user.js
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const KEY = 'sk_watch_' + location.origin + location.pathname + location.search;
  const slot = (window.__skFab = (window.__skFab || 0) + 1);

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const save = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {} };

  function hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return String(h);
  }

  function snapshot(sel) {
    const el = sel ? document.querySelector(sel) : document.body;
    return el ? hash(el.innerText.replace(/\s+/g, ' ').trim()) : 'missing';
  }

  function alertChange() {
    document.title = '\uD83D\uDD14 CHANGED - ' + document.title.replace(/^\uD83D\uDD14 CHANGED - /, '');
    try {
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Page changed', { body: location.href });
    } catch {}
  }

  const b = document.createElement('button');
  b.title = 'Page change watcher';
  b.setAttribute('data-sk', '1');
  Object.assign(b.style, { position: 'fixed', left: '12px', bottom: (12 + 50 * (slot - 1)) + 'px', zIndex: 2147483647, width: '42px', height: '42px', borderRadius: '50%', border: 'none', color: '#fff', font: '600 12px -apple-system,sans-serif', opacity: '.8', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.4)' });
  document.documentElement.appendChild(b);

  let state = load();

  function paint() {
    b.textContent = state ? 'ON' : 'Watch';
    b.style.background = state ? '#34c759' : '#111';
  }
  paint();

  b.onclick = () => {
    if (state) { state = null; save(null); paint(); return; }
    const sec = parseInt(prompt('Reload every how many seconds?', '60'), 10);
    if (!sec || sec < 5) return;
    const sel = (prompt('CSS selector to watch (blank = whole page)', '') || '').trim();
    state = { sec, sel, hash: snapshot(sel) };
    save(state);
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch {}
    paint();
    schedule();
  };

  function schedule() {
    if (!state) return;
    setTimeout(() => { if (load()) location.reload(); }, state.sec * 1000);
  }

  if (state) {
    setTimeout(() => {
      const now = snapshot(state.sel);
      if (now !== state.hash) {
        alertChange();
        state.hash = now;
        save(state);
      }
    }, 2500);
    schedule();
  }
})();
