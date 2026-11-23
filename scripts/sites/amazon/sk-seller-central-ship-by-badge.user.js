// ==UserScript==
// @name         SK Seller Central Ship By Badge
// @namespace    skgroups
// @version      1.0
// @description  Shows a colour-coded badge at the top of Seller Central order pages with the earliest "Ship by" date and how many days are left (red = overdue/today, orange = tomorrow)
// @match        *://sellercentral.amazon.ca/orders-v3/*
// @match        *://sellercentral.amazon.com/orders-v3/*
// @noframes
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/sites/amazon/sk-seller-central-ship-by-badge.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/sites/amazon/sk-seller-central-ship-by-badge.user.js
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const SHIP_RE = /Ship by:?\s*(?:[A-Za-z]{3},?\s*)?([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})/gi;

  const badge = document.createElement('div');
  badge.setAttribute('data-sk', '1');
  badge.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);padding:6px 14px;border-radius:999px;font:600 13px -apple-system,sans-serif;color:#fff;z-index:2147483645;display:none;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none';
  document.documentElement.appendChild(badge);

  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  function update() {
    const text = document.body ? (document.body.innerText || '') : '';
    const dates = [];
    let m;
    SHIP_RE.lastIndex = 0;
    while ((m = SHIP_RE.exec(text))) {
      const d = new Date(m[1].replace(/\./g, '').replace(/\s+/g, ' '));
      if (!isNaN(d)) dates.push(startOfDay(d));
    }
    if (!dates.length) { badge.style.display = 'none'; return; }

    dates.sort((a, b) => a - b);
    const earliest = dates[0];
    const days = Math.round((earliest - startOfDay(new Date())) / 86400000);
    const overdue = dates.filter(d => d < startOfDay(new Date())).length;

    let label, color;
    if (days < 0) { label = 'OVERDUE by ' + (-days) + ' day' + (days === -1 ? '' : 's'); color = '#d32f2f'; }
    else if (days === 0) { label = 'Ship TODAY'; color = '#d32f2f'; }
    else if (days === 1) { label = 'Ship by tomorrow'; color = '#ef6c00'; }
    else { label = 'Ship by in ' + days + ' days'; color = '#2e7d32'; }

    const dateText = earliest.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
    badge.textContent = label + ' \u00B7 ' + dateText + (dates.length > 1 ? ' (earliest of ' + dates.length + (overdue ? ', ' + overdue + ' overdue' : '') + ')' : '');
    badge.style.background = color;
    badge.style.display = 'block';
  }

  let timer = null;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(update, 1200); };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  update();
  setInterval(update, 60000);
})();
