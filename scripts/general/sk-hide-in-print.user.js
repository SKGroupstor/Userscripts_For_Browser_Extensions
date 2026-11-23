// ==UserScript==
// @name         SK Hide Buttons When Printing
// @namespace    skgroups
// @version      1.0
// @description  Hides every SK script's floating button, panel and toast when you print or save as PDF, and always hides them on Amazon print-style pages (printable order summary, packing slip, invoice)
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/general/sk-hide-in-print.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/general/sk-hide-in-print.user.js
// ==/UserScript==

// Every SK script marks its UI with data-sk, so this one rule covers all of them
// (Amazon product helper, Canada Post -> Seller Central, glossary, autofill, downloaders, etc.).
// Install it once; it needs no settings.

(function () {
  'use strict';

  let css = '@media print { [data-sk] { display: none !important; visibility: hidden !important; } }';

  // Amazon print-style pages: hide the buttons on screen too, not just in the print output
  const isAmazon = /(^|\.)amazon\.(ca|com)$/i.test(location.hostname);
  if (isAmazon && /print|packing-?slip|invoice/i.test(location.pathname + location.search)) {
    css += ' [data-sk] { display: none !important; }';
  }

  const style = document.createElement('style');
  style.id = 'sk-hide-in-print';
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
})();
