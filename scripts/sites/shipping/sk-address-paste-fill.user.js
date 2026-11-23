// ==UserScript==
// @name         SK Address Paste and Fill
// @namespace    skgroups
// @version      1.0
// @description  Paste a copied buyer address (from SK Seller Central Order Copy, or any "name / street / city, province postal / country / phone" block) and fill the recipient section of a Canada Post or FedEx shipping form. Never submits.
// @match        *://*.canadapost-postescanada.ca/*
// @match        *://*.canadapost.ca/*
// @match        *://*.fedex.com/*
// @noframes
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/sites/shipping/sk-address-paste-fill.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/sites/shipping/sk-address-paste-fill.user.js
// ==/UserScript==

// HOW TO USE
//  1. On Seller Central's order page tap "Ship" -> "Copy all" (or "Copy row").
//  2. On the Canada Post / FedEx shipping form, TAP INTO THE FIRST FIELD of the RECIPIENT ("To") section.
//     This tells the script which section to fill, so the sender ("From") section is never touched.
//  3. Tap the "Addr" button -> "Paste from clipboard" -> check the parsed values -> "Fill form".
//  4. Review every field yourself before continuing. The script never submits and never touches
//     card, bank, email, company or password fields.
// The package contents / description-of-goods field is NOT filled: for regulated goods (e.g. dangerous goods)
// those entries must be exactly right, so enter them yourself.

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const slot = (window.__skFab = (window.__skFab || 0) + 1);

  const PROVINCES = {
    AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick', NL: 'Newfoundland and Labrador',
    NS: 'Nova Scotia', NT: 'Northwest Territories', NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island',
    QC: 'Quebec', SK: 'Saskatchewan', YT: 'Yukon'
  };
  const COUNTRY_RE = /^(canada|united states( of america)?|usa|us)$/i;
  const POSTAL_TAIL = /(?:[A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(?:-\d{4})?)\s*$/i;
  const CITY_RE = /^(.*?),\s*(.+?)\s+([A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(?:-\d{4})?)\s*$/i;

  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  function mk(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------- parsing ----------
  function parseBlock(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    const out = { name: '', street: [], city: '', prov: '', postal: '', country: '', phone: '', orderId: '' };

    // "Copy row" format: tab-separated columns
    if (t.indexOf('\t') >= 0 && t.indexOf('\n') < 0) {
      const c = t.split('\t').map(s => s.trim());
      if (c.length >= 8) {
        out.name = c[0]; out.street = [c[1], c[2]].filter(Boolean); out.city = c[3]; out.prov = c[4];
        out.postal = c[5]; out.country = c[6]; out.phone = c[7]; out.orderId = c[11] || '';
        return out;
      }
    }

    const addr = [];
    t.split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(l => {
      let m;
      if ((m = l.match(/^phone:?\s*(.+)$/i))) { out.phone = m[1].trim(); return; }
      if ((m = l.match(/^order id:?\s*(.+)$/i))) { out.orderId = m[1].trim(); return; }
      if (/^item:?/i.test(l)) return;
      addr.push(l);
    });

    out.name = addr[0] || '';
    let rest = addr.slice(1);
    if (rest.length && COUNTRY_RE.test(rest[rest.length - 1])) out.country = rest.pop();

    // One-line address: "street, city, province postal[, country]"
    if (rest.length === 1 && (rest[0].match(/,/g) || []).length >= 2) {
      const parts = rest[0].split(/,\s*/);
      if (COUNTRY_RE.test(parts[parts.length - 1])) out.country = parts.pop();
      const last = parts.pop() || '';
      const m = last.match(/^(.*?)\s*([A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(?:-\d{4})?)$/i);
      if (m) { out.prov = m[1].trim(); out.postal = m[2].toUpperCase(); }
      out.city = parts.pop() || '';
      out.street = [parts.join(', ')].filter(Boolean);
      return out;
    }

    const idx = rest.findIndex(l => POSTAL_TAIL.test(l));
    if (idx >= 0) {
      const m = rest[idx].match(CITY_RE);
      if (m) { out.city = m[1]; out.prov = m[2]; out.postal = m[3].toUpperCase(); rest = rest.slice(0, idx); }
    }
    out.street = rest;
    return out;
  }

  // ---------- field matching ----------
  const BLOCK = /pass|card|cc-|cvv|cvc|csc|expir|iban|routing|account.?n|\bsin\b|\bssn\b|tax.?id|birth|dob|otp|token|secret|e-?mail|company|organi[sz]ation|business/i;
  const RULES = [
    ['ref', /reference|customer.?ref|your.?ref|po.?number/],
    ['phone', /phone|\btel\b|mobile|\bcell\b/],
    ['postal', /postal|zip|postcode/],
    ['province', /province|\bstate\b|\bprov\b|region/],
    ['city', /\bcity\b|\btown\b|municipality|locality/],
    ['address2', /address.?(line)?.?2|address2|line.?2|\bapt\b|suite|\bunit\b|building/],
    ['address1', /address|street/],
    ['first', /first.?name|given/],
    ['last', /last.?name|family|surname/],
    ['full', /full.?name|contact.?name|recipient|^\s*name\s*$|\bname\b/],
    ['country', /country/]
  ];

  function labelText(el) {
    let t = '';
    if (el.id) { try { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) t += ' ' + l.textContent; } catch {} }
    const wrap = el.closest('label'); if (wrap) t += ' ' + wrap.textContent;
    const lb = el.getAttribute('aria-labelledby');
    if (lb) lb.split(/\s+/).forEach(id => { const n = document.getElementById(id); if (n) t += ' ' + n.textContent; });
    return t;
  }

  function classify(el) {
    const d = [el.getAttribute('autocomplete'), el.name, el.id, el.placeholder, el.getAttribute('aria-label'), labelText(el)].join(' ').toLowerCase();
    if (el.type === 'password' || BLOCK.test(d)) return null;
    for (const [key, re] of RULES) if (re.test(d)) return key;
    return null;
  }

  function visible(el) {
    if (el.disabled || el.readOnly) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2 && r.right >= 0 && r.bottom >= 0;
  }

  const SKIP_TYPES = ['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio', 'file', 'range', 'color', 'password'];
  const okField = el => !SKIP_TYPES.includes((el.type || '').toLowerCase()) && visible(el);
  const fieldsIn = root => [...root.querySelectorAll('input, select, textarea')].filter(okField);

  let lastField = null;
  document.addEventListener('focusin', e => {
    const t = (e.composedPath && e.composedPath()[0]) || e.target;
    if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) && okField(t) && !t.closest('[data-sk]')) lastField = t;
  }, true);

  // The smallest container around the last-tapped field that holds at least 4 address-type fields
  function findScope() {
    if (!lastField || !lastField.isConnected) return null;
    let p = lastField.parentElement;
    while (p && p !== document.body) {
      if (fieldsIn(p).filter(classify).length >= 4) return p;
      p = p.parentElement;
    }
    return lastField.form || document.body;
  }

  function setValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function candidatesFor(key, value) {
    const c = [value];
    if (key === 'province') {
      const up = value.toUpperCase();
      if (PROVINCES[up]) c.push(PROVINCES[up]);
      Object.keys(PROVINCES).forEach(code => { if (norm(PROVINCES[code]) === norm(value)) c.push(code); });
      if (norm(value) === 'quebec') c.push('QC', 'Qu\u00E9bec');
    }
    if (key === 'country') {
      if (/^(ca|can|canada)$/i.test(value)) c.push('Canada', 'CA', 'CAN');
      if (/^(us|usa|united states)/i.test(value)) c.push('United States', 'US', 'USA');
    }
    return c.map(norm);
  }

  function fillSelect(el, key, value) {
    const cands = candidatesFor(key, value);
    const opt = [...el.options].find(o => cands.includes(norm(o.value)) || cands.includes(norm(o.text)))
      || [...el.options].find(o => cands.some(c => c && norm(o.text).startsWith(c)));
    if (!opt) return false;
    setValue(el, opt.value);
    return true;
  }

  function fillForm(d, opts) {
    const scope = findScope();
    if (!scope) return { error: 'First tap into the first field of the RECIPIENT section of the form, then tap Fill form.' };
    const els = fieldsIn(scope);
    const hasFirst = els.some(e => classify(e) === 'first');
    const parts = d.name.split(/\s+/).filter(Boolean);
    const vals = {
      first: parts[0] || '', last: parts.slice(1).join(' '), full: d.name,
      address1: d.street[0] || '', address2: d.street.slice(1).join(' '),
      city: d.city, province: d.prov,
      postal: opts.noSpace ? d.postal.replace(/\s/g, '') : d.postal,
      phone: opts.digits ? d.phone.replace(/\D/g, '') : d.phone,
      country: d.country || (/^[A-Z]\d[A-Z]/i.test(d.postal) ? 'Canada' : ''),
      ref: d.orderId
    };
    let filled = 0;
    const missed = [];
    els.forEach(el => {
      const key = classify(el);
      if (!key || !vals[key]) return;
      if (key === 'full' && hasFirst) return;
      if (!opts.overwrite && el.tagName !== 'SELECT' && el.value) return;
      let ok = true;
      if (el.tagName === 'SELECT') ok = fillSelect(el, key, vals[key]);
      else setValue(el, vals[key]);
      if (ok) {
        filled++;
        const prev = el.style.outline;
        el.style.outline = '2px solid #34c759';
        setTimeout(() => { el.style.outline = prev; }, 3000);
      } else missed.push(key);
    });
    return { filled, missed, total: els.length };
  }

  // ---------- UI ----------
  const panel = mk('div', 'position:fixed;left:12px;right:12px;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;max-width:440px;max-height:78vh;overflow-y:auto;background:#111;color:#fff;border-radius:12px;padding:12px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
  panel.setAttribute('data-sk', '1');

  function btn(label, fn, bg) {
    const b = mk('button', 'padding:9px 12px;margin:6px 6px 0 0;border:none;border-radius:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label);
    b.onclick = fn;
    return b;
  }
  function check(label, checked) {
    const l = mk('label', 'display:block;font-size:12px;color:#ccc;margin-top:4px');
    const c = mk('input'); c.type = 'checkbox'; c.checked = !!checked;
    l.append(c, document.createTextNode(' ' + label));
    return { l, c };
  }

  const ta = mk('textarea', 'width:100%;box-sizing:border-box;height:90px;border-radius:8px;border:none;padding:8px;font-size:13px');
  ta.placeholder = 'Paste the copied address here, or tap "Paste from clipboard"';
  const summary = mk('div', 'font-size:12px;color:#ccc;margin-top:8px;white-space:pre-line;line-height:1.5');
  const status = mk('div', 'font-size:12px;color:#34c759;margin-top:8px;min-height:15px;line-height:1.4');
  const ow = check('Overwrite fields that already have text', false);
  const dg = check('Phone: digits only (e.g. 2502488442)', true);
  const ns = check('Postal code: remove the space', false);

  function refreshSummary() {
    const d = parseBlock(ta.value);
    if (!d) { summary.textContent = ''; return null; }
    summary.textContent =
      'Name: ' + (d.name || '\u2014') + '\nStreet: ' + (d.street.join(' / ') || '\u2014') + '\nCity: ' + (d.city || '\u2014') +
      '\nProvince: ' + (d.prov || '\u2014') + '\nPostal: ' + (d.postal || '\u2014') + '\nCountry: ' + (d.country || '\u2014') +
      '\nPhone: ' + (d.phone || '\u2014') + (d.orderId ? '\nReference: ' + d.orderId : '');
    return d;
  }
  ta.addEventListener('input', refreshSummary);

  const row = mk('div');
  row.append(
    btn('Paste from clipboard', async () => {
      try { ta.value = await navigator.clipboard.readText(); const d = refreshSummary(); status.textContent = d ? 'Check the values below, then tap Fill form.' : 'Clipboard was empty.'; }
      catch { status.textContent = 'Clipboard access blocked. Paste into the box manually.'; }
    }, '#0a84ff'),
    btn('Fill form', () => {
      const d = refreshSummary();
      if (!d || !d.name) { status.style.color = '#ff9f0a'; status.textContent = 'Nothing to fill. Paste an address first.'; return; }
      const r = fillForm(d, { overwrite: ow.c.checked, digits: dg.c.checked, noSpace: ns.c.checked });
      if (r.error) { status.style.color = '#ff9f0a'; status.textContent = r.error; return; }
      status.style.color = r.filled ? '#34c759' : '#ff9f0a';
      status.textContent = 'Filled ' + r.filled + ' of ' + r.total + ' fields in the section you tapped.' +
        (r.missed.length ? ' Couldn\u2019t match: ' + r.missed.join(', ') + '.' : '') + ' Review everything before continuing.';
    }, '#34c759'),
    btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30')
  );

  panel.append(ta, summary, ow.l, dg.l, ns.l, row, status,
    mk('div', 'font-size:11px;color:#8e8e93;margin-top:8px', 'Tap into the first field of the recipient (To) section before tapping Fill form. Sender fields are never touched.'));

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#34c759;color:#111;font:700 11px -apple-system,sans-serif;opacity:.92;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'Addr');
  fab.setAttribute('data-sk', '1');
  fab.title = 'Paste an address and fill the recipient section';
  fab.onclick = () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; };
  document.documentElement.append(panel, fab);
})();
