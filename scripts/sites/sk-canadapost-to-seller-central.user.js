// ==UserScript==
// @name         SK Canada Post to Seller Central Tracking No
// @namespace    skgroups
// @version      1.2
// @description  Grab a Canada Post tracking number (spaces removed) from the label page, then fill it into the Tracking ID field on Amazon Seller Central's Confirm Shipment page. Also strips spaces from any tracking number you paste into that field.
// @match        *://*.canadapost-postescanada.ca/*
// @match        *://*.canadapost.ca/*
// @match        *://sellercentral.amazon.ca/*
// @match        *://sellercentral.amazon.com/*
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// ==/UserScript==

// HOW IT WORKS
//  On Canada Post:   tap "CP#"  -> finds the tracking number on the page (or uses your selected text),
//                    removes all spaces, saves it, and copies it to the clipboard.
//                    (If the label is a PDF, use the separate sk-canadapost-label-pdf script instead.)
//  On Seller Central: tap "Trk" -> pick a saved number (or "Paste clipboard") -> it fills the Tracking ID field.
//                    Pasting a spaced number into a tracking field by hand is also cleaned automatically.
// Saved numbers are shared between the two sites via GM_getValue/GM_setValue.
// If your manager lacks GM_*, storage falls back to per-site localStorage and numbers will NOT cross sites
// (the clipboard copy still works: use "Paste clipboard" on the Seller Central side).
//
// v1.1: the Tracking ID box is now found by its visible "Tracking ID:" label text (Seller Central's
//       Confirm Shipment page has no tracking-related name/id on the input itself).
// v1.2: renamed without special characters ("->" and "#") so cloud sync file names are accepted.

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const slot = (W.__skFab = (W.__skFab || 0) + 1);
  const IS_CP = /canadapost/i.test(location.hostname);
  const IS_SC = /^sellercentral\./i.test(location.hostname);
  const KEY = 'sk_cp_queue';

  // ---------- helpers ----------
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

  const norm = s => String(s == null ? '' : s).replace(/[\s\u00a0\u200b-\u200f]/g, '').toUpperCase();

  function mk(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  function toast(msg, ms) {
    const t = mk('div', 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#111;color:#fff;padding:9px 14px;border-radius:8px;font:14px -apple-system,sans-serif;z-index:2147483647;max-width:85vw;text-align:center;white-space:pre-line', msg);
    t.setAttribute('data-sk', '1');
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), ms || 3200);
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

  const queue = () => store.get(KEY, []);
  function addToQueue(n) {
    const q = queue().filter(x => x.n !== n);
    q.unshift({ n, t: Date.now(), used: false });
    store.set(KEY, q.slice(0, 30));
  }

  function mkFab(label, bg, color) {
    const b = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:' + bg + ';color:' + (color || '#fff') + ';font:700 11px -apple-system,sans-serif;opacity:.92;box-shadow:0 2px 8px rgba(0,0,0,.4)', label);
    b.setAttribute('data-sk', '1');
    return b;
  }

  function mkPanel() {
    const p = mk('div', 'position:fixed;left:12px;right:12px;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;max-width:420px;max-height:70vh;overflow-y:auto;background:#111;color:#fff;border-radius:12px;padding:12px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
    p.setAttribute('data-sk', '1');
    return p;
  }

  function btn(label, fn, bg) {
    const b = mk('button', 'padding:9px 12px;margin:4px 6px 0 0;border:none;border-radius:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label);
    b.onclick = fn;
    return b;
  }

  // =====================================================================
  //  CANADA POST SIDE
  // =====================================================================
  if (IS_CP) {
    // 16-digit PIN (optionally grouped "1234 5678 9012 3456") or international style AB123456789CA
    const PIN_RE = /\b(?:\d{4}[ \u00a0]?){3}\d{4}\b|\b[A-Z]{2}\d{9}CA\b/g;

    function findIn(text) {
      const out = [];
      const re = new RegExp(PIN_RE.source, 'g');
      let m;
      while ((m = re.exec(text))) { const n = norm(m[0]); if (!out.includes(n)) out.push(n); }
      return out;
    }

    function candidates() {
      const sel = (window.getSelection().toString() || '').trim();
      if (sel) {
        const fromSel = findIn(sel);
        if (fromSel.length) return fromSel;
        const n = norm(sel);
        if (/^[A-Z0-9]{12,20}$/.test(n)) return [n]; // user selected a number we don't have a pattern for
      }
      const inputs = [...document.querySelectorAll('input, textarea')].map(i => i.value).join('\n');
      return findIn((document.body.innerText || '') + '\n' + inputs);
    }

    const panel = mkPanel();
    const fab = mkFab('CP#', '#da291c');

    async function save(n) {
      addToQueue(n);
      const ok = await copy(n);
      panel.style.display = 'none';
      toast('Saved ' + n + ' (no spaces)' + (ok ? ' and copied.' : '.') + '\nOpen Seller Central and tap Trk.', 4200);
    }

    fab.onclick = () => {
      const found = candidates();
      if (!found.length) {
        panel.textContent = '';
        panel.append(
          mk('div', 'margin-bottom:8px', 'No tracking number found in the page text.'),
          mk('div', 'font-size:12px;color:#aaa;line-height:1.5', 'If this label is a PDF, use the PDF# button (sk-canadapost-label-pdf script). Otherwise select the number on the page and tap CP# again, or copy it and use "Paste clipboard" on Seller Central.'),
          btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30')
        );
        panel.style.display = 'block';
        return;
      }
      if (found.length === 1) return save(found[0]);
      panel.textContent = '';
      panel.appendChild(mk('div', 'margin-bottom:6px;color:#aaa;font-size:12px', found.length + ' numbers found - tap the one to use:'));
      found.slice(0, 15).forEach(n => panel.appendChild(btn(n, () => save(n), '#0a84ff')));
      panel.appendChild(btn('Save all', async () => { found.slice(0, 15).reverse().forEach(addToQueue); panel.style.display = 'none'; toast('Saved ' + Math.min(found.length, 15) + ' numbers.'); }));
      panel.appendChild(btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30'));
      panel.style.display = 'block';
    };

    document.documentElement.append(panel, fab);
    return;
  }

  // =====================================================================
  //  SELLER CENTRAL SIDE
  // =====================================================================
  if (!IS_SC) return;

  function deepAll(root, out) {
    out = out || [];
    root.querySelectorAll('*').forEach(el => {
      out.push(el);
      if (el.shadowRoot) deepAll(el.shadowRoot, out);
    });
    return out;
  }

  // Attribute-based detection (name / id / placeholder / aria-label / <label for>)
  function desc(el) {
    let s = [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), el.getAttribute('data-testid'), el.getAttribute('data-test-id'), el.getAttribute('label')].join(' ');
    let n = el;
    for (let i = 0; i < 4; i++) {
      const root = n.getRootNode && n.getRootNode();
      if (root && root.host) {
        n = root.host;
        s += ' ' + [n.id, n.getAttribute('label'), n.getAttribute('placeholder'), n.getAttribute('name'), n.getAttribute('aria-label')].join(' ');
      } else break;
    }
    if (el.id) {
      try {
        const l = el.getRootNode().querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (l) s += ' ' + l.textContent;
      } catch {}
    }
    const wrap = el.closest && el.closest('label');
    if (wrap) s += ' ' + wrap.textContent;
    return s;
  }

  const TRACK_RE = /track/i;
  const NOT_TRACK_RE = /url|link|status|event|history/i;
  // Visible label text such as "Tracking ID:", "Tracking number", "Tracking #"
  const LABEL_RE = /^tracking\s*(id|number|no\.?|#)?\s*:?\s*\*?$/i;

  function okType(el) {
    return el && el.tagName === 'INPUT' && /^(text|search|tel|)$/i.test(el.type || '');
  }

  // Text-based detection: find a short element reading "Tracking ID:" and take the first
  // text input that follows it nearby (Seller Central's input has no tracking-related attributes).
  function labelFields() {
    const out = [];
    deepAll(document).forEach(el => {
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'OPTION' || el.children.length > 2) return;
      const t = (el.textContent || '').trim();
      if (!t || t.length > 40 || !LABEL_RE.test(t)) return;
      let p = el;
      for (let i = 0; i < 6 && p; i++) {
        p = p.parentElement || (p.getRootNode && p.getRootNode().host) || null;
        if (!p) break;
        const inp = [...p.querySelectorAll('input')].find(x => okType(x) && (el.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING));
        if (inp) { out.push(inp); break; }
      }
    });
    return out;
  }

  function isTrackingField(el, lf) {
    if (!okType(el)) return false;
    const d = desc(el);
    if (TRACK_RE.test(d) && !NOT_TRACK_RE.test(d)) return true;
    return (lf || labelFields()).includes(el);
  }

  function visible(el) {
    if (el.disabled || el.readOnly) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  }

  function trackingFields() {
    const lf = labelFields();
    const seen = new Set();
    return deepAll(document).filter(el => {
      if (el.tagName !== 'INPUT' || seen.has(el)) return false;
      if (!isTrackingField(el, lf) || !visible(el)) return false;
      seen.add(el);
      return true;
    });
  }

  let lastTrack = null;
  document.addEventListener('focusin', e => {
    const t = (e.composedPath && e.composedPath()[0]) || e.target;
    if (isTrackingField(t)) lastTrack = t;
  }, true);

  function setNative(el, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    const root = el.getRootNode && el.getRootNode();
    const host = root && root.host;
    if (host) {
      try { if ('value' in host) host.value = value; } catch {}
      host.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }
    el.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
  }

  function pickTarget() {
    if (lastTrack && lastTrack.isConnected && visible(lastTrack)) return lastTrack;
    const f = trackingFields();
    return f.find(x => !x.value) || f[0] || null;
  }

  async function fillNumber(n, say) {
    const value = norm(n);
    const el = pickTarget();
    if (!el) {
      await copy(value);
      say('No Tracking ID box found on this page. Open the order\u2019s Confirm Shipment page. The number was copied to your clipboard.');
      return false;
    }
    setNative(el, value);
    el.style.outline = '2px solid #34c759';
    setTimeout(() => { el.style.outline = ''; }, 2500);
    lastTrack = null; // next fill goes to the next empty tracking field
    const q = queue().map(x => x.n === value ? Object.assign({}, x, { used: true }) : x);
    store.set(KEY, q);
    say('Filled ' + value + '. Check it, then confirm the shipment yourself.');
    return true;
  }

  // Manual paste with spaces -> strip them automatically
  document.addEventListener('paste', e => {
    const t = (e.composedPath && e.composedPath()[0]) || e.target;
    if (!isTrackingField(t)) return;
    const text = ((e.clipboardData || window.clipboardData).getData('text') || '').trim();
    if (!text || /[\r\n]/.test(text) || !/\s/.test(text)) return;
    e.preventDefault();
    setNative(t, norm(text));
  }, true);

  // ---------- UI ----------
  const panel = mkPanel();
  const fab = mkFab('Trk', '#ff9900', '#111');
  const msg = mk('div', 'font-size:12px;color:#34c759;margin:8px 0 2px;min-height:15px;line-height:1.4');
  const say = m => { msg.textContent = m; };

  function render() {
    panel.textContent = '';
    const q = queue();
    panel.appendChild(mk('div', 'font-weight:600;margin-bottom:6px', 'Tracking numbers'));
    if (!q.length) panel.appendChild(mk('div', 'font-size:12px;color:#aaa;margin-bottom:6px', 'None saved yet. Tap CP# / PDF# on the Canada Post label page, or use Paste clipboard below.'));
    q.slice(0, 12).forEach(x => {
      const row = mk('div', 'display:flex;align-items:center;gap:6px;margin:3px 0');
      row.appendChild(btn((x.used ? '\u2713 ' : '') + x.n, () => fillNumber(x.n, say), x.used ? '#2c2c2e' : '#0a84ff'));
      panel.appendChild(row);
    });
    const actions = mk('div', 'margin-top:6px');
    actions.append(
      btn('Paste clipboard (no spaces)', async () => {
        try {
          const t = await navigator.clipboard.readText();
          const n = norm(t);
          if (!/^[A-Z0-9]{10,25}$/.test(n)) return say('Clipboard doesn\u2019t look like a tracking number.');
          addToQueue(n);
          await fillNumber(n, say);
          render();
        } catch { say('Clipboard access was blocked. Paste straight into the field instead; spaces are removed automatically.'); }
      }, '#34c759'),
      btn('Clear list', () => { store.set(KEY, []); render(); }, '#5c2020'),
      btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30')
    );
    panel.append(actions, msg);
  }

  fab.onclick = () => { if (panel.style.display === 'none') { render(); panel.style.display = 'block'; } else panel.style.display = 'none'; };
  document.documentElement.append(panel, fab);
})();
