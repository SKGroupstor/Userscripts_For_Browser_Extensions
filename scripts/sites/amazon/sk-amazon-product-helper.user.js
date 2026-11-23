// ==UserScript==
// @name         SK Amazon Product Helper (.ca / .com)
// @namespace    skgroups
// @version      1.0
// @description  On Amazon.ca and Amazon.com product pages: shows ASIN, price, seller and stock; copies a spreadsheet row or a clean /dp/ link; jumps to the same ASIN on the other marketplace
// @match        *://www.amazon.ca/*
// @match        *://www.amazon.com/*
// @match        *://amazon.ca/*
// @match        *://amazon.com/*
// @noframes
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/sites/amazon/sk-amazon-product-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/sites/amazon/sk-amazon-product-helper.user.js
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  function asin() {
    const m = location.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/([A-Z0-9]{10})/i);
    if (m) return m[1].toUpperCase();
    const el = document.getElementById('ASIN') || document.querySelector('input[name="ASIN"], [data-asin]');
    const v = el && (el.value || el.getAttribute('data-asin'));
    return v && /^[A-Z0-9]{10}$/i.test(v) ? v.toUpperCase() : '';
  }

  const ASIN = asin();
  if (!ASIN || !document.getElementById('productTitle')) return; // product pages only

  const slot = (window.__skFab = (window.__skFab || 0) + 1);
  const isCA = /amazon\.ca$/i.test(location.hostname);
  const host = isCA ? 'www.amazon.ca' : 'www.amazon.com';
  const otherHost = isCA ? 'www.amazon.com' : 'www.amazon.ca';

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

  const txt = sel => { const e = document.querySelector(sel); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };

  function extract() {
    const price = txt('#corePrice_feature_div .a-price .a-offscreen') || txt('#apex_desktop .a-price .a-offscreen') || txt('.a-price .a-offscreen');
    return {
      asin: ASIN,
      title: txt('#productTitle'),
      brand: txt('#bylineInfo').replace(/^(Visit the|Brand:)\s*/i, '').replace(/\s*Store$/i, ''),
      price,
      seller: txt('#sellerProfileTriggerId') || txt('#merchant-info') || txt('[tabular-attribute-name="Sold by"] .tabular-buybox-text'),
      ships: txt('[tabular-attribute-name="Ships from"] .tabular-buybox-text'),
      availability: txt('#availability'),
      rating: (document.querySelector('#acrPopover') || {}).title || '',
      clean: 'https://' + host + '/dp/' + ASIN
    };
  }

  const panel = mk('div', 'position:fixed;left:12px;right:12px;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;max-width:420px;background:#111;color:#fff;border-radius:12px;padding:12px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
  panel.setAttribute('data-sk', '1');

  function row(label, value) {
    const r = mk('div', 'display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #2c2c2e');
    r.append(mk('div', 'width:72px;color:#aaa;flex:none', label), mk('div', 'flex:1;word-break:break-word', value || '\u2014'));
    return r;
  }

  function btn(label, fn, bg) {
    const b = mk('button', 'padding:8px 10px;margin:8px 6px 0 0;border:none;border-radius:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label);
    b.onclick = fn; return b;
  }

  function render() {
    const d = extract();
    panel.textContent = '';
    panel.append(row('ASIN', d.asin), row('Title', d.title.slice(0, 140)), row('Brand', d.brand), row('Price', d.price), row('Seller', d.seller), row('Ships', d.ships), row('Stock', d.availability));
    const msg = mk('div', 'font-size:12px;color:#34c759;margin-top:6px;min-height:14px');
    const done = ok => { msg.textContent = ok ? 'Copied' : 'Copy failed'; };
    const wrap = mk('div');
    wrap.append(
      btn('Copy row', async () => done(await copy([d.asin, d.title, d.brand, d.price, d.seller, d.availability, d.clean].map(v => String(v).replace(/[\t\r\n]+/g, ' ')).join('\t'))), '#0a84ff'),
      btn('Copy clean link', async () => done(await copy(d.clean))),
      btn('Copy ASIN', async () => done(await copy(d.asin))),
      btn('Open on ' + (isCA ? '.com' : '.ca'), () => { window.open('https://' + otherHost + '/dp/' + ASIN, '_blank'); }),
      btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30')
    );
    panel.append(wrap, msg);
  }

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#ff9900;color:#111;font:700 11px -apple-system,sans-serif;opacity:.9;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'ASIN');
  fab.setAttribute('data-sk', '1');
  fab.onclick = () => { if (panel.style.display === 'none') { render(); panel.style.display = 'block'; } else panel.style.display = 'none'; };
  document.documentElement.append(panel, fab);
})();
