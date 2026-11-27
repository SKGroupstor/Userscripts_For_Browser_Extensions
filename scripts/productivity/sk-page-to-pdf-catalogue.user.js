// ==UserScript==
// @name         SK Page to PDF Catalogue
// @namespace    skgroups
// @version      1.1
// @description  Scrapes the products on any store/listing page (optionally following "next page" links or scrolling) and builds a printable PDF catalogue or net sheet with images, SKU and prices. Optional price adjustment for net pricing. Shows a "PDF" button on pages that look like product listings.
// @match        *://*/*
// @noframes
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/productivity/sk-page-to-pdf-catalogue.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/productivity/sk-page-to-pdf-catalogue.user.js
// ==/UserScript==

// HOW IT WORKS
//  1. Open any page that lists products (a shop category, search results, a distributor price page...).
//  2. A blue "PDF" button appears bottom-right when the page looks like a product list.
//     On other pages press Alt+Shift+P, or use the Violentmonkey menu item "Catalogue PDF".
//  3. Tap it. Tick which products to include, pick Catalogue (cards) or Net sheet (table).
//     "Scan all pages" follows the site's Next link (up to the page limit you set).
//     "Scroll first" is for endless-scroll pages: it scrolls to the bottom to load everything.
//  4. "Generate PDF" opens a clean print page. Choose "Save as PDF" (or a printer) in the print dialog.
//     If the print dialog doesn't appear by itself, tap the Print button at the top of that page.
//  Price adjust %: e.g. -20 adds a "Net price" column at 20% off the list price; 15 is a 15% markup.
//  The script only reads pages. Nothing is sent anywhere.
//  v1.1: button and panel sit on the bottom-right (the other SK scripts stack on the left).

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const K = 'sk_catalogue_settings';

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

  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function mk(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------- Scraping ----------
  const P = '(?:CA?\\$|C\\$|US?\\$|\\$|€|£)\\s?\\d[\\d,]*(?:\\.\\d{1,2})?(?:\\s?(?:CAD|USD))?';
  const PRICE_FULL = new RegExp('^(?:from\\s*|as low as\\s*|now\\s*|sale\\s*)?' + P + '(?:\\s*[–\\-]\\s*' + P + ')?$', 'i');
  const STRUCK = 'del,s,strike,[class*="old-price"],[class*="was-"],[class*="compare"],[class*="regular-price"]';
  const SKIP_AREA = 'header,nav,[class*="mini-cart"],[class*="cart-widget"],[id*="cart"],[class*="widget_shopping"]';

  function resolve(href, base) {
    try { return new URL(href, base).href; } catch { return ''; }
  }

  function moneyParts(text) {
    const m = String(text || '').match(/\d[\d,]*(?:\.\d+)?/);
    const num = m ? parseFloat(m[0].replace(/,/g, '')) : null;
    const sym = ((String(text || '').match(/CA?\$|C\$|US?\$|\$|€|£/) || ['$'])[0]);
    return { num: isNaN(num) ? null : num, sym };
  }

  function imgUrl(im, base) {
    if (!im) return '';
    let s = im.getAttribute('data-src') || im.getAttribute('data-lazy-src') || im.getAttribute('data-original') || '';
    if (!s) { const x = im.getAttribute('src') || ''; if (x && !/^data:/i.test(x)) s = x; }
    if (!s) { const ss = im.getAttribute('srcset') || im.getAttribute('data-srcset') || ''; s = (ss.split(',')[0] || '').trim().split(/\s+/)[0]; }
    return s ? resolve(s, base) : '';
  }

  function fromJsonLd(doc, base) {
    const out = [];
    const prod = o => {
      const offers = [].concat(o.offers || [])[0] || {};
      const price = offers.price != null ? offers.price : offers.lowPrice;
      const cur = offers.priceCurrency;
      let image = [].concat(o.image || [])[0];
      if (image && typeof image === 'object') image = image.url || '';
      const sym = cur === 'USD' || cur === 'CAD' || !cur ? '$' : cur + ' ';
      const n = price != null && price !== '' ? parseFloat(price) : null;
      return {
        name: clean(o.name), sku: clean(o.sku || o.mpn || ''), desc: clean(o.description || '').slice(0, 220),
        image: image ? resolve(image, base) : '', url: o.url ? resolve(o.url, base) : '',
        priceText: n != null && !isNaN(n) ? sym + n.toFixed(2) : '', num: n != null && !isNaN(n) ? n : null, sym: sym.trim() || '$'
      };
    };
    const walk = o => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) return o.forEach(walk);
      if ([].concat(o['@type'] || []).includes('Product') && o.name) out.push(prod(o));
      Object.values(o).forEach(v => { if (v && typeof v === 'object') walk(v); });
    };
    doc.querySelectorAll('script[type="application/ld+json"]').forEach(s => { try { walk(JSON.parse(s.textContent)); } catch {} });
    return out;
  }

  function fromDom(doc, base) {
    const body = doc.body;
    if (!body) return [];
    const priceEls = [];
    body.querySelectorAll('*').forEach(el => {
      if (el.children.length > 3) return;
      const t = clean(el.textContent);
      if (!t || t.length > 40 || !PRICE_FULL.test(t)) return;
      const par = el.parentElement;
      if (par && par !== body && PRICE_FULL.test(clean(par.textContent))) return; // keep the outermost price-only element
      priceEls.push(el);
    });

    const seen = new Set();
    const out = [];
    for (const pe of priceEls) {
      let c = pe;
      while (c && c !== body && !(c.querySelector('img') && c.querySelector('a[href]'))) c = c.parentElement;
      if (!c || c === body || seen.has(c)) continue;
      seen.add(c);
      if (c.closest(SKIP_AREA)) continue;
      const inside = priceEls.filter(x => c.contains(x));
      const live = inside.filter(x => !x.closest(STRUCK));
      if (live.length > 2) continue; // a wrapper around several products, not one card

      const priceEl = live[0] || inside[0];
      const priceText = clean(priceEl.textContent);
      const mp = moneyParts(priceText);

      const nameEl = c.querySelector('.woocommerce-loop-product__title,[class*="product-title"],[class*="product-name"],[class*="item-title"],[class*="item-name"],h1,h2,h3,h4,h5,h6');
      const im = c.querySelector('img');
      let name = nameEl ? clean(nameEl.textContent) : '';
      if (!name) {
        name = [...c.querySelectorAll('a[href]')].map(a => clean(a.textContent)).filter(x => x.length > 2 && !PRICE_FULL.test(x)).sort((a, b) => b.length - a.length)[0] || clean(im && (im.alt || im.title));
      }
      if (!name) continue;

      let a = (nameEl && (nameEl.closest('a') || nameEl.querySelector('a'))) || c.querySelector('a[href]:not([href^="#"]):not([href^="javascript"])');
      const url = a ? resolve(a.getAttribute('href'), base) : '';

      let sku = '';
      const skuEl = c.matches('[data-product_sku],[data-sku]') ? c : c.querySelector('[data-product_sku],[data-sku]');
      if (skuEl) sku = clean(skuEl.getAttribute('data-product_sku') || skuEl.getAttribute('data-sku'));
      if (!sku) { const m = clean(c.textContent).match(/(?:SKU|Item\s*#|Model|Part\s*(?:#|No\.?|Number))\s*[:#]?\s*([A-Za-z0-9][\w\-./]{1,30})/i); sku = m ? m[1] : ''; }

      let desc = '';
      const dEl = c.querySelector('[class*="desc"],[class*="excerpt"],p');
      if (dEl) { const d = clean(dEl.textContent); if (d && d !== name && !PRICE_FULL.test(d)) desc = d.slice(0, 220); }

      out.push({ name, sku, desc, image: imgUrl(im, base), url, priceText, num: mp.num, sym: mp.sym });
    }
    return out;
  }

  function scrape(doc, base) {
    const all = fromJsonLd(doc, base).concat(fromDom(doc, base));
    const seen = new Set();
    const out = [];
    for (const p of all) {
      const key = (p.name + '|' + (p.sku || '')).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  }

  function nextUrl(doc, base) {
    const cand = doc.querySelector('a[rel~="next"][href],link[rel~="next"][href],a.next[href],a.next-page[href],li.next a[href],.pagination-next a[href],a[aria-label*="next" i][href]');
    let a = cand;
    if (!a) a = [...doc.querySelectorAll('a[href]')].find(x => /^(next|next page|›|»|>|next\s*→)$/i.test(clean(x.textContent)));
    if (!a) return '';
    const u = resolve(a.getAttribute('href'), base);
    try { if (new URL(u).origin !== new URL(base).origin) return ''; } catch { return ''; }
    return u;
  }

  async function scrollAll(say) {
    let last = -1, same = 0;
    for (let i = 0; i < 40 && same < 3; i++) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      say('Scrolling to load everything… (' + (i + 1) + ')');
      await sleep(800);
      const h = document.documentElement.scrollHeight;
      if (h === last) same++; else { same = 0; last = h; }
    }
    window.scrollTo(0, 0);
  }

  async function crawl(maxPages, say) {
    const found = [];
    const seenKeys = new Set();
    const add = list => list.forEach(p => {
      const k = (p.name + '|' + (p.sku || '')).toLowerCase();
      if (!seenKeys.has(k)) { seenKeys.add(k); found.push(p); }
    });
    const visited = new Set([location.href.split('#')[0]]);
    add(scrape(document, location.href));
    let doc = document, base = location.href, page = 1;
    while (page < maxPages) {
      const nu = nextUrl(doc, base);
      if (!nu || visited.has(nu.split('#')[0])) break;
      visited.add(nu.split('#')[0]);
      say('Reading page ' + (page + 1) + '… (' + found.length + ' products so far)');
      try {
        const res = await fetch(nu, { credentials: 'include' });
        if (!res.ok) break;
        doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        base = nu;
        const before = found.length;
        add(scrape(doc, base));
        if (found.length === before) break; // nothing new: stop
      } catch { break; }
      page++;
      await sleep(350);
    }
    return found;
  }

  // ---------- Output ----------
  function buildHtml(items, o) {
    const adj = Number(o.adj) || 0;
    const net = adj !== 0;
    const mult = 1 + adj / 100;
    const money = (p, m) => p.num == null ? esc(p.priceText || '') : esc(p.sym + (p.num * m).toFixed(2));
    const title = o.title || 'Catalogue';
    const date = new Date().toLocaleDateString('en-CA');
    let host = '';
    try { host = new URL(o.source).hostname; } catch {}

    const head = '<div class="head"><div><h1>' + esc(title) + '</h1>' + (o.company ? '<div class="co">' + esc(o.company) + '</div>' : '') +
      '</div><div class="meta">' + esc(host) + '<br>' + date + ' &middot; ' + items.length + ' items</div></div>';

    let body = '';
    if (o.layout === 'netsheet') {
      const cols = ['#'];
      if (o.img) cols.push('');
      cols.push('Item');
      if (o.sku) cols.push('SKU');
      if (o.desc) cols.push('Description');
      cols.push(net ? 'List price' : 'Price');
      if (net) cols.push('Net price');
      if (o.link) cols.push('Link');
      body = '<table><thead><tr>' + cols.map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' +
        items.map((p, i) => '<tr><td class="n">' + (i + 1) + '</td>' +
          (o.img ? '<td class="im">' + (p.image ? '<img src="' + esc(p.image) + '">' : '') + '</td>' : '') +
          '<td>' + esc(p.name) + '</td>' +
          (o.sku ? '<td class="sku">' + esc(p.sku) + '</td>' : '') +
          (o.desc ? '<td class="d">' + esc(p.desc) + '</td>' : '') +
          '<td class="pr">' + money(p, 1) + '</td>' +
          (net ? '<td class="pr net">' + money(p, mult) + '</td>' : '') +
          (o.link ? '<td>' + (p.url ? '<a href="' + esc(p.url) + '">view</a>' : '') + '</td>' : '') +
          '</tr>').join('') + '</tbody></table>';
    } else {
      body = '<div class="grid">' + items.map(p => '<div class="card">' +
        (o.img ? '<div class="ph">' + (p.image ? '<img src="' + esc(p.image) + '">' : '') + '</div>' : '') +
        '<div class="nm">' + esc(p.name) + '</div>' +
        (o.sku && p.sku ? '<div class="sku">SKU: ' + esc(p.sku) + '</div>' : '') +
        (o.desc && p.desc ? '<div class="d">' + esc(p.desc) + '</div>' : '') +
        '<div class="pr">' + (net ? '<span class="was">' + money(p, 1) + '</span> <b>' + money(p, mult) + '</b>' : '<b>' + money(p, 1) + '</b>') + '</div>' +
        (o.link && p.url ? '<div class="lk"><a href="' + esc(p.url) + '">' + esc(p.url.replace(/^https?:\/\//, '').slice(0, 60)) + '</a></div>' : '') +
        '</div>').join('') + '</div>';
    }

    const css = '@page{size:letter;margin:12mm}*{box-sizing:border-box}body{font:12px/1.35 -apple-system,Segoe UI,Arial,sans-serif;color:#111;margin:0;padding:14px}' +
      '.bar{position:sticky;top:0;background:#0a84ff;color:#fff;padding:8px 12px;margin:-14px -14px 12px;display:flex;gap:10px;align-items:center}.bar button{padding:6px 14px;border:0;border-radius:6px;font-size:14px}' +
      '.head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:10px}h1{margin:0;font-size:22px}.co{color:#444}.meta{text-align:right;color:#555;font-size:11px}' +
      '.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.card{border:1px solid #ccc;border-radius:6px;padding:8px;break-inside:avoid;page-break-inside:avoid}' +
      '.ph{height:120px;display:flex;align-items:center;justify-content:center;margin-bottom:6px}.ph img{max-width:100%;max-height:120px;object-fit:contain}' +
      '.nm{font-weight:600}.sku{color:#555;font-size:11px}.d{color:#444;font-size:11px;margin-top:3px}.pr{margin-top:4px;font-size:13px}.was{text-decoration:line-through;color:#777}.lk{font-size:9px;word-break:break-all}.lk a{color:#555}' +
      'table{width:100%;border-collapse:collapse}thead{display:table-header-group}th{background:#eee;text-align:left;padding:5px;border-bottom:2px solid #111;font-size:11px}td{padding:4px 5px;border-bottom:1px solid #ddd;vertical-align:middle}tr{break-inside:avoid;page-break-inside:avoid}' +
      '.n{color:#888;width:24px}.im{width:46px}.im img{max-width:42px;max-height:42px;display:block}.pr{text-align:right;white-space:nowrap}.net{font-weight:700}.sku{white-space:nowrap}' +
      '.foot{margin-top:12px;font-size:10px;color:#666;border-top:1px solid #ccc;padding-top:6px}@media print{.bar{display:none}body{padding:0}}';

    const js = 'function go(){window.print()}window.addEventListener("load",function(){var im=[].slice.call(document.images);' +
      'Promise.race([Promise.all(im.map(function(i){return i.complete?1:new Promise(function(r){i.onload=i.onerror=r})})),new Promise(function(r){setTimeout(r,7000)})]).then(function(){setTimeout(go,300)})});';

    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title><style>' + css + '</style></head><body>' +
      '<div class="bar"><button onclick="go()">Print / Save as PDF</button><span>Pick "Save as PDF" as the destination.</span></div>' +
      head + body + '<div class="foot">Prices subject to change without notice. Source: ' + esc(o.source) + ' &middot; ' + date + '</div>' +
      '<script>' + js + '<\/script></body></html>';
  }

  function openOutput(html, name) {
    const w = window.open('', '_blank');
    if (w && w.document) {
      w.document.open(); w.document.write(html); w.document.close();
      return true;
    }
    return false;
  }

  function downloadHtml(html, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = (name || 'catalogue').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.html';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- UI ----------
  const st = Object.assign({ layout: 'catalogue', company: '', adj: 0, img: true, sku: true, desc: false, link: false, pages: 1, scroll: false }, store.get(K, {}));
  let products = [];
  let uiReady = false, panel, fab, listBox, status;

  const say = (m, warn) => { if (!status) return; status.style.color = warn ? '#ff9f0a' : '#34c759'; status.textContent = m; };
  const save = () => store.set(K, st);

  function btn(label, fn, bg) {
    const b = mk('button', 'padding:7px 10px;margin:4px 6px 0 0;border:none;border-radius:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label);
    b.onclick = fn;
    return b;
  }
  function field(label, input) {
    const r = mk('label', 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin:5px 0;font-size:12px;color:#ddd');
    r.appendChild(mk('span', '', label));
    r.appendChild(input);
    return r;
  }
  const inputCss = 'background:#2c2c2e;color:#fff;border:1px solid #444;border-radius:6px;padding:5px 7px;font-size:13px;min-width:0;max-width:62%';
  function textIn(key, ph, type) {
    const i = mk('input', inputCss);
    i.type = type || 'text'; i.placeholder = ph || ''; i.value = st[key];
    i.onchange = () => { st[key] = type === 'number' ? Number(i.value) || 0 : i.value; save(); };
    return i;
  }
  function check(key, label) {
    const l = mk('label', 'display:inline-flex;align-items:center;gap:4px;margin:4px 10px 0 0;font-size:12px;color:#ddd');
    const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!st[key];
    c.onchange = () => { st[key] = c.checked; save(); };
    l.append(c, document.createTextNode(label));
    return l;
  }

  function renderList() {
    listBox.textContent = '';
    if (!products.length) { listBox.appendChild(mk('div', 'color:#ff9f0a;padding:6px', 'No products found yet. Tap "Scan this page".')); return; }
    products.forEach(p => {
      const r = mk('label', 'display:flex;gap:6px;align-items:flex-start;padding:3px 0;border-bottom:1px solid #2c2c2e;font-size:12px');
      const c = document.createElement('input'); c.type = 'checkbox'; c.checked = p.on !== false;
      c.onchange = () => { p.on = c.checked; counter(); };
      r.append(c, mk('span', 'flex:1;word-break:break-word', p.name + (p.sku ? '  [' + p.sku + ']' : '')), mk('span', 'color:#aaa;white-space:nowrap', p.priceText || '—'));
      listBox.appendChild(r);
    });
    counter();
  }
  function counter() {
    const n = products.filter(p => p.on !== false).length;
    say(n + ' of ' + products.length + ' products selected.');
  }

  async function runScan(all) {
    products = [];
    say('Scanning…');
    try {
      if (st.scroll) await scrollAll(say);
      products = all && st.pages > 1 ? await crawl(st.pages, say) : scrape(document, location.href);
    } catch (e) { say('Scan failed: ' + e.message, true); }
    products.forEach(p => { p.on = true; });
    renderList();
  }

  function selected() { return products.filter(p => p.on !== false); }
  function opts() { return Object.assign({}, st, { title: titleIn.value || document.title, source: location.href.split('#')[0] }); }
  let titleIn;

  function generate() {
    const items = selected();
    if (!items.length) return say('Nothing selected. Scan the page first.', true);
    const html = buildHtml(items, opts());
    if (openOutput(html, opts().title)) say('Opened the print page. Choose Save as PDF.');
    else { downloadHtml(html, opts().title); say('Pop-up blocked, so the page was downloaded. Open it and tap Print.', true); }
  }

  function buildUI() {
    if (uiReady) return;
    uiReady = true;
    const slot = (W.__skFabR = (W.__skFabR || 0) + 1);
    panel = mk('div', 'position:fixed;left:12px;right:12px;margin-left:auto;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;max-width:460px;max-height:80vh;overflow-y:auto;background:#111;color:#fff;border-radius:12px;padding:12px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
    panel.setAttribute('data-sk', '1');
    panel.appendChild(mk('div', 'font-weight:700;margin-bottom:4px', 'Page to PDF catalogue'));

    titleIn = mk('input', inputCss); titleIn.value = document.title;
    panel.appendChild(field('Title', titleIn));
    panel.appendChild(field('Company line', textIn('company', 'optional')));

    const lay = document.createElement('select'); lay.style.cssText = inputCss;
    [['catalogue', 'Catalogue (cards)'], ['netsheet', 'Net sheet (table)']].forEach(o => { const op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; lay.appendChild(op); });
    lay.value = st.layout; lay.onchange = () => { st.layout = lay.value; save(); };
    panel.appendChild(field('Layout', lay));
    panel.appendChild(field('Price adjust %', textIn('adj', 'e.g. -20 = net', 'number')));
    panel.appendChild(field('Max pages to read', textIn('pages', '1', 'number')));

    const checks = mk('div');
    checks.append(check('img', 'Images'), check('sku', 'SKU'), check('desc', 'Description'), check('link', 'Link'), check('scroll', 'Scroll first (endless pages)'));
    panel.appendChild(checks);

    const scan = mk('div', 'margin-top:6px');
    scan.append(btn('Scan this page', () => runScan(false), '#0a84ff'), btn('Scan all pages', () => runScan(true), '#5856d6'));
    panel.appendChild(scan);

    listBox = mk('div', 'margin-top:8px;max-height:28vh;overflow-y:auto;background:#1c1c1e;border-radius:8px;padding:4px 8px');
    panel.appendChild(listBox);

    const acts = mk('div', 'margin-top:6px');
    acts.append(
      btn('Select all', () => { products.forEach(p => { p.on = true; }); renderList(); }),
      btn('None', () => { products.forEach(p => { p.on = false; }); renderList(); }),
      btn('Generate PDF', generate, '#34c759'),
      btn('Download .html', () => { const it = selected(); if (it.length) downloadHtml(buildHtml(it, opts()), opts().title); else say('Nothing selected.', true); }),
      btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30')
    );
    panel.appendChild(acts);
    status = mk('div', 'font-size:12px;color:#34c759;margin-top:8px;min-height:15px;line-height:1.4');
    panel.appendChild(status);

    fab = mk('button', 'position:fixed;right:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#0a84ff;color:#fff;font:700 11px -apple-system,sans-serif;opacity:.92;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'PDF');
    fab.setAttribute('data-sk', '1');
    fab.title = 'Make a PDF catalogue / net sheet from this page';
    fab.onclick = toggle;
    document.documentElement.append(panel, fab);
    renderList();
  }

  function toggle() {
    buildUI();
    if (panel.style.display === 'none') {
      panel.style.display = 'block';
      if (!products.length) runScan(false);
    } else panel.style.display = 'none';
  }

  // ---------- Start ----------
  function looksLikeListing() {
    if (document.querySelectorAll('img').length < 3) return false;
    try { return fromDom(document, location.href).length >= 3; } catch { return false; }
  }
  function autoShow() { if (!uiReady && looksLikeListing()) buildUI(); }

  if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('Catalogue PDF', toggle);
  document.addEventListener('keydown', e => { if (e.altKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) toggle(); });
  setTimeout(autoShow, 1500);
  setTimeout(autoShow, 5000);

  // exposed for testing
  W.__skCatalogue = { scrape, nextUrl, buildHtml, crawl, st };
})();
