// ==UserScript==
// @name         SK Tracking Number Detector
// @namespace    skgroups
// @version      1.0
// @description  On any page (WooCommerce orders, Seller Central, email, notes): finds Canada Post and FedEx tracking numbers in the page text (or your selection), then opens the carrier's tracking page, or copies the number with no spaces
// @match        *://*/*
// @noframes
// @grant        none
// ==/UserScript==

// Detection is by number pattern, so results are labelled "possible" unless the carrier's name appears nearby.
//  Canada Post: 16 digits (spaces allowed) or two letters + 9 digits + CA
//  FedEx:       12, 15, 20 or 22 digits
// Nothing is changed on the page; the panel only lists what it finds.

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const slot = (window.__skFab = (window.__skFab || 0) + 1);

  const CP_RE = /\b(?:\d{4}[ \u00a0]?){3}\d{4}\b|\b[A-Z]{2}\d{9}CA\b/g;
  const FX_RE = /\b(?:\d{22}|\d{20}|\d{15}|\d{12})\b/g;

  const cpUrl = n => 'https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=' + encodeURIComponent(n);
  const fxUrl = n => 'https://www.fedex.com/fedextrack/?trknbr=' + encodeURIComponent(n) + '&locale=en_CA';

  function mk(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }

  function scan() {
    const sel = (window.getSelection().toString() || '').trim();
    const text = sel || (document.body.innerText || '');
    const found = new Map(); // number -> {carrier, sure}

    const near = (idx, len) => text.slice(Math.max(0, idx - 80), idx + len + 80).toLowerCase();

    let m;
    const cp = new RegExp(CP_RE.source, 'g');
    while ((m = cp.exec(text))) {
      const n = m[0].replace(/[\s\u00a0]/g, '');
      const ctx = near(m.index, m[0].length);
      found.set(n, { carrier: 'Canada Post', sure: /canada ?post|postes canada|\bpin\b/.test(ctx) });
    }
    const fx = new RegExp(FX_RE.source, 'g');
    while ((m = fx.exec(text))) {
      const n = m[0];
      if (found.has(n)) continue;
      const ctx = near(m.index, n.length);
      found.set(n, { carrier: 'FedEx', sure: /fedex|fed ex/.test(ctx) });
    }
    return { list: [...found.entries()].map(([n, v]) => ({ n, carrier: v.carrier, sure: v.sure })).sort((a, b) => (b.sure - a.sure)), fromSelection: !!sel };
  }

  const panel = mk('div', 'position:fixed;left:12px;right:12px;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;max-width:440px;max-height:70vh;overflow-y:auto;background:#111;color:#fff;border-radius:12px;padding:12px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
  panel.setAttribute('data-sk', '1');
  const status = mk('div', 'font-size:12px;color:#34c759;margin-top:8px;min-height:15px');

  function btn(label, fn, bg) {
    const b = mk('button', 'padding:7px 10px;margin:4px 6px 0 0;border:none;border-radius:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label);
    b.onclick = fn;
    return b;
  }

  function render() {
    panel.textContent = '';
    const { list, fromSelection } = scan();
    panel.appendChild(mk('div', 'font-weight:600;margin-bottom:6px', list.length ? list.length + ' possible tracking number' + (list.length > 1 ? 's' : '') + (fromSelection ? ' in your selection' : ' on this page') : 'No tracking numbers found' + (fromSelection ? ' in your selection' : '')));
    list.slice(0, 20).forEach(x => {
      const r = mk('div', 'padding:6px 0;border-bottom:1px solid #2c2c2e');
      r.appendChild(mk('div', 'font-size:12px;color:' + (x.sure ? '#34c759' : '#ff9f0a'), x.carrier + (x.sure ? '' : ' (possible)')));
      r.appendChild(mk('div', 'word-break:break-all;margin:2px 0', x.n));
      r.append(
        btn('Track', () => window.open(x.carrier === 'FedEx' ? fxUrl(x.n) : cpUrl(x.n), '_blank'), '#0a84ff'),
        btn('Copy', async () => { status.textContent = (await copy(x.n)) ? 'Copied ' + x.n : 'Copy failed'; })
      );
      panel.appendChild(r);
    });
    const actions = mk('div', 'margin-top:6px');
    if (list.length) actions.appendChild(btn('Copy all', async () => { status.textContent = (await copy(list.map(x => x.n).join('\n'))) ? 'Copied all' : 'Copy failed'; }));
    actions.appendChild(btn('Rescan', render));
    actions.appendChild(btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30'));
    panel.append(actions, status, mk('div', 'font-size:11px;color:#8e8e93;margin-top:6px', 'Tip: select some text first to scan only that.'));
  }

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#5e5ce6;color:#fff;font:700 11px -apple-system,sans-serif;opacity:.8;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'Pkg');
  fab.setAttribute('data-sk', '1');
  fab.title = 'Find tracking numbers on this page';
  fab.addEventListener('mousedown', e => e.preventDefault()); // keep the user's text selection
  fab.onclick = () => { if (panel.style.display === 'none') { render(); panel.style.display = 'block'; } else panel.style.display = 'none'; };
  document.documentElement.append(panel, fab);
})();
