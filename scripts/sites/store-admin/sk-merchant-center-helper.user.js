// ==UserScript==
// @name         SK Merchant Center Helper
// @namespace    skgroups
// @version      1.0
// @description  Google Merchant Center: quick-nav that keeps your account (?a=) and one-tap copy of the visible table (diagnostics issues, product lists) as spreadsheet-ready TSV. Read-only - never clicks settings.
// @match        *://merchants.google.com/*
// @noframes
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/sites/store-admin/sk-merchant-center-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/sites/store-admin/sk-merchant-center-helper.user.js
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const slot = (window.__skFab = (window.__skFab || 0) + 1);

  function mk(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  function toast(msg) {
    const t = mk('div', 'position:fixed;left:50%;bottom:80px;transform:translateX(-50%);background:#111;color:#fff;padding:8px 14px;border-radius:8px;font:14px -apple-system,sans-serif;z-index:2147483647;max-width:80vw', msg);
    t.setAttribute('data-sk', '1');
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const a = document.createElement('textarea');
      a.value = text; a.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(a); a.select();
      const ok = document.execCommand('copy'); a.remove(); return ok;
    }
  }

  // Merchant Center is a single-page app, so read the account from the live URL each time
  function go(path) {
    const a = new URL(location.href).searchParams.get('a');
    location.href = 'https://merchants.google.com' + path + (a ? '?a=' + encodeURIComponent(a) : '');
  }

  const clean = s => (s || '').replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

  function tableToTSV() {
    // ARIA grids first (Merchant Center's data tables), then plain <table>
    const rows = [...document.querySelectorAll('[role="row"]')].filter(r => r.offsetParent !== null);
    const lines = [];
    rows.forEach(r => {
      const cells = [...r.querySelectorAll('[role="columnheader"], [role="gridcell"], [role="cell"]')];
      if (cells.length) lines.push(cells.map(c => clean(c.innerText)).join('\t'));
    });
    if (lines.length > 1) return lines.join('\n');

    const table = [...document.querySelectorAll('table')].sort((a, b) => b.rows.length - a.rows.length)[0];
    if (table && table.rows.length > 1) {
      return [...table.rows].map(r => [...r.cells].map(c => clean(c.innerText)).join('\t')).join('\n');
    }
    return '';
  }

  const NAV = [
    ['Overview', '/mc/overview'],
    ['Products', '/mc/products'],
    ['Diagnostics', '/mc/products/diagnostics'],
    ['Data sources', '/mc/products/sources']
  ];

  const menu = mk('div', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;background:#111;color:#fff;border-radius:12px;padding:6px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
  menu.setAttribute('data-sk', '1');

  function item(label, fn, accent) {
    const b = mk('button', 'display:block;width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:' + (accent ? '#34c759' : '#fff') + ';font-size:14px', label);
    b.onclick = () => { menu.style.display = 'none'; fn(); };
    menu.appendChild(b);
  }

  item('Copy visible table (TSV)', async () => {
    const tsv = tableToTSV();
    if (!tsv) return toast('No table found. Open Products or Diagnostics first.');
    const rows = tsv.split('\n').length;
    toast((await copy(tsv)) ? 'Copied ' + rows + ' rows (only rows currently loaded on screen)' : 'Copy failed');
  }, true);
  NAV.forEach(([label, path]) => item(label, () => go(path)));

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#1a73e8;color:#fff;font:700 12px -apple-system,sans-serif;opacity:.9;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'MC');
  fab.setAttribute('data-sk', '1');
  fab.onclick = () => { menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; };
  document.documentElement.append(menu, fab);
})();
