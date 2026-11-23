// ==UserScript==
// @name         SK Clean Tracking Links
// @namespace    skgroups
// @version      1.0
// @description  Strips utm_*, fbclid, gclid and other tracking params from the address bar and from links as you click them
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/general/sk-clean-links.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/general/sk-clean-links.user.js
// ==/UserScript==

(function () {
  'use strict';

  const TRACKING = /^(utm_.+|fbclid|gclid|dclid|msclkid|mc_eid|mc_cid|igshid|yclid|_hsenc|_hsmi|ref_src|ref_url|spm|cmpid)$/i;

  function clean(url) {
    try {
      const u = new URL(url, location.href);
      let changed = false;
      [...u.searchParams.keys()].forEach(k => {
        if (TRACKING.test(k)) { u.searchParams.delete(k); changed = true; }
      });
      return changed ? u.href : url;
    } catch {
      return url;
    }
  }

  const cleaned = clean(location.href);
  if (cleaned !== location.href) history.replaceState(null, '', cleaned);

  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const next = clean(a.href);
    if (next !== a.href) a.href = next;
  }, true);
})();
