// ==UserScript==
// @name         SK Form Autofill
// @namespace    skgroups
// @version      1.0
// @description  One-tap fill of business/contact/shipping details from saved profiles. Never fills passwords, card, bank or ID-number fields, skips hidden fields (anti-honeypot), never submits, only runs when you tap it.
// @match        *://*/*
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// ==/UserScript==

// Profiles are stored with GM_getValue/GM_setValue so they are shared across all sites.
// Only put non-sensitive details in profiles (names, business info, email, phone, address).
// Do NOT store passwords, card numbers, banking or government ID numbers here.

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const slot = (W.__skFab = (W.__skFab || 0) + 1);
  const K_PROFILES = 'sk_af_profiles';
  const K_LAST = 'sk_af_last';

  const FIELD_LABELS = [
    ['company', 'Company'], ['first', 'First name'], ['last', 'Last name'], ['email', 'Email'], ['phone', 'Phone'],
    ['website', 'Website'], ['address1', 'Address line 1'], ['address2', 'Address line 2 / Unit'],
    ['city', 'City'], ['province', 'Province (e.g. ON)'], ['postal', 'Postal code'], ['country', 'Country']
  ];

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

  let profiles = store.get(K_PROFILES, null);
  if (!profiles) {
    // Starter profiles - edit them in the panel. Contact/address details are left blank for you to fill in.
    profiles = {
      'SK Groups': { company: 'SK Groups', website: 'https://skgroups.ca', email: 'info@skgroups.ca', country: 'Canada' },
      'Tesla Fire Systems Inc': { company: 'Tesla Fire Systems Inc', website: 'https://www.teslafiresystems.com', country: 'Canada' }
    };
    store.set(K_PROFILES, profiles);
  }
  let currentName = store.get(K_LAST, null);
  if (!currentName || !profiles[currentName]) currentName = Object.keys(profiles)[0];

  // ---------- matching ----------
  const BLOCK = /pass|card|cc-|cvv|cvc|csc|expir|iban|routing|transit|account.?n|\bsin\b|\bssn\b|social.?ins|tax.?id|birth|dob|otp|2fa|captcha|security.?code|\bpin\b|token|secret/i;

  const AUTOCOMPLETE = {
    'email': 'email', 'tel': 'phone', 'tel-national': 'phone', 'postal-code': 'postal',
    'address-level1': 'province', 'address-level2': 'city', 'address-line1': 'address1', 'street-address': 'address1',
    'address-line2': 'address2', 'organization': 'company', 'given-name': 'first', 'family-name': 'last',
    'name': 'full', 'url': 'website', 'country': 'country', 'country-name': 'country'
  };

  const RULES = [
    ['email', /e-?mail|courriel/],
    ['phone', /phone|\btel\b|mobile|\bcell\b|t[eé]l[eé]phone/],
    ['postal', /postal|zip|postcode/],
    ['province', /province|\bstate\b|region|\bprov\b/],
    ['city', /\bcity\b|\btown\b|ville|locality/],
    ['address2', /address.?(line)?.?2|address2|line.?2|\bapt\b|suite|\bunit\b/],
    ['address1', /address|street|\baddr\b|adresse/],
    ['company', /company|organi[sz]ation|business|employer|\bfirm\b|entreprise/],
    ['first', /first.?name|given|fname|pr[eé]nom/],
    ['last', /last.?name|family|surname|lname|\bnom\b/],
    ['full', /full.?name|your.?name|contact.?name|^name$|\bname\b/],
    ['website', /website|web.?site|\burl\b/],
    ['country', /country|pays/]
  ];

  const PROVINCES = {
    AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick', NL: 'Newfoundland and Labrador',
    NS: 'Nova Scotia', NT: 'Northwest Territories', NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island',
    QC: 'Quebec', SK: 'Saskatchewan', YT: 'Yukon'
  };

  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  function labelText(el) {
    let t = '';
    if (el.id) { const l = document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]'); if (l) t += ' ' + l.textContent; }
    const wrap = el.closest('label'); if (wrap) t += ' ' + wrap.textContent;
    const lb = el.getAttribute('aria-labelledby');
    if (lb) lb.split(/\s+/).forEach(id => { const n = document.getElementById(id); if (n) t += ' ' + n.textContent; });
    return t;
  }

  function descriptor(el) {
    return (el.getAttribute('autocomplete') || '') + ' ' + (el.name || '') + ' ' + (el.id || '') + ' ' + (el.placeholder || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + labelText(el);
  }

  function visible(el) {
    if (el.disabled || el.readOnly) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (r.right < 0 || r.bottom < 0 || r.left > window.innerWidth + 50) return false; // off-screen honeypots
    return true;
  }

  function classify(el) {
    const raw = descriptor(el);
    const d = raw.toLowerCase();
    if (el.type === 'password' || BLOCK.test(d)) return { sensitive: true };
    const ac = (el.getAttribute('autocomplete') || '').toLowerCase().split(/\s+/).pop();
    if (ac && AUTOCOMPLETE[ac]) return { key: AUTOCOMPLETE[ac] };
    for (const [key, re] of RULES) if (re.test(d)) return { key };
    return {};
  }

  function setValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
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

  let lastForm = null;
  document.addEventListener('focusin', e => { if (e.target && e.target.form) lastForm = e.target.form; });

  function fillPage(profile, overwrite) {
    const p = Object.assign({}, profile);
    p.full = [p.first, p.last].filter(Boolean).join(' ');
    const scope = lastForm && document.contains(lastForm) ? lastForm : document;
    let filled = 0, skippedSensitive = 0;

    scope.querySelectorAll('input, select, textarea').forEach(el => {
      const type = (el.type || '').toLowerCase();
      if (['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio', 'file', 'range', 'color'].includes(type)) return;
      if (!visible(el)) return;
      const c = classify(el);
      if (c.sensitive) { skippedSensitive++; return; }
      if (!c.key || !p[c.key]) return;
      if (!overwrite && el.value && el.tagName !== 'SELECT') return;

      let ok = true;
      if (el.tagName === 'SELECT') ok = fillSelect(el, c.key, p[c.key]);
      else setValue(el, p[c.key]);
      if (ok) {
        filled++;
        const prev = el.style.outline;
        el.style.outline = '2px solid #34c759';
        setTimeout(() => { el.style.outline = prev; }, 2500);
      }
    });
    return { filled, skippedSensitive, scopeIsForm: scope !== document };
  }

  // ---------- UI ----------
  function mk(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  const panel = mk('div', 'position:fixed;left:12px;right:12px;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;max-width:440px;max-height:80vh;overflow-y:auto;background:#111;color:#fff;border-radius:12px;padding:12px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
  panel.setAttribute('data-sk', '1');

  function btn(label, fn, bg, parent) {
    const b = mk('button', 'padding:9px 12px;margin:6px 6px 0 0;border:none;border-radius:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label);
    b.onclick = fn;
    parent.appendChild(b);
    return b;
  }

  function render() {
    panel.textContent = '';
    const select = mk('select', 'width:100%;padding:9px;border-radius:6px;border:none;font-size:14px');
    Object.keys(profiles).forEach(n => { const o = mk('option', '', n); o.value = n; if (n === currentName) o.selected = true; select.appendChild(o); });
    select.onchange = () => { currentName = select.value; store.set(K_LAST, currentName); render(); };
    panel.appendChild(select);

    const inputs = {};
    const grid = mk('div', 'margin-top:8px');
    FIELD_LABELS.forEach(([key, label]) => {
      const row = mk('div', 'display:flex;align-items:center;gap:6px;margin:4px 0');
      row.appendChild(mk('div', 'width:96px;color:#aaa;font-size:11px', label));
      const i = mk('input', 'flex:1;min-width:0;padding:7px;border-radius:6px;border:none;font-size:14px');
      i.value = profiles[currentName][key] || '';
      inputs[key] = i;
      row.appendChild(i);
      grid.appendChild(row);
    });
    panel.appendChild(grid);

    const ow = mk('label', 'display:block;font-size:12px;color:#ccc;margin-top:8px');
    const owBox = mk('input'); owBox.type = 'checkbox';
    ow.append(owBox, document.createTextNode(' Overwrite fields that already have text'));
    panel.appendChild(ow);

    const msg = mk('div', 'font-size:12px;color:#34c759;margin-top:8px;min-height:15px');

    const row = mk('div');
    function collect() { const o = {}; FIELD_LABELS.forEach(([k]) => { if (inputs[k].value.trim()) o[k] = inputs[k].value.trim(); }); return o; }

    btn('Fill this page', () => {
      profiles[currentName] = collect(); store.set(K_PROFILES, profiles);
      const r = fillPage(profiles[currentName], owBox.checked);
      msg.textContent = 'Filled ' + r.filled + ' field(s)' + (r.scopeIsForm ? ' in the form you last tapped' : '') +
        (r.skippedSensitive ? ' \u00B7 skipped ' + r.skippedSensitive + ' sensitive field(s)' : '') + '. Review before submitting.';
      msg.style.color = r.filled ? '#34c759' : '#ff9f0a';
    }, '#34c759', row);
    btn('Save profile', () => { profiles[currentName] = collect(); store.set(K_PROFILES, profiles); msg.textContent = 'Profile saved.'; msg.style.color = '#34c759'; }, '#0a84ff', row);
    btn('New', () => {
      const n = (prompt('New profile name (e.g. Tesla Electric Ltd)') || '').trim();
      if (!n || profiles[n]) return;
      profiles[n] = {}; currentName = n; store.set(K_PROFILES, profiles); store.set(K_LAST, n); render();
    }, null, row);
    btn('Delete', () => {
      if (Object.keys(profiles).length < 2) return alert('Keep at least one profile.');
      if (!confirm('Delete profile "' + currentName + '"?')) return;
      delete profiles[currentName]; currentName = Object.keys(profiles)[0]; store.set(K_PROFILES, profiles); store.set(K_LAST, currentName); render();
    }, '#5c2020', row);
    btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30', row);
    panel.append(row, msg);
    panel.appendChild(mk('div', 'font-size:11px;color:#8e8e93;margin-top:6px', 'Tip: tap into a field of the form you want first, and only that form is filled. Passwords, card, bank and ID fields are never touched.'));
  }

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#34c759;color:#111;font:700 12px -apple-system,sans-serif;opacity:.9;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'Fill');
  fab.setAttribute('data-sk', '1');
  fab.title = 'Form autofill';
  fab.onclick = () => { if (panel.style.display === 'none') { render(); panel.style.display = 'block'; } else panel.style.display = 'none'; };
  document.documentElement.append(panel, fab);
})();
