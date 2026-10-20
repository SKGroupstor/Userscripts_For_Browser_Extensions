// ==UserScript==
// @name         SK Reader Mode
// @namespace    skgroups
// @version      1.0
// @description  Floating button that shows the main article in a clean, readable overlay
// @match        *://*/*
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const slot = (window.__skFab = (window.__skFab || 0) + 1);

  function findMain() {
    const direct = document.querySelector('article, [role="main"], main');
    if (direct && direct.querySelectorAll('p').length >= 3) return direct;
    let best = null, bestScore = 0;
    document.querySelectorAll('div, section').forEach(el => {
      const score = [...el.children].filter(c => c.tagName === 'P').reduce((n, p) => n + p.innerText.length, 0);
      if (score > bestScore) { bestScore = score; best = el; }
    });
    return best || document.body;
  }

  function open() {
    if (document.getElementById('sk-reader')) return;
    const src = findMain();
    const wrap = document.createElement('div');
    wrap.id = 'sk-reader';
    wrap.setAttribute('data-sk', '1');
    Object.assign(wrap.style, { position: 'fixed', inset: '0', background: '#faf7f0', color: '#222', overflowY: 'auto', zIndex: 2147483646, padding: '24px 16px' });

    const col = document.createElement('div');
    Object.assign(col.style, { maxWidth: '680px', margin: '0 auto', font: '19px/1.7 Georgia, serif' });

    const h = document.createElement('h1');
    h.textContent = document.title;
    h.style.cssText = 'font-size:28px;line-height:1.25;margin:0 0 20px';
    col.appendChild(h);

    src.querySelectorAll('h1,h2,h3,h4,p,li,blockquote,pre,img').forEach(n => {
      if (n.closest('nav, header, footer, aside')) return;
      let el;
      if (n.tagName === 'IMG') {
        if ((n.naturalWidth || 0) < 200) return;
        el = document.createElement('img');
        el.src = n.currentSrc || n.src;
        el.style.cssText = 'max-width:100%;height:auto;display:block;margin:16px 0';
      } else {
        const text = n.innerText.trim();
        if (!text) return;
        el = document.createElement(n.tagName === 'LI' ? 'p' : n.tagName.toLowerCase());
        el.textContent = (n.tagName === 'LI' ? '\u2022 ' : '') + text;
        el.style.margin = '0 0 16px';
        if (n.tagName === 'PRE') el.style.cssText += ';white-space:pre-wrap;font-size:14px;background:#eee;padding:10px;border-radius:6px';
        if (n.tagName === 'BLOCKQUOTE') el.style.cssText += ';border-left:4px solid #bbb;padding-left:14px;color:#555';
      }
      col.appendChild(el);
    });

    const close = document.createElement('button');
    close.textContent = '\u2715';
    Object.assign(close.style, { position: 'fixed', top: '12px', right: '12px', width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: '#111', color: '#fff', font: '18px sans-serif' });
    close.onclick = () => { wrap.remove(); document.documentElement.style.overflow = ''; };

    wrap.appendChild(col);
    wrap.appendChild(close);
    document.documentElement.appendChild(wrap);
    document.documentElement.style.overflow = 'hidden';
  }

  const b = document.createElement('button');
  b.textContent = 'Aa';
  b.title = 'Reader mode';
  b.setAttribute('data-sk', '1');
  Object.assign(b.style, { position: 'fixed', left: '12px', bottom: (12 + 50 * (slot - 1)) + 'px', zIndex: 2147483647, width: '42px', height: '42px', borderRadius: '50%', border: 'none', background: '#111', color: '#fff', font: '600 14px -apple-system,sans-serif', opacity: '.75', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.4)' });
  b.onclick = open;
  document.documentElement.appendChild(b);
})();
