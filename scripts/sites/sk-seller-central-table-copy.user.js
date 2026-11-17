// ==UserScript==
// @name         SK Seller Central Table Copy
// @namespace    skgroups
// @version      1.0
// @description  On any Seller Central page (Manage Orders, Inventory, reports): copy the visible table as spreadsheet-ready text, or copy every order ID / ASIN shown on the page. Read-only.
// @match        *://sellercentral.amazon.ca/*
// @match        *://sellercentral.amazon.com/*
// @noframes
// @grant        none
// ==/UserScript==

// Copies only what is loaded on screen (long lists load more rows as you scroll, so scroll first).

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const slot = (window.__skFab = (window.__skFab || 0) + 1);
  const clean = s => String(s == null ? '' : s).replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

  function mk(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
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

  function deepAll(root, out) {
    out = out || [];
    root.querySelectorAll('*').forEach(el => { out.push(el); if (el.shadowRoot) deepAll(el.shadowRoot, out); });
    return out;
  }

  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };

  function rowsOf(g) {
    const out = [];
    if (g.tagName === 'TABLE') {
      [...g.rows].forEach(tr => {
        const cells = [...tr.cells].map(c => clean(c.innerText));
        if (cells.some(Boolean)) out.push(cells);
      });
      return out;
    }
    g.querySelectorAll('[role="row"]').forEach(r => {
      const cells = [...r.querySelectorAll('[role="columnheader"],[role="rowheader"],[role="gridcell"],[role="cell"]')].map(c => clean(c.innerText));
      if (cells.some(Boolean)) out.push(cells);
    });
    return out;
  }

  function bestTable() {
    let best = [];
    deepAll(document).forEach(el => {
      const role = (el.getAttribute && el.getAttribute('role')) || '';
      if (el.tagName !== 'TABLE' && !/^(grid|table|treegrid)$/i.test(role)) return;
      if (!visible(el)) return;
      const rows = rowsOf(el);
      if (rows.length > best.length) best = rows;
    });
    return best;
  }

  const pageText = () => document.body.innerText || '';
  const unique = a => [...new Set(a)];
  const orderIds = () => unique(pageText().match(/\b\d{3}-\d{7}-\d{7}\b/g) || []);
  function asins() {
    const t = pageText();
    const a = [...t.matchAll(/ASIN:?\s*(B[0-9A-Z]{9})/gi)].map(m => m[1].toUpperCase());
    const b = (t.match(/\bB[0-9A-Z]{9}\b/g) || []).filter(x => /\d/.test(x));
    return unique(a.concat(b));
  }

  const panel = mk('div', 'position:fixed;left:12px;right:12px;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;max-width:420px;background:#111;color:#fff;border-radius:12px;padding:12px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
  panel.setAttribute('data-sk', '1');
  const status = mk('div', 'font-size:12px;color:#34c759;margin-top:8px;min-height:15px;line-height:1.4');

  function btn(label, fn, bg) {
    const b = mk('button', 'display:block;width:100%;text-align:left;padding:10px 12px;margin:6px 0 0;border:none;border-radius:8px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:14px', label);
    b.onclick = fn;
    return b;
  }

  async function out(text, what) {
    if (!text) { status.style.color = '#ff9f0a'; status.textContent = 'Nothing found for ' + what + ' on this page.'; return; }
    status.style.color = '#34c759';
    status.textContent = (await copy(text)) ? 'Copied ' + what + '.' : 'Copy failed (clipboard blocked).';
  }

  function render() {
    panel.textContent = '';
    const rows = bestTable();
    const ids = orderIds();
    const as = asins();
    panel.appendChild(mk('div', 'font-weight:600', 'Copy from this page'));
    panel.append(
      btn('Table (' + rows.length + ' rows) \u2192 spreadsheet', () => out(rows.map(r => r.join('\t')).join('\n'), 'the table'), '#0a84ff'),
      btn('Order IDs (' + ids.length + ')', () => out(ids.join('\n'), 'order IDs')),
      btn('ASINs (' + as.length + ')', () => out(as.join('\n'), 'ASINs')),
      btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30'),
      status,
      mk('div', 'font-size:11px;color:#8e8e93;margin-top:6px', 'Only rows loaded on screen are copied. Scroll to load more first.')
    );
  }

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#232f3e;color:#ff9900;font:700 11px -apple-system,sans-serif;opacity:.92;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'Tbl');
  fab.setAttribute('data-sk', '1');
  fab.title = 'Copy table, order IDs or ASINs';
  fab.onclick = () => { if (panel.style.display === 'none') { render(); panel.style.display = 'block'; } else panel.style.display = 'none'; };
  document.documentElement.append(panel, fab);
})();
