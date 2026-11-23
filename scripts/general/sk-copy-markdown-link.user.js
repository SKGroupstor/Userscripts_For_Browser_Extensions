// ==UserScript==
// @name         SK Copy as Markdown
// @namespace    skgroups
// @version      1.0
// @description  Copies the page as a Markdown link - or your selected text as a blockquote with source - to the clipboard
// @match        *://*/*
// @noframes
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/general/sk-copy-markdown-link.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/general/sk-copy-markdown-link.user.js
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const slot = (window.__skFab = (window.__skFab || 0) + 1);

  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.setAttribute('data-sk', '1');
    Object.assign(t.style, { position: 'fixed', left: '50%', bottom: '80px', transform: 'translateX(-50%)', background: '#111', color: '#fff', padding: '8px 14px', borderRadius: '8px', font: '14px -apple-system,sans-serif', zIndex: 2147483647 });
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const a = document.createElement('textarea');
      a.value = text; a.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove();
    }
  }

  const b = document.createElement('button');
  b.textContent = 'MD';
  b.title = 'Copy as Markdown';
  b.setAttribute('data-sk', '1');
  Object.assign(b.style, { position: 'fixed', left: '12px', bottom: (12 + 50 * (slot - 1)) + 'px', zIndex: 2147483647, width: '42px', height: '42px', borderRadius: '50%', border: 'none', background: '#111', color: '#fff', font: '600 13px -apple-system,sans-serif', opacity: '.75', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.4)' });
  b.addEventListener('mousedown', e => e.preventDefault());
  b.onclick = async () => {
    const sel = (window.getSelection().toString() || '').trim();
    const title = document.title.replace(/[\[\]]/g, '');
    const link = '[' + title + '](' + location.href + ')';
    const text = sel
      ? sel.split(/\n+/).map(l => '> ' + l).join('\n') + '\n\n\u2014 ' + link
      : link;
    await copy(text);
    toast(sel ? 'Quote copied' : 'Link copied');
  };
  document.documentElement.appendChild(b);
})();
