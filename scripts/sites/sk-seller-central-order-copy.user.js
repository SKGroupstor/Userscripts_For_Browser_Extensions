// ==UserScript==
// @name         SK Seller Central Order Copy
// @namespace    skgroups
// @version      1.3
// @description  On a Seller Central order details page: one-tap copy of the buyer's name, address, phone and item(s), plus Copy All, a spreadsheet row, and Send to Sheet (adds one row per item to your own Google Sheet via a Google Form you connect once).
// @match        *://sellercentral.amazon.ca/orders-v3/order/*
// @match        *://sellercentral.amazon.com/orders-v3/order/*
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      docs.google.com
// ==/UserScript==

// HOW IT WORKS
//  Tap the blue "Ship" button (bottom left). The panel shows what was found in the "Ship to" box and the
//  order's item table, with a Copy button beside each. "Copy all" gives a block ready for a shipping form
//  or email. "Copy row" gives tab-separated columns for pasting into a spreadsheet.
//  The script only reads the page. Nothing is sent anywhere unless you tap Send to Sheet, and then
//  only to the Google Form you connected.
//
// SEND TO SHEET - one-time setup
//  1. Create a Google Form with SHORT ANSWER questions titled exactly (skip any you don't want, but keep Order ID):
//     Order ID, Order Date, Ship By, Name, Address 1, Address 2, City, Province, Postal, Country, Phone,
//     Item, SKU, ASIN, Qty, Marketplace, URL
//  2. In the Form: Responses -> Link to Sheets. (Turn off "Collect email addresses" and "Limit to 1 response";
//     publish it so anyone with the link can respond.)
//  3. Form menu (3 dots) -> Get pre-filled link. Type each question's own title as its answer, click Get link, copy it.
//  4. Ship panel -> "Sheet setup" -> paste the link. (Stored in this browser; repeat once per browser profile.)
//
//  If you want the connection built in for all your devices, put your own form values in DEFAULT_TARGET below
//  in YOUR private copy of this script. Don't publish those values: anyone who has the form link can add rows to your sheet.
//
// v1.3: the built-in connection was removed from the shared version of this script.

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const slot = (W.__skFab = (W.__skFab || 0) + 1);

  const K_TARGET = 'sk_order_sheet_target';
  const K_SENT = 'sk_order_sheet_sent';

  // Optional built-in connection for YOUR PRIVATE COPY only. Format:
  //   { url: 'https://docs.google.com/forms/d/e/<FORM_ID>/formResponse',
  //     map: { orderId: 'entry.123', orderDate: 'entry.456', ... } }
  const DEFAULT_TARGET = null;

  const store = {
    get(k, d) {
      try {
        const raw = typeof GM_getValue === 'function' ? GM_getValue(k) : localStorage.getItem(k);
        return raw == null ? d : JSON.parse(raw);
      } catch { return d; }
    },
    set(k, v) {
      try {
        const s = JSON.stringify(v);
        if (typeof GM_setValue === 'function') GM_setValue(k, s); else localStorage.setItem(k, s);
      } catch {}
    }
  };

  const getTarget = () => store.get(K_TARGET, null) || DEFAULT_TARGET;

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

  function post(url, body) {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise(res => GM_xmlhttpRequest({
        method: 'POST', url, data: body, headers, timeout: 20000,
        onload: r => res(r.status >= 200 && r.status < 400),
        onerror: () => res(false),
        ontimeout: () => res(false)
      }));
    }
    return fetch(url, { method: 'POST', mode: 'no-cors', headers, body }).then(() => true, () => false);
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

  function isoDate(str) {
    const m = String(str || '').match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/);
    if (!m) return '';
    const d = new Date(m[1] + ' ' + m[2] + ', ' + m[3]);
    return isNaN(d) ? '' : d.toLocaleDateString('en-CA'); // YYYY-MM-DD
  }

  // ---------- Google Sheet (via Google Form) ----------
  const FIELD_BY_TITLE = {
    'order id': 'orderId', 'order date': 'orderDate', 'ship by': 'shipBy', 'name': 'name',
    'address 1': 'address1', 'address 2': 'address2', 'city': 'city', 'province': 'province',
    'postal': 'postal', 'country': 'country', 'phone': 'phone', 'item': 'item', 'sku': 'sku',
    'asin': 'asin', 'qty': 'qty', 'marketplace': 'marketplace', 'url': 'url'
  };

  function parseFormLink(link) {
    const u = new URL(String(link).trim());
    if (u.hostname !== 'docs.google.com' || !/\/forms\//.test(u.pathname)) throw new Error('Not a Google Forms link. Use the full docs.google.com link (not forms.gle).');
    const map = {};
    u.searchParams.forEach((v, k) => {
      if (/^entry\.\d+$/.test(k)) { const f = FIELD_BY_TITLE[v.trim().toLowerCase()]; if (f) map[f] = k; }
    });
    if (!map.orderId) throw new Error('Could not find the "Order ID" question. In the pre-filled link, type each question\u2019s own title as its answer.');
    return { url: u.origin + u.pathname.replace(/\/viewform.*$/, '/formResponse'), map };
  }

  // One row per item, with the shipping details repeated
  function buildRows() {
    const s = getShipTo();
    if (!s) return null;
    const text = document.body.innerText || '';
    const orderDate = isoDate((text.match(/Purchase\s*date:?\s*([^\n]+)/i) || [])[1]);
    const shipBy = isoDate((text.match(/Ship by:?\s*([^\n]+)/i) || [])[1]);
    const marketplace = (text.match(/Sales channel:?\s*(Amazon\.[a-z.]+)/i) || [])[1] || (/\.ca$/i.test(location.hostname) ? 'Amazon.ca' : 'Amazon.com');
    const items = getItems();
    const base = {
      orderId: getOrderId(), orderDate, shipBy, name: s.name,
      address1: s.street[0] || '', address2: s.street.slice(1).join(' '),
      city: s.city, province: s.prov, postal: s.postal, country: s.country, phone: s.phone,
      marketplace, url: location.href.split('#')[0]
    };
    const list = items.length ? items : [{ name: '', asin: '', sku: '', qty: '' }];
    return list.map(i => Object.assign({}, base, { item: i.name, sku: i.sku, asin: i.asin, qty: i.qty }));
  }

  async function sendToSheet(say) {
    const target = getTarget();
    if (!target) return say('No Google Sheet connected yet. Tap "Sheet setup" and paste your Google Form\u2019s pre-filled link (steps are at the top of this script).', true);
    const rows = buildRows();
    if (!rows) return say('Couldn\u2019t read the order. Wait for the page to load and try again.', true);
    const id = rows[0].orderId;
    const sent = store.get(K_SENT, {});
    if (id && sent[id] && !confirm('Order ' + id + ' was already sent on ' + sent[id] + ' (from this browser). Send it again (adds duplicate rows)?')) return say('Cancelled. Not sent.', true);

    let ok = 0;
    for (const r of rows) {
      const p = new URLSearchParams();
      Object.keys(target.map).forEach(f => p.set(target.map[f], r[f] == null ? '' : r[f]));
      if (await post(target.url, p.toString())) ok++;
    }
    if (ok === rows.length) {
      if (id) { sent[id] = new Date().toLocaleDateString('en-CA'); store.set(K_SENT, sent); }
      say('Sent ' + ok + ' row' + (ok > 1 ? 's' : '') + ' to your Google Sheet \u2713');
    } else say('Sent ' + ok + ' of ' + rows.length + ' rows. Some failed - check your connection and try again.', true);
  }

  function sheetSetup(say) {
    const link = prompt('Paste your Google Form\u2019s full pre-filled link (docs.google.com/forms/...). Setup steps are at the top of this script.');
    if (!link) return;
    try { store.set(K_TARGET, parseFormLink(link)); say('Google Sheet connected for this browser. Tap Send to Sheet on an order.'); }
    catch (e) { say(e.message, true); }
  }

  // ---------- UI ----------
  const panel = mk('div', 'position:fixed;left:12px;right:12px;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;max-width:440px;max-height:75vh;overflow-y:auto;background:#111;color:#fff;border-radius:12px;padding:12px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
  panel.setAttribute('data-sk', '1');

  function btn(label, fn, bg) {
    const b = mk('button', 'padding:7px 10px;margin:4px 6px 0 0;border:none;border-radius:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label);
    b.onclick = fn;
    return b;
  }

  const status = mk('div', 'font-size:12px;color:#34c759;margin-top:8px;min-height:15px;line-height:1.4');
  const say = (m, warn) => { status.style.color = warn ? '#ff9f0a' : '#34c759'; status.textContent = m; };
  async function doCopy(text, what) {
    if (!text) return say('Nothing to copy for ' + what + '.', true);
    say((await copy(text)) ? 'Copied ' + what + '.' : 'Copy failed (clipboard blocked).', false);
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
        const cols = [s.name, s.street[0] || '', s.street.slice(1).join(' '), s.city, s.prov, s.postal, s.country, s.phone,
          items.map(i => i.name).join(' | '), items.map(i => i.sku).join(' | '), items.map(i => i.qty).join(' | '), orderId];
        doCopy(cols.map(c => String(c || '').replace(/[\t\r\n]+/g, ' ')).join('\t'), 'spreadsheet row');
      }, '#0a84ff'));
      actions.appendChild(btn('Send to Sheet', () => sendToSheet(say), '#ff9500'));
    }
    actions.appendChild(btn('Sheet setup', () => sheetSetup(say)));
    actions.appendChild(btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30'));
    const connected = !!getTarget();
    panel.append(actions, status);
    panel.appendChild(mk('div', 'font-size:11px;color:#8e8e93;margin-top:6px', 'Google Sheet: ' + (connected ? 'connected' : 'not connected (tap Sheet setup)') + '. Copy row columns: Name, Address 1, Address 2, City, Province, Postal, Country, Phone, Item, SKU, Qty, Order ID.'));
  }

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#0a84ff;color:#fff;font:700 11px -apple-system,sans-serif;opacity:.92;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'Ship');
  fab.setAttribute('data-sk', '1');
  fab.title = 'Copy buyer name, address, phone and item, or send to your Google Sheet';
  fab.onclick = () => { if (panel.style.display === 'none') { render(); panel.style.display = 'block'; } else panel.style.display = 'none'; };

  document.documentElement.append(panel, fab);
})();
