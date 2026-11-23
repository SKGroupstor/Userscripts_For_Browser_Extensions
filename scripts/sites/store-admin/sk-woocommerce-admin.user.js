// ==UserScript==
// @name         SK WooCommerce Admin Helper
// @namespace    skgroups
// @version      1.0
// @description  Quick-nav menu for WooCommerce admin plus one-tap copy of shipping address, billing address and an order summary on order screens
// @match        *://*/wp-admin/*
// @noframes
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/sites/store-admin/sk-woocommerce-admin.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/sites/store-admin/sk-woocommerce-admin.user.js
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  // Only act on sites that actually run WooCommerce
  const hasWoo = document.querySelector('#toplevel_page_woocommerce, #adminmenu a[href*="page=wc-"], #adminmenu a[href*="post_type=shop_order"]');
  if (!hasWoo) return;

  const slot = (window.__skFab = (window.__skFab || 0) + 1);
  const admin = location.origin + '/wp-admin/';

  function mk(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  function toast(msg) {
    const t = mk('div', 'position:fixed;left:50%;bottom:80px;transform:translateX(-50%);background:#111;color:#fff;padding:8px 14px;border-radius:8px;font:14px -apple-system,sans-serif;z-index:2147483647;max-width:80vw;white-space:pre-line', msg);
    t.setAttribute('data-sk', '1');
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), 2400);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const a = document.createElement('textarea');
      a.value = text; a.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove();
    }
  }

  // Orders link differs between HPOS and legacy storage - read it from the real menu
  const ordersLink = (document.querySelector('#adminmenu a[href*="page=wc-orders"], #adminmenu a[href*="post_type=shop_order"]') || {}).href
    || admin + 'edit.php?post_type=shop_order';

  const NAV = [
    ['Orders', ordersLink],
    ['Products', admin + 'edit.php?post_type=product'],
    ['Add product', admin + 'post-new.php?post_type=product'],
    ['Customers', admin + 'admin.php?page=wc-admin&path=/customers'],
    ['Coupons', admin + 'edit.php?post_type=shop_coupon'],
    ['Analytics', admin + 'admin.php?page=wc-admin&path=/analytics/overview'],
    ['Settings', admin + 'admin.php?page=wc-settings'],
    ['Shipping settings', admin + 'admin.php?page=wc-settings&tab=shipping'],
    ['Tax settings', admin + 'admin.php?page=wc-settings&tab=tax'],
    ['System status', admin + 'admin.php?page=wc-status'],
    ['Scheduled actions', admin + 'admin.php?page=wc-status&tab=action-scheduler']
  ];

  // ----- order screen helpers -----
  function columnText(headingWord) {
    const cols = [...document.querySelectorAll('.order_data_column')];
    const col = cols.find(c => (c.querySelector('h3') || {}).textContent && c.querySelector('h3').textContent.toLowerCase().includes(headingWord));
    if (!col) return '';
    const addr = col.querySelector('.address');
    return addr ? addr.innerText.trim() : '';
  }

  function orderSummary() {
    const head = document.querySelector('.woocommerce-order-data__heading, h1.wp-heading-inline');
    const title = head ? head.textContent.replace(/\s+/g, ' ').trim() : document.title;
    const lines = [title, ''];
    document.querySelectorAll('#woocommerce-order-items .woocommerce_order_items tr.item').forEach(tr => {
      const name = (tr.querySelector('.wc-order-item-name') || {}).textContent || '';
      const qty = (tr.querySelector('td.quantity .view') || {}).textContent || '';
      const sku = (tr.querySelector('.wc-order-item-sku') || {}).textContent || '';
      lines.push('- ' + name.replace(/\s+/g, ' ').trim() + (sku ? ' [' + sku.replace(/SKU:\s*/i, '').trim() + ']' : '') + ' ' + qty.replace(/\s+/g, ' ').trim());
    });
    const ship = columnText('shipping');
    if (ship) lines.push('', 'Ship to:', ship);
    return lines.join('\n');
  }

  const onOrder = !!document.querySelector('.order_data_column');

  const ACTIONS = onOrder ? [
    ['Copy shipping address', () => { const t = columnText('shipping') || columnText('billing'); if (!t) return toast('No address found'); copy(t); toast('Shipping address copied'); }],
    ['Copy billing address', () => { const t = columnText('billing'); if (!t) return toast('No address found'); copy(t); toast('Billing address copied'); }],
    ['Copy order summary', () => { copy(orderSummary()); toast('Order summary copied'); }]
  ] : [];

  const menu = mk('div', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;max-height:70vh;overflow-y:auto;background:#111;color:#fff;border-radius:12px;padding:6px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
  menu.setAttribute('data-sk', '1');

  function item(label, fn, accent) {
    const b = mk('button', 'display:block;width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:' + (accent ? '#34c759' : '#fff') + ';font-size:14px', label);
    b.onclick = () => { menu.style.display = 'none'; fn(); };
    menu.appendChild(b);
  }

  ACTIONS.forEach(a => item(a[0], a[1], true));
  NAV.forEach(n => item(n[0], () => { location.href = n[1]; }));

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#7f54b3;color:#fff;font:700 13px -apple-system,sans-serif;opacity:.85;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'Woo');
  fab.setAttribute('data-sk', '1');
  fab.onclick = () => { menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; };
  document.documentElement.append(menu, fab);
})();
