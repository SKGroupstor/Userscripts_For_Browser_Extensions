// ==UserScript==
// @name         SK Seller Central Order Copy
// @namespace    skgroups
// @version      1.0
// @description  On a Seller Central order details page: one-tap copy of the buyer's name, address, phone and item(s), plus Copy All and a spreadsheet row. Read-only; everything stays in your browser.
// @match        *://sellercentral.amazon.ca/orders-v3/order/*
// @match        *://sellercentral.amazon.com/orders-v3/order/*
// @noframes
// @grant        none
// ==/UserScript==

// HOW IT WORKS
//  Tap the blue "Ship" button (bottom left). The panel shows what was found in the "Ship to" box and the
//  order's item table, with a Copy button beside each. "Copy all" gives a block ready for a shipping form
//  or email. "Copy row" gives tab-separated columns for pasting into a spreadsheet.
//  The script only reads the page; it sends nothing anywhere and changes nothing on the order.
//  If a field shows a dash, Seller Central's page layout differs from what the script expects.

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const slot = (window.__skFab = (window.__skFab || 0) + 1);

  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const linesOf = el => (el.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);

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

  // ---------- Ship to box ----------
  const STOP = /^(contact buyer|phone|address type|see all|print packing slip|cancel order|buyer)/i;

  function findShipCard() {
    const heads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,span,div,strong,b,label,p')]
      .filter(e => e.children.length === 0 && /^ship to:?$/i.test(clean(e.textContent)));
    for (const h of heads) {
      let p = h.parentElement;
      for (let i = 0; i < 6 && p; i++, p = p.parentElement) {
        if (/contact buyer|address type|phone:/i.test(p.innerText || '')) return p;
      }
    }
    return null;
  }

  function getShipTo() {
    const card = findShipCard();
    if (!card) return null;
    const all = linesOf(card);
    const start = all.findIndex(l => /^ship to:?$/i.test(l));
    const addr = [];
    for (let i = start + 1; i < all.length; i++) {
      if (STOP.test(all[i])) break;
      addr.push(all[i]);
    }

    const pm = clean(card.innerText).match(/phone:?\s*(\+?[\d(][\d\s().\-]{6,}\d)/i);
    const phone = pm ? clean(pm[1]) : '';

    const name = addr[0] || '';
    const rest = addr.slice(1);
    let country = '';
    if (rest.length && /^(canada|united states( of america)?|usa|us)$/i.test(rest[rest.length - 1])) country = rest.pop();

    let city = '', prov = '', postal = '';
    let street = rest.slice();
    const idx = rest.findIndex(l => /[A-Z]\d[A-Z]\s?\d[A-Z]\d\s*$/i.test(l) || /\b\d{5}(-\d{4})?\s*$/.test(l));
    if (idx >= 0) {
      const m = rest[idx].match(/^(.*?),\s*(.+?)\s+([A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(?:-\d{4})?)\s*$/i);
      if (m) { city = m[1]; prov = m[2]; postal = m[3].toUpperCase(); street = rest.slice(0, idx); }
    }

    return {
      name,
      address: rest.concat(country ? [country] : []).join('\n'),
      street, city, prov, postal, country, phone
    };
  }

  // ---------- Items ----------
  function getItems() {
    const items = [];
    document.querySelectorAll('tr').forEach(tr => {
      const t = tr.innerText || '';
      if (!/ASIN:/i.test(t) || tr.querySelector('tr')) return;

      const link = [...tr.querySelectorAll('a')].find(a => {
        const x = clean(a.textContent);
        return x.length > 3 && !/^(image|buy shipping|confirm)/i.test(x);
      });
      const table = tr.closest('table');
      const headRow = table && (table.querySelector('thead tr') || table.querySelector('tr'));
      const heads = headRow ? [...headRow.children].map(h => clean(h.textContent)) : [];
      const cells = [...tr.children];
      const qIdx = heads.findIndex(h => /^quantity$/i.test(h));
      let qty = qIdx >= 0 && cells[qIdx] ? clean(cells[qIdx].textContent) : '';
      if (!/^\d+$/.test(qty)) {
        const c = cells.find(x => /^\d{1,3}$/.test(clean(x.textContent)));
        qty = c ? clean(c.textContent) : '';
      }
      items.push({
        name: link ? clean(link.textContent) : '',
        asin: (t.match(/ASIN:\s*([A-Z0-9]{10})/i) || [])[1] || '',
        sku: (t.match(/SKU:\s*(\S+)/i) || [])[1] || '',
        qty
      });
    });

    if (!items.length) {
      // Fallback for non-table layouts: pull ASIN/SKU pairs from the page text
      const body = document.body.innerText || '';
      const asins = [...body.matchAll(/ASIN:\s*([A-Z0-9]{10})/gi)].map(m => m[1]);
      const skus = [...body.matchAll(/SKU:\s*(\S+)/gi)].map(m => m[1]);
      asins.forEach((a, i) => items.push({ name: '', asin: a, sku: skus[i] || '', qty: '' }));
    }
    return items;
  }

  const itemLine = i => (i.qty ? i.qty + ' x ' : '') + (i.name || '(name not found)') + (i.sku ? ' [SKU ' + i.sku + ']' : '');

  function getOrderId() {
    const m = (document.body.innerText || '').match(/Order ID:\s*(\d{3}-\d{7}-\d{7})/i);
    return m ? m[1] : '';
  }

  // ---------- UI ----------
  const panel = mk('div', 'position:fixed;left:12px;right:12px;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;max-width:440px;max-height:75vh;overflow-y:auto;background:#111;color:#fff;border-radius:12px;padding:12px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
  panel.setAttribute('data-sk', '1');

  function btn(label, fn, bg) {
    const b = mk('button', 'padding:7px 10px;margin:4px 6px 0 0;border:none;border-radius:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label);
    b.onclick = fn;
    return b;
  }

  const status = mk('div', 'font-size:12px;color:#34c759;margin-top:8px;min-height:15px');
  const say = m => { status.textContent = m; };
  async function doCopy(text, what) {
    if (!text) return say('Nothing to copy for ' + what + '.');
    say((await copy(text)) ? 'Copied ' + what + '.' : 'Copy failed (clipboard blocked).');
  }

  function row(label, value, actions) {
    const r = mk('div', 'padding:6px 0;border-bottom:1px solid #2c2c2e');
    r.appendChild(mk('div', 'font-size:11px;color:#aaa', label));
    r.appendChild(mk('div', 'white-space:pre-line;word-break:break-word;margin:2px 0', value || '\u2014'));
    const a = mk('div');
    actions.forEach(x => a.appendChild(btn(x[0], x[1])));
    r.appendChild(a);
    return r;
  }

  function render() {
    panel.textContent = '';
    const s = getShipTo();
    const items = getItems();
    const orderId = getOrderId();

    if (!s) {
      panel.appendChild(mk('div', 'color:#ff9f0a;margin-bottom:6px', 'Couldn\u2019t find the "Ship to" box on this page.'));
      panel.appendChild(mk('div', 'font-size:12px;color:#aaa', 'Open the order details page (orders-v3/order/\u2026) and wait for it to finish loading, then tap Ship again.'));
    } else {
      panel.appendChild(row('Name', s.name, [['Copy', () => doCopy(s.name, 'name')]]));
      panel.appendChild(row('Address', s.address, [['Copy', () => doCopy(s.address, 'address')],
        ['One line', () => doCopy(s.address.replace(/\n/g, ', '), 'address (one line)')]]));
      panel.appendChild(row('Phone', s.phone, [['Copy', () => doCopy(s.phone, 'phone')],
        ['Digits only', () => doCopy(s.phone.replace(/\D/g, ''), 'phone (digits)')]]));
    }

    const itemText = items.map(itemLine).join('\n');
    panel.appendChild(row('Item' + (items.length > 1 ? 's' : ''), itemText, [['Copy', () => doCopy(itemText, 'item')]]));

    const actions = mk('div', 'margin-top:6px');
    if (s) {
      actions.appendChild(btn('Copy all', () => {
        const parts = [s.name, s.address, s.phone ? 'Phone: ' + s.phone : ''].filter(Boolean).join('\n');
        doCopy(parts + (itemText ? '\n\nItem: ' + itemText.replace(/\n/g, '\nItem: ') : '') + (orderId ? '\nOrder ID: ' + orderId : ''), 'everything');
      }, '#34c759'));
      actions.appendChild(btn('Copy row', () => {
        const first = items[0] || {};
        const cols = [s.name, s.street[0] || '', s.street.slice(1).join(' '), s.city, s.prov, s.postal, s.country, s.phone,
          items.map(i => i.name).join(' | '), items.map(i => i.sku).join(' | '), items.map(i => i.qty).join(' | '), orderId];
        doCopy(cols.map(c => String(c || '').replace(/[\t\r\n]+/g, ' ')).join('\t'), 'spreadsheet row');
        void first;
      }, '#0a84ff'));
    }
    actions.appendChild(btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30'));
    panel.append(actions, status);
    panel.appendChild(mk('div', 'font-size:11px;color:#8e8e93;margin-top:6px', 'Copy row columns: Name, Address 1, Address 2, City, Province, Postal, Country, Phone, Item, SKU, Qty, Order ID.'));
  }

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#0a84ff;color:#fff;font:700 11px -apple-system,sans-serif;opacity:.92;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'Ship');
  fab.setAttribute('data-sk', '1');
  fab.title = 'Copy buyer name, address, phone and item';
  fab.onclick = () => { if (panel.style.display === 'none') { render(); panel.style.display = 'block'; } else panel.style.display = 'none'; };

  document.documentElement.append(panel, fab);
})();
