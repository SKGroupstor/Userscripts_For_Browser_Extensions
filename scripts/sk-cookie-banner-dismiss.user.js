// ==UserScript==
// @name         SK Cookie Banner Decliner
// @namespace    skgroups
// @version      1.0
// @description  Automatically clicks "Reject all / Necessary only" on cookie consent banners (privacy-preserving - never accepts)
// @match        *://*/*
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const KNOWN = [
    '#onetrust-reject-all-handler',
    '#CybotCookiebotDialogBodyButtonDecline',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll',
    '.cc-deny', '.cc-btn.cc-dismiss.cc-deny',
    'button[data-testid="reject-all"]',
    '.fc-cta-do-not-consent',
    '#truste-consent-required',
    '.cookie-reject', '.js-cookie-reject'
  ];
  const REJECT = /^\s*(reject all|reject|decline|decline all|deny|deny all|refuse|only necessary|necessary only|essential only|only essential|use necessary cookies only|reject non-essential|no thanks|continue without accepting)\s*$/i;
  const CONTAINER = /cookie|consent|gdpr|privacy|cmp|onetrust|cookiebot/i;

  function tryDismiss() {
    for (const sel of KNOWN) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) { el.click(); return true; }
    }
    const buttons = document.querySelectorAll('button, [role="button"], a');
    for (const el of buttons) {
      const text = (el.innerText || el.textContent || '').trim();
      if (!text || text.length > 40 || !REJECT.test(text) || !el.offsetParent) continue;
      let p = el.parentElement, hops = 0;
      while (p && hops < 8) {
        if (CONTAINER.test((p.id || '') + ' ' + (typeof p.className === 'string' ? p.className : ''))) {
          el.click();
          return true;
        }
        p = p.parentElement; hops++;
      }
    }
    return false;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (tryDismiss() || tries > 20) clearInterval(timer);
  }, 500);
})();
