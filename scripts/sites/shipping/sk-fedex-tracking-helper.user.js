// ==UserScript==
// @name         SK FedEx Tracking Helper
// @namespace    skgroups
// @version      1.0
// @description  On fedex.com: paste or scan tracking numbers, track many at once in one tap, copy the list, and keep your last 15 numbers handy
// @match        *://*.fedex.com/*
// @noframes
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/sites/shipping/sk-fedex-tracking-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/sites/shipping/sk-fedex-tracking-helper.user.js
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const slot = (window.__skFab = (window.__skFab || 0) + 1);
  const KEY = 'sk_fedex_recent';
  const NUM_RE = /\b(?:\d{12}|\d{15}|\d{20}|\d{22})\b/g;

  function mk(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  const recent = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const saveRecent = nums => {
    try {
      const merged = [...new Set([...nums, ...recent()])].slice(0, 15);
      localStorage.setItem(KEY, JSON.stringify(merged));
    } catch {}
  };

  const parse = s => [...new Set((s.match(NUM_RE) || []))];

  const panel = mk('div', 'position:fixed;left:12px;right:12px;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;max-width:420px;background:#111;color:#fff;border-radius:12px;padding:12px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
  panel.setAttribute('data-sk', '1');

  const ta = mk('textarea', 'width:100%;box-sizing:border-box;height:90px;border-radius:8px;border:none;padding:8px;font-size:14px');
  ta.placeholder = 'Paste tracking numbers (any separators)';
  const info = mk('div', 'font-size:12px;color:#aaa;margin:6px 0;min-height:14px');
  const recentBox = mk('div', 'font-size:12px;color:#8ab4ff;margin-top:8px;word-break:break-all');

  function btn(label, fn, bg) {
    const b = mk('button', 'padding:8px 10px;margin:4px 6px 0 0;border:none;border-radius:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label);
    b.onclick = fn; return b;
  }

  function refreshRecent() {
    const r = recent();
    recentBox.textContent = r.length ? 'Recent: ' + r.join(', ') : '';
  }

  const wrap = mk('div');
  wrap.append(
    btn('Track', () => {
      const nums = parse(ta.value);
      if (!nums.length) { info.textContent = 'No valid FedEx tracking numbers found (12, 15, 20 or 22 digits).'; return; }
      saveRecent(nums);
      refreshRecent();
      location.href = 'https://www.fedex.com/fedextrack/?trknbr=' + encodeURIComponent(nums.slice(0, 30).join(',')) + '&locale=en_CA';
    }, '#4d148c'),
    btn('Scan page', () => {
      const nums = parse(document.body.innerText || '');
      ta.value = nums.join('\n');
      info.textContent = nums.length + ' number(s) found on this page.';
    }),
    btn('Use recent', () => { ta.value = recent().join('\n'); info.textContent = 'Loaded recent numbers.'; }),
    btn('Copy list', async () => {
      const nums = parse(ta.value);
      try { await navigator.clipboard.writeText(nums.join('\n')); info.textContent = 'Copied ' + nums.length + ' number(s).'; } catch { info.textContent = 'Copy failed.'; }
    }),
    btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30')
  );

  ta.addEventListener('input', () => { info.textContent = parse(ta.value).length + ' valid number(s)'; });
  panel.append(ta, info, wrap, recentBox);

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#4d148c;color:#fff;font:700 11px -apple-system,sans-serif;opacity:.9;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'Trk');
  fab.setAttribute('data-sk', '1');
  fab.onclick = () => {
    if (panel.style.display === 'none') { refreshRecent(); panel.style.display = 'block'; } else panel.style.display = 'none';
  };
  document.documentElement.append(panel, fab);
})();
