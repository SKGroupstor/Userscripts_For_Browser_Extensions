// ==UserScript==
// @name         SK Canada Post Helper
// @namespace    skgroups
// @version      1.0
// @description  On Canada Post: paste or scan tracking numbers and open each one, plus a postal code formatter/validator (A1A 1A1)
// @match        *://*.canadapost-postescanada.ca/*
// @match        *://*.canadapost.ca/*
// @noframes
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/sites/shipping/sk-canadapost-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/sites/shipping/sk-canadapost-helper.user.js
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const slot = (window.__skFab = (window.__skFab || 0) + 1);
  // 16-digit PINs and international-style numbers like AB123456789CA
  const PIN_RE = /\b(?:\d{16}|[A-Z]{2}\d{9}[A-Z]{2})\b/g;
  const POSTAL_RE = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/;

  function mk(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  const parse = s => [...new Set((s.toUpperCase().match(PIN_RE) || []))];
  const trackUrl = n => 'https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=' + encodeURIComponent(n);

  function fmtPostal(s) {
    const c = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return POSTAL_RE.test(c) ? c.slice(0, 3) + ' ' + c.slice(3) : '';
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }

  function btn(label, fn, bg) {
    const b = mk('button', 'padding:8px 10px;margin:4px 6px 0 0;border:none;border-radius:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label);
    b.onclick = fn; return b;
  }

  const panel = mk('div', 'position:fixed;left:12px;right:12px;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;max-width:420px;max-height:75vh;overflow-y:auto;background:#111;color:#fff;border-radius:12px;padding:12px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
  panel.setAttribute('data-sk', '1');

  panel.appendChild(mk('div', 'font-weight:600;margin-bottom:6px', 'Tracking'));
  const ta = mk('textarea', 'width:100%;box-sizing:border-box;height:70px;border-radius:8px;border:none;padding:8px;font-size:14px');
  ta.placeholder = 'Paste tracking numbers';
  const links = mk('div', 'margin-top:6px');
  const info = mk('div', 'font-size:12px;color:#aaa;margin:6px 0;min-height:14px');

  function showLinks() {
    const nums = parse(ta.value);
    links.textContent = '';
    nums.forEach(n => {
      const a = mk('a', 'display:block;color:#8ab4ff;padding:4px 0;font-size:13px', 'Track ' + n);
      a.href = trackUrl(n); a.target = '_blank'; a.rel = 'noopener';
      links.appendChild(a);
    });
    info.textContent = nums.length + ' valid number(s)';
  }
  ta.addEventListener('input', showLinks);

  const tw = mk('div');
  tw.append(
    btn('Scan page', () => { ta.value = parse(document.body.innerText || '').join('\n'); showLinks(); }),
    btn('Copy list', async () => { info.textContent = (await copy(parse(ta.value).join('\n'))) ? 'Copied' : 'Copy failed'; })
  );

  panel.append(ta, info, tw, links);

  panel.appendChild(mk('div', 'font-weight:600;margin:14px 0 6px', 'Postal code'));
  const pc = mk('input', 'width:100%;box-sizing:border-box;border-radius:8px;border:none;padding:8px;font-size:14px');
  pc.placeholder = 'e.g. m1x0b5';
  const pcOut = mk('div', 'font-size:13px;margin:6px 0;min-height:16px');
  pc.addEventListener('input', () => {
    const f = fmtPostal(pc.value);
    pcOut.textContent = pc.value.trim() ? (f ? 'Valid format: ' + f : 'Not a valid Canadian postal code') : '';
    pcOut.style.color = f ? '#34c759' : '#ff9f0a';
  });
  const pcBtns = mk('div');
  pcBtns.append(btn('Copy formatted', async () => { const f = fmtPostal(pc.value); if (f) pcOut.textContent = (await copy(f)) ? 'Copied ' + f : 'Copy failed'; }));
  panel.append(pc, pcOut, pcBtns, btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30'));

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#da291c;color:#fff;font:700 11px -apple-system,sans-serif;opacity:.9;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'CP');
  fab.setAttribute('data-sk', '1');
  fab.onclick = () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; };
  document.documentElement.append(panel, fab);
})();
