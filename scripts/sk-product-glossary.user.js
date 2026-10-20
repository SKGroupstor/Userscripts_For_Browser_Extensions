// ==UserScript==
// @name         SK Product Glossary
// @namespace    skgroups
// @version      1.0
// @description  Save products you pick (name, model, price, date, URL) from any site into one searchable glossary, and sync them to a Google Sheet via a Google Form or a Zapier/Make webhook
// @match        *://*/*
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      docs.google.com
// @connect      *
// ==/UserScript==

// Storage uses GM_getValue/GM_setValue so the glossary is shared across ALL sites
// (plain localStorage is per-site). If your manager doesn't provide them, it falls back
// to localStorage and the glossary will only be visible on the site where it was saved.

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const slot = (W.__skFab = (W.__skFab || 0) + 1);
  const K_ITEMS = 'sk_gl_items';
  const K_TARGET = 'sk_gl_target';
  const FIELDS = ['name', 'model', 'price', 'currency', 'date', 'url', 'site'];

  // ---------- storage ----------
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

  let items = store.get(K_ITEMS, []);
  let target = store.get(K_TARGET, null);
  const persist = () => store.set(K_ITEMS, items);

  // ---------- helpers ----------
  const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const clean = s => String(s == null ? '' : s).replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  const num = s => { const m = String(s || '').replace(/\s/g, '').match(/\d[\d,]*\.?\d*/); return m ? m[0].replace(/,/g, '') : ''; };
  const curOf = s => {
    s = String(s || '');
    if (/CA\$|C\$|CAD/i.test(s)) return 'CAD';
    if (/US\$|USD/i.test(s)) return 'USD';
    return '';
  };

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

  // ---------- product extraction ----------
  function jsonLdProduct() {
    const nodes = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try {
        const walk = d => {
          if (!d) return;
          if (Array.isArray(d)) return d.forEach(walk);
          nodes.push(d);
          if (d['@graph']) walk(d['@graph']);
        };
        walk(JSON.parse(s.textContent));
      } catch {}
    });
    return nodes.find(n => { const t = n['@type']; return t === 'Product' || (Array.isArray(t) && t.includes('Product')); }) || null;
  }

  const txt = sel => { const e = document.querySelector(sel); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
  const meta = sel => { const m = document.querySelector(sel); return m ? (m.getAttribute('content') || '').trim() : ''; };

  function extract() {
    const out = { name: '', model: '', price: '', currency: '', date: today(), url: location.href.split('#')[0], site: location.hostname.replace(/^www\./, '') };

    // Amazon
    if (/(^|\.)amazon\.(ca|com)$/i.test(location.hostname) && document.getElementById('productTitle')) {
      out.name = txt('#productTitle');
      const p = txt('#corePrice_feature_div .a-price .a-offscreen') || txt('.a-price .a-offscreen');
      out.price = num(p);
      out.currency = curOf(p) || (/\.com$/i.test(location.hostname) ? 'USD' : 'CAD');
      let model = '';
      document.querySelectorAll('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr, #detailBullets_feature_div li').forEach(r => {
        if (model) return;
        const m = r.textContent.replace(/\s+/g, ' ').match(/(?:item model number|model number|model name)[\s:\u200e\u200f]*(.+)$/i);
        if (m) model = m[1].replace(/[\u200e\u200f]/g, '').trim();
      });
      if (!model) { const a = location.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i); if (a) model = a[1].toUpperCase(); }
      out.model = model;
      return out;
    }

    // Generic (JSON-LD first, then page text)
    const p = jsonLdProduct();
    const offer = p && p.offers ? (Array.isArray(p.offers) ? p.offers[0] : p.offers) : {};
    out.name = (p && p.name) || meta('meta[property="og:title"]') || txt('h1') || document.title;

    let model = p && (p.model && (p.model.name || p.model) || p.mpn || p.sku);
    if (!model) model = txt('.sku, [itemprop="sku"], [itemprop="mpn"], .product-sku, .product_meta .sku');
    if (!model) {
      const m = (document.body.innerText || '').slice(0, 20000).match(/(?:Model(?:\s*(?:No\.?|Number|#))?|Part\s*(?:No\.?|Number|#)|Item\s*(?:No\.?|#)|SKU|Mfr\.?\s*(?:No\.?|#))\s*[:#]?\s*([A-Z0-9][A-Z0-9\-\/\.]{2,})/i);
      if (m) model = m[1];
    }
    out.model = String(model || '');

    let price = offer.price || offer.lowPrice || meta('meta[property="product:price:amount"], meta[property="og:price:amount"]');
    let ptxt = '';
    if (!price) {
      const pe = document.querySelector('.price .amount, .price, [itemprop="price"], .product-price');
      if (pe) { ptxt = pe.textContent; price = num(ptxt); }
    }
    out.price = num(price);
    out.currency = offer.priceCurrency || meta('meta[property="product:price:currency"], meta[property="og:price:currency"]') || curOf(ptxt) || (/\.ca$/i.test(location.hostname) ? 'CAD' : '');
    out.name = clean(out.name);
    out.model = clean(out.model);
    return out;
  }

  // ---------- Google Sheet sync (Google Form or webhook) ----------
  function parseFormLink(link) {
    const u = new URL(String(link).trim());
    if (u.hostname !== 'docs.google.com' || !/\/forms\//.test(u.pathname)) throw new Error('Not a Google Forms link. Use the full docs.google.com link (not forms.gle).');
    const map = {};
    u.searchParams.forEach((v, k) => {
      if (/^entry\.\d+$/.test(k)) { const f = v.trim().toLowerCase(); if (FIELDS.includes(f)) map[f] = k; }
    });
    if (!map.name || !map.url) throw new Error('Could not find the Name and URL fields. In the pre-filled link, type exactly: Name, Model, Price, Currency, Date, URL, Site as the answers.');
    return { type: 'form', url: u.origin + u.pathname.replace(/\/viewform.*$/, '/formResponse'), map };
  }

  function bodyFor(item) {
    const p = new URLSearchParams();
    if (target.type === 'form') {
      Object.keys(target.map).forEach(f => p.set(target.map[f], item[f] == null ? '' : item[f]));
    } else {
      FIELDS.forEach(f => p.set(f, item[f] == null ? '' : item[f]));
    }
    return p.toString();
  }

  async function syncItem(item) {
    if (!target) return false;
    const ok = await post(target.url, bodyFor(item));
    if (ok) { item.synced = true; persist(); }
    return ok;
  }

  async function syncAll(say) {
    if (!target) { say('No Google Sheet connected yet. Open Setup.'); return; }
    const todo = items.filter(i => !i.synced).reverse();
    if (!todo.length) { say('Everything is already synced.'); return; }
    let ok = 0;
    for (let i = 0; i < todo.length; i++) {
      say('Syncing ' + (i + 1) + '/' + todo.length + '\u2026');
      if (await syncItem(todo[i])) ok++;
    }
    say('Synced ' + ok + ' of ' + todo.length + '.' + (ok < todo.length ? ' Some failed - try again.' : ''));
    renderList();
  }

  // ---------- UI ----------
  let lastSel = '';
  document.addEventListener('selectionchange', () => {
    const s = (window.getSelection().toString() || '').trim();
    if (s) lastSel = s;
  });

  const panel = mk('div', 'position:fixed;inset:0;background:rgba(0,0,0,.96);color:#fff;z-index:2147483646;display:none;flex-direction:column;font:14px -apple-system,sans-serif');
  panel.setAttribute('data-sk', '1');
  const bar = mk('div', 'display:flex;flex-wrap:wrap;gap:6px;padding:10px;background:#111');
  const status = mk('div', 'padding:6px 12px;font-size:12px;color:#34c759;min-height:16px');
  const body = mk('div', 'flex:1;overflow-y:auto;padding:0 12px 24px');
  const tabs = {};
  let current = 'save';

  function btn(label, fn, bg, parent) {
    const b = mk('button', 'padding:8px 12px;border:none;border-radius:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label);
    b.onclick = fn;
    (parent || bar).appendChild(b);
    return b;
  }
  const say = m => { status.textContent = m; };

  function show(name) {
    current = name;
    Object.keys(tabs).forEach(k => { tabs[k].style.background = k === name ? '#0a84ff' : '#2c2c2e'; });
    body.textContent = '';
    if (name === 'save') renderSave();
    else if (name === 'list') renderListView();
    else renderSetup();
  }

  tabs.save = btn('Save', () => show('save'));
  tabs.list = btn('Glossary', () => show('list'));
  tabs.setup = btn('Setup', () => show('setup'));
  btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30');

  // --- Save tab ---
  function renderSave() {
    const d = extract();
    const inputs = {};
    const prior = items.find(i => i.url === d.url || (d.model && i.model === d.model && i.site === d.site));

    if (prior) {
      let line = 'Saved before: ' + (prior.price ? prior.price + ' ' + prior.currency : 'no price') + ' on ' + prior.date;
      const diff = parseFloat(d.price) - parseFloat(prior.price);
      if (isFinite(diff) && diff !== 0) line += ' \u2192 now ' + (diff > 0 ? '+' : '') + diff.toFixed(2);
      body.appendChild(mk('div', 'background:#3a2f00;color:#ffd60a;padding:8px;border-radius:8px;margin:8px 0;font-size:12px', line));
    }

    [['name', 'Name'], ['model', 'Model'], ['price', 'Price'], ['currency', 'Cur.'], ['date', 'Date'], ['url', 'URL']].forEach(([key, label]) => {
      const row = mk('div', 'display:flex;align-items:center;gap:6px;margin:8px 0');
      row.appendChild(mk('div', 'width:48px;color:#aaa;font-size:12px', label));
      const input = mk('input', 'flex:1;min-width:0;padding:9px;border-radius:6px;border:none;font-size:14px');
      input.value = d[key] || '';
      inputs[key] = input;
      const pick = mk('button', 'padding:8px;border:none;border-radius:6px;background:#2c2c2e;color:#fff;font-size:12px', 'Sel');
      pick.title = 'Use the text you last selected on the page';
      pick.onclick = () => { if (!lastSel) return say('Select some text on the page first, then tap Sel.'); input.value = key === 'price' ? num(lastSel) : clean(lastSel); };
      row.append(input, pick);
      body.appendChild(row);
    });

    const save = btn('Save product', async () => {
      const item = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: clean(inputs.name.value), model: clean(inputs.model.value), price: num(inputs.price.value),
        currency: clean(inputs.currency.value).toUpperCase(), date: clean(inputs.date.value) || today(),
        url: clean(inputs.url.value), site: d.site, synced: false, savedAt: Date.now()
      };
      if (!item.name) return say('Name is required.');
      items.unshift(item);
      persist();
      if (target) { say('Saved. Syncing\u2026'); say((await syncItem(item)) ? 'Saved and synced to your sheet \u2713' : 'Saved locally. Sync failed - use Glossary \u2192 Sync.'); }
      else say('Saved locally. Connect a Google Sheet in Setup to sync.');
      tabs.list.textContent = 'Glossary (' + items.length + ')';
    }, '#34c759', body);
    save.style.cssText += ';width:100%;padding:12px;margin-top:10px;font-size:15px';
  }

  // --- Glossary tab ---
  let listBox, searchBox, countEl;

  function renderListView() {
    searchBox = mk('input', 'width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:none;font-size:15px;margin:8px 0');
    searchBox.placeholder = 'Quick search name, model, site, URL\u2026';
    searchBox.oninput = renderList;
    const actions = mk('div', 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px');
    btn('Sync unsynced', () => syncAll(say), '#0a84ff', actions);
    btn('Copy all (TSV)', async () => say((await copy(toTSV(items, true))) ? 'Copied all ' + items.length + ' rows for pasting into Sheets' : 'Copy failed'), null, actions);
    btn('Export CSV', exportCSV, null, actions);
    countEl = mk('div', 'font-size:12px;color:#aaa;margin:4px 0');
    listBox = mk('div');
    body.append(searchBox, actions, countEl, listBox);
    renderList();
  }

  function toTSV(rows, header) {
    const head = ['Name', 'Model', 'Price', 'Currency', 'Date', 'URL', 'Site'].join('\t');
    const lines = rows.map(i => [i.name, i.model, i.price, i.currency, i.date, i.url, i.site].map(clean).join('\t'));
    return (header ? [head] : []).concat(lines).join('\n');
  }

  function exportCSV() {
    const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['Name', 'Model', 'Price', 'Currency', 'Date', 'URL', 'Site']].concat(items.map(i => [i.name, i.model, i.price, i.currency, i.date, i.url, i.site]));
    const blob = new Blob([rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'product-glossary-' + today() + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 20000);
  }

  function renderList() {
    if (!listBox) return;
    const q = (searchBox.value || '').trim().toLowerCase();
    const shown = items.filter(i => !q || [i.name, i.model, i.site, i.url, i.currency, i.date].join(' ').toLowerCase().includes(q));
    listBox.textContent = '';
    countEl.textContent = shown.length + ' of ' + items.length + ' saved \u00B7 ' + items.filter(i => !i.synced).length + ' not yet synced';
    shown.slice(0, 200).forEach(i => {
      const card = mk('div', 'background:#1c1c1e;border-radius:10px;padding:10px;margin-bottom:8px');
      card.appendChild(mk('div', 'font-weight:600;margin-bottom:2px', (i.synced ? '\u2713 ' : '\u25CB ') + i.name));
      card.appendChild(mk('div', 'font-size:12px;color:#aaa;margin-bottom:6px', [i.model, i.price ? i.price + ' ' + i.currency : '', i.date, i.site].filter(Boolean).join(' \u00B7 ')));
      const row = mk('div', 'display:flex;gap:6px;flex-wrap:wrap');
      btn('Open', () => window.open(i.url, '_blank'), null, row);
      btn('Copy row', async () => say((await copy(toTSV([i], false))) ? 'Row copied' : 'Copy failed'), null, row);
      btn('Delete', () => { if (!confirm('Delete "' + i.name + '" from the glossary? (Rows already in your Google Sheet are not removed.)')) return; items = items.filter(x => x.id !== i.id); persist(); renderList(); tabs.list.textContent = 'Glossary (' + items.length + ')'; }, '#5c2020', row);
      card.appendChild(row);
      listBox.appendChild(card);
    });
  }

  // --- Setup tab ---
  function renderSetup() {
    const info = mk('div', 'margin:10px 0;font-size:13px;line-height:1.5');
    info.textContent = target
      ? 'Connected: ' + (target.type === 'form' ? 'Google Form \u2192 Google Sheet' : 'Webhook (' + new URL(target.url).hostname + ')')
      : 'Not connected. Products are saved on this device only until you connect a sheet.';
    body.appendChild(info);

    const how = mk('div', 'background:#1c1c1e;border-radius:10px;padding:10px;font-size:12px;color:#ccc;line-height:1.55;margin-bottom:10px');
    how.textContent =
      'Google Sheet setup (2 minutes): 1) Create a Google Form with 7 short-answer questions titled exactly: Name, Model, Price, Currency, Date, URL, Site. ' +
      '2) In the Form: Responses tab \u2192 Link to Sheets (this creates the spreadsheet you will view). ' +
      '3) Form \u22EE menu \u2192 Get pre-filled link, type the question title as each answer (Name in Name, Model in Model, etc.), Get link, copy it. ' +
      '4) Tap \u201CConnect Google Form\u201D below and paste that link.';
    body.appendChild(how);

    btn('Connect Google Form', () => {
      const link = prompt('Paste the full pre-filled link from Google Forms (docs.google.com/forms/...)');
      if (!link) return;
      try { target = parseFormLink(link); store.set(K_TARGET, target); say('Connected. New saves will sync to your sheet.'); show('setup'); }
      catch (e) { say(e.message); }
    }, '#0a84ff', body);

    const sp = mk('div', 'height:8px'); body.appendChild(sp);

    btn('Use a webhook instead (Zapier / Make)', () => {
      const url = prompt('Paste your webhook URL (Zapier \u201CCatch Hook\u201D or Make webhook, https only). Fields sent: name, model, price, currency, date, url, site.');
      if (!url) return;
      if (!/^https:\/\//i.test(url.trim())) return say('Webhook must start with https://');
      target = { type: 'webhook', url: url.trim() };
      store.set(K_TARGET, target);
      say('Webhook saved.');
      show('setup');
    }, null, body);

    if (target) {
      body.appendChild(mk('div', 'height:8px'));
      btn('Disconnect', () => { target = null; store.set(K_TARGET, null); say('Disconnected.'); show('setup'); }, '#5c2020', body);
    }
  }

  // ---------- floating button ----------
  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#ffd60a;color:#111;font:700 18px -apple-system,sans-serif;opacity:.9;box-shadow:0 2px 8px rgba(0,0,0,.4)', '\u2605');
  fab.setAttribute('data-sk', '1');
  fab.title = 'Product glossary';
  fab.onclick = () => { tabs.list.textContent = 'Glossary (' + items.length + ')'; panel.style.display = 'flex'; show('save'); };

  panel.append(bar, status, body);
  document.documentElement.append(panel, fab);
})();
