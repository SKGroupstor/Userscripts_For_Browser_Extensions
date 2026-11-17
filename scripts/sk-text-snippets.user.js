// ==UserScript==
// @name         SK Text Snippets
// @namespace    skgroups
// @version      1.0
// @description  Saved replies you insert into any text box with one tap (Seller Central messages, WooCommerce notes, email, forms). Supports {date}, {time}, {site}, {title}, {url}. Edit your own snippets in the panel.
// @match        *://*/*
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// ==/UserScript==

// Snippets are stored with GM_getValue/GM_setValue, so they are shared across all sites in this browser profile.
// (If your manager lacks GM_*, they fall back to per-site storage.) Tap into a text box FIRST, then tap Txt -> Insert.
// The starter snippets below are neutral examples - edit them to your own wording.
// Reminder: marketplace buyer messages must follow the marketplace's own messaging rules.

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const slot = (W.__skFab = (W.__skFab || 0) + 1);
  const KEY = 'sk_snippets_v1';

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

  const SEED = [
    { id: 's1', name: 'Order shipped', text: 'Hello,\n\nThank you for your order. It has shipped and is on its way to you. Please let us know if you have any questions once it arrives.\n\nKind regards,\nCustomer Service' },
    { id: 's2', name: 'Preparing your order', text: 'Hello,\n\nThank you for your order. We are preparing it for shipment and expect it to ship by {date}. We appreciate your patience.\n\nKind regards,\nCustomer Service' },
    { id: 's3', name: 'Confirm details', text: 'Hello,\n\nThank you for your order. Before we ship, could you please confirm the delivery address and a contact phone number for the carrier?\n\nKind regards,\nCustomer Service' }
  ];

  let snippets = store.get(KEY, null);
  if (!snippets) { snippets = SEED; store.set(KEY, snippets); }
  const save = () => store.set(KEY, snippets);

  function mk(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  const expand = t => t
    .replace(/\{date\}/g, new Date().toLocaleDateString('en-CA'))
    .replace(/\{time\}/g, new Date().toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' }))
    .replace(/\{site\}/g, location.hostname)
    .replace(/\{title\}/g, document.title)
    .replace(/\{url\}/g, location.href.split('#')[0]);

  // ---------- target field ----------
  let target = null;
  document.addEventListener('focusin', e => {
    const t = (e.composedPath && e.composedPath()[0]) || e.target;
    if (!t || (t.closest && t.closest('[data-sk]'))) return;
    const editable = t.isContentEditable || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && /^(text|search|)$/i.test(t.type || ''));
    if (editable) target = t;
  }, true);

  function insert(text) {
    const el = target;
    if (!el || !el.isConnected) return false;
    el.focus();
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch {}
    if (!ok && 'value' in el) {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const cur = el.value;
      const s = el.selectionStart == null ? cur.length : el.selectionStart;
      const e2 = el.selectionEnd == null ? cur.length : el.selectionEnd;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, cur.slice(0, s) + text + cur.slice(e2));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      ok = true;
    }
    return ok;
  }

  // ---------- UI ----------
  const panel = mk('div', 'position:fixed;left:12px;right:12px;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;max-width:440px;max-height:75vh;overflow-y:auto;background:#111;color:#fff;border-radius:12px;padding:12px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
  panel.setAttribute('data-sk', '1');
  const status = mk('div', 'font-size:12px;color:#34c759;margin-top:8px;min-height:15px');

  function btn(label, fn, bg) {
    const b = mk('button', 'padding:8px 11px;margin:4px 6px 0 0;border:none;border-radius:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label);
    b.onclick = fn;
    b.addEventListener('mousedown', e => e.preventDefault()); // keep focus in the page's text box
    return b;
  }

  function renderList() {
    panel.textContent = '';
    panel.appendChild(mk('div', 'font-weight:600;margin-bottom:4px', 'Snippets'));
    panel.appendChild(mk('div', 'font-size:11px;color:#8e8e93;margin-bottom:6px', target && target.isConnected ? 'Will insert into the text box you last tapped.' : 'Tap into a text box on the page first.'));
    snippets.forEach(s => {
      const r = mk('div', 'padding:6px 0;border-bottom:1px solid #2c2c2e');
      r.appendChild(mk('div', 'font-weight:600', s.name));
      r.appendChild(mk('div', 'font-size:12px;color:#aaa;white-space:pre-line;max-height:3.6em;overflow:hidden', s.text));
      r.append(
        btn('Insert', () => { status.style.color = insert(expand(s.text)) ? '#34c759' : '#ff9f0a'; status.textContent = insert === null ? '' : (target && target.isConnected ? 'Inserted.' : 'Tap into a text box on the page first.'); }, '#34c759'),
        btn('Edit', () => renderEdit(s))
      );
      panel.appendChild(r);
    });
    panel.append(btn('+ New snippet', () => renderEdit(null), '#0a84ff'), btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30'), status);
  }

  function renderEdit(s) {
    panel.textContent = '';
    const name = mk('input', 'width:100%;box-sizing:border-box;padding:8px;border-radius:6px;border:none;font-size:14px;margin-bottom:6px');
    name.placeholder = 'Name'; name.value = s ? s.name : '';
    const text = mk('textarea', 'width:100%;box-sizing:border-box;height:150px;padding:8px;border-radius:6px;border:none;font-size:14px');
    text.placeholder = 'Text. Variables: {date} {time} {site} {title} {url}'; text.value = s ? s.text : '';
    panel.append(name, text,
      btn('Save', () => {
        if (!name.value.trim() || !text.value.trim()) return;
        if (s) { s.name = name.value.trim(); s.text = text.value; }
        else snippets.push({ id: 's' + Date.now().toString(36), name: name.value.trim(), text: text.value });
        save(); renderList();
      }, '#34c759'),
      s ? btn('Delete', () => { if (confirm('Delete "' + s.name + '"?')) { snippets = snippets.filter(x => x !== s); save(); renderList(); } }, '#5c2020') : mk('span'),
      btn('Cancel', renderList));
  }

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#ff2d55;color:#fff;font:700 11px -apple-system,sans-serif;opacity:.8;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'Txt');
  fab.setAttribute('data-sk', '1');
  fab.title = 'Insert a saved snippet';
  fab.addEventListener('mousedown', e => e.preventDefault()); // don't steal focus from the text box
  fab.onclick = () => { if (panel.style.display === 'none') { renderList(); panel.style.display = 'block'; } else panel.style.display = 'none'; };
  document.documentElement.append(panel, fab);
})();
