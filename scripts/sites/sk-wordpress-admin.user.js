// ==UserScript==
// @name         SK WordPress Admin Helper
// @namespace    skgroups
// @version      1.0
// @description  Quick-nav menu, Ctrl/Cmd+S to save in the classic editor and WooCommerce product screens, collapsible admin notices, and "Remember Me" ticked on the login page
// @match        *://*/wp-admin/*
// @match        *://*/wp-login.php*
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  // Login page: tick "Remember Me" only (never touches credentials)
  if (location.pathname.endsWith('wp-login.php')) {
    const box = document.getElementById('rememberme');
    if (box) box.checked = true;
    return;
  }

  if (!document.getElementById('adminmenu')) return; // not a real WP admin screen

  const slot = (window.__skFab = (window.__skFab || 0) + 1);
  const admin = location.origin + '/wp-admin/';

  function mk(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  function toast(msg) {
    const t = mk('div', 'position:fixed;left:50%;bottom:80px;transform:translateX(-50%);background:#111;color:#fff;padding:8px 14px;border-radius:8px;font:14px -apple-system,sans-serif;z-index:2147483647', msg);
    t.setAttribute('data-sk', '1');
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }

  const NAV = [
    ['Dashboard', 'index.php'],
    ['Posts', 'edit.php'],
    ['Add post', 'post-new.php'],
    ['Pages', 'edit.php?post_type=page'],
    ['Add page', 'post-new.php?post_type=page'],
    ['Media', 'upload.php'],
    ['Plugins', 'plugins.php'],
    ['Themes', 'themes.php'],
    ['Users', 'users.php'],
    ['Updates', 'update-core.php'],
    ['Site Health', 'site-health.php'],
    ['General settings', 'options-general.php'],
    ['Permalinks', 'options-permalink.php'],
    ['Tools', 'tools.php']
  ];

  const menu = mk('div', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;max-height:70vh;overflow-y:auto;background:#111;color:#fff;border-radius:12px;padding:6px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
  menu.setAttribute('data-sk', '1');

  NAV.forEach(([label, path]) => {
    const b = mk('button', 'display:block;width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:#fff;font-size:14px', label);
    b.onclick = () => { location.href = admin + path; };
    menu.appendChild(b);
  });

  // Collapsible notices (hides info/warning/promo notices, keeps errors and success messages visible)
  const style = mk('style');
  style.textContent = 'html.sk-hide-notices .notice:not(.notice-error):not(.notice-success):not(.updated):not(.error), html.sk-hide-notices .update-nag { display:none !important; }';
  document.head.appendChild(style);
  const noticeCount = document.querySelectorAll('.notice:not(.notice-error):not(.notice-success):not(.updated):not(.error), .update-nag').length;

  if (noticeCount) {
    const hid = (() => { try { return localStorage.getItem('sk_wp_hide_notices') === '1'; } catch { return false; } })();
    if (hid) document.documentElement.classList.add('sk-hide-notices');
    const b = mk('button', 'display:block;width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:#ff9f0a;font-size:14px', 'Toggle notices (' + noticeCount + ')');
    b.onclick = () => {
      const on = document.documentElement.classList.toggle('sk-hide-notices');
      try { localStorage.setItem('sk_wp_hide_notices', on ? '1' : '0'); } catch {}
      menu.style.display = 'none';
    };
    menu.insertBefore(b, menu.firstChild);
  }

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#2271b1;color:#fff;font:700 16px -apple-system,sans-serif;opacity:.85;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'W');
  fab.setAttribute('data-sk', '1');
  fab.onclick = () => { menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; };
  document.documentElement.append(menu, fab);

  // Ctrl/Cmd+S -> Publish/Update/Save Draft on classic editor and WooCommerce product/coupon screens
  document.addEventListener('keydown', e => {
    if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) return;
    const btn = document.querySelector('#publish, #save-post, input[name="save"].button-primary');
    if (!btn) return;
    e.preventDefault();
    btn.click();
    toast('Saving\u2026');
  });
})();
