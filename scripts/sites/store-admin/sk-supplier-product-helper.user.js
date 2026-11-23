// ==UserScript==
// @name         SK Supplier Product Helper (Amerex, HW, SPP)
// @namespace    skgroups
// @version      1.0
// @description  On product pages of amerex-fire.com, biz.amerex-fire.com, herbertwilliams.com and Safety Plus Pro: shows name / SKU / price / stock found on the page, and copies a spreadsheet row, Markdown, or the page's PDF links
// @match        *://amerex-fire.com/*
// @match        *://*.amerex-fire.com/*
// @match        *://herbertwilliams.com/*
// @match        *://*.herbertwilliams.com/*
// @match        *://safetypluspro.com/*
// @match        *://*.safetypluspro.com/*
// @noframes
// @grant        none
// ==/UserScript==

// NOTE: the Safety Plus Pro domain above is a best guess - edit the two @match lines if the real domain differs.

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

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const a = document.createElement('textarea');
      a.value = text; a.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(a); a.select();
      const ok = document.execCommand('copy'); a.remove(); return ok;
    }
  }

  function jsonLdProduct() {
    const nodes = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try {
        const data = JSON.parse(s.textContent);
        const walk = d => {
          if (!d) return;
          if (Array.isArray(d)) return d.forEach(walk);
          nodes.push(d);
          if (d['@graph']) walk(d['@graph']);
        };
        walk(data);
      } catch {}
    });
    return nodes.find(n => { const t = n['@type']; return t === 'Product' || (Array.isArray(t) && t.includes('Product')); }) || null;
  }

  function firstOffer(p) {
    if (!p || !p.offers) return {};
    const o = Array.isArray(p.offers) ? p.offers[0] : p.offers;
    return o || {};
  }

  function metaContent(sel) { const m = document.querySelector(sel); return m ? (m.getAttribute('content') || '').trim() : ''; }

  function extract() {
    const p = jsonLdProduct();
    const o = firstOffer(p);
    const text = (document.body.innerText || '').slice(0, 20000);

    let name = (p && p.name) || metaContent('meta[property="og:title"]') || ((document.querySelector('h1') || {}).textContent || '').trim() || document.title;

    let sku = (p && (p.sku || p.mpn)) || ((document.querySelector('.sku, [itemprop="sku"], .product-sku, .product_meta .sku') || {}).textContent || '').trim();
    if (!sku) {
      const m = text.match(/(?:SKU|Model(?:\s*(?:No\.?|Number|#))?|Part\s*(?:No\.?|Number|#)|Item\s*(?:No\.?|#))\s*[:#]?\s*([A-Z0-9][A-Z0-9\-\/\.]{2,})/i);
      if (m) sku = m[1];
    }

    let price = o.price || o.lowPrice || metaContent('meta[property="product:price:amount"], meta[property="og:price:amount"]');
    if (!price) {
      const pe = document.querySelector('.price .amount, .price, [itemprop="price"], .product-price');
      if (pe) { const m = pe.textContent.match(/\d[\d,]*\.?\d*/); if (m) price = m[0].replace(/,/g, ''); }
    }
    const currency = o.priceCurrency || metaContent('meta[property="product:price:currency"], meta[property="og:price:currency"]') || '';
    let availability = (o.availability || '').toString().split('/').pop();
    if (!availability) {
      const st = document.querySelector('.stock, .availability, [itemprop="availability"]');
      if (st) availability = st.textContent.replace(/\s+/g, ' ').trim();
    }
    const brand = p && p.brand ? (p.brand.name || p.brand) : '';

    return { name: String(name).trim(), sku: String(sku || '').trim(), brand: String(brand || '').trim(), price: String(price || '').trim(), currency, availability: String(availability || '').trim(), url: location.href.split('#')[0], hasSchema: !!p };
  }

  function pdfLinks() {
    const out = new Set();
    document.querySelectorAll('a[href]').forEach(a => { if (/\.pdf(?:[?#]|$)/i.test(a.getAttribute('href'))) { try { out.add(new URL(a.getAttribute('href'), location.href).href); } catch {} } });
    return [...out];
  }

  const panel = mk('div', 'position:fixed;left:12px;right:12px;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;max-width:420px;background:#111;color:#fff;border-radius:12px;padding:12px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
  panel.setAttribute('data-sk', '1');

  function row(label, value) {
    const r = mk('div', 'display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #2c2c2e');
    r.append(mk('div', 'width:80px;color:#aaa;flex:none', label), mk('div', 'flex:1;word-break:break-word', value || '\u2014'));
    return r;
  }

  function btn(label, fn, bg) {
    const b = mk('button', 'padding:8px 10px;margin:8px 6px 0 0;border:none;border-radius:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label);
    b.onclick = fn; return b;
  }

  function render() {
    const d = extract();
    const pdfs = pdfLinks();
    panel.textContent = '';
    panel.append(row('Name', d.name), row('SKU', d.sku), row('Brand', d.brand), row('Price', d.price ? (d.currency ? d.currency + ' ' : '') + d.price : ''), row('Stock', d.availability), row('PDFs', String(pdfs.length)));
    if (!d.hasSchema) panel.appendChild(mk('div', 'font-size:11px;color:#ff9f0a;margin-top:6px', 'No structured product data on this page \u2014 values are best-guess from the page text. Check before pasting.'));
    const msg = mk('div', 'font-size:12px;color:#34c759;margin-top:6px;min-height:14px');
    const done = ok => { msg.textContent = ok ? 'Copied' : 'Copy failed'; };
    const wrap = mk('div');
    wrap.append(
      btn('Copy row', async () => done(await copy([d.name, d.sku, d.brand, d.price, d.currency, d.availability, d.url].map(v => String(v).replace(/[\t\r\n]+/g, ' ')).join('\t'))), '#0a84ff'),
      btn('Copy Markdown', async () => done(await copy('[' + d.name.replace(/[\[\]]/g, '') + '](' + d.url + ')' + (d.sku ? ' \u2014 SKU ' + d.sku : '') + (d.price ? ' \u2014 ' + (d.currency || '$') + d.price : ''))))
    );
    if (pdfs.length) wrap.appendChild(btn('Copy PDF links', async () => done(await copy(pdfs.join('\n')))));
    wrap.appendChild(btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30'));
    panel.append(wrap, msg);
  }

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#c8102e;color:#fff;font:700 12px -apple-system,sans-serif;opacity:.85;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'SKU');
  fab.setAttribute('data-sk', '1');
  fab.onclick = () => { if (panel.style.display === 'none') { render(); panel.style.display = 'block'; } else panel.style.display = 'none'; };
  document.documentElement.append(panel, fab);
})();
