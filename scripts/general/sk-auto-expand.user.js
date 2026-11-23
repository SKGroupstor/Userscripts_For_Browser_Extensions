// ==UserScript==
// @name         SK Auto Expand "Read More"
// @namespace    skgroups
// @version      1.0
// @description  Automatically clicks "Read more / Show more / See more" buttons so full content is visible (capped to avoid loops)
// @match        *://*/*
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const LABEL = /^\s*(read more|show more|see more|view more|show all|expand|more details|continue reading)\s*[\u2026.\u25BE\u25BC]*\s*$/i;
  const done = new WeakSet();
  let clicks = 0;
  const MAX_CLICKS = 25;

  function sweep() {
    if (clicks >= MAX_CLICKS) return;
    document.querySelectorAll('button, [role="button"], a, span, summary').forEach(el => {
      if (clicks >= MAX_CLICKS || done.has(el)) return;
      const text = (el.innerText || el.textContent || '').trim();
      if (!text || text.length > 30 || !LABEL.test(text)) return;
      if (el.tagName === 'A') {
        const href = el.getAttribute('href') || '';
        if (href && href !== '#' && !href.startsWith('javascript:')) return;
      }
      if (!el.offsetParent) return;
      done.add(el);
      clicks++;
      try { el.click(); } catch {}
    });
  }

  let timer;
  const obs = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(sweep, 400); });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(sweep, 800);
  setTimeout(() => obs.disconnect(), 20000);
})();
