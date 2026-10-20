// ==UserScript==
// @name         SK Image Grabber
// @namespace    skgroups
// @version      1.0
// @description  Lists every sizeable image on the page in a gallery; tap to open full-size, or copy all image URLs
// @match        *://*/*
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const slot = (window.__skFab = (window.__skFab || 0) + 1);

  function collect() {
    const seen = new Set();
    const out = [];
    document.querySelectorAll('img').forEach(img => {
      const url = img.currentSrc || img.src;
      if (!url || url.startsWith('data:') || seen.has(url)) return;
      if ((img.naturalWidth || 0) < 150 || (img.naturalHeight || 0) < 150) return;
      seen.add(url);
      out.push({ url, w: img.naturalWidth, h: img.naturalHeight });
    });
    return out;
  }

  function open() {
    if (document.getElementById('sk-grabber')) return;
    const imgs = collect();
    const wrap = document.createElement('div');
    wrap.id = 'sk-grabber';
    wrap.setAttribute('data-sk', '1');
    Object.assign(wrap.style, { position: 'fixed', inset: '0', background: 'rgba(0,0,0,.92)', color: '#fff', overflowY: 'auto', zIndex: 2147483646, padding: '60px 12px 20px', font: '14px -apple-system,sans-serif' });

    const bar = document.createElement('div');
    Object.assign(bar.style, { position: 'fixed', top: '0', left: '0', right: '0', padding: '10px 12px', background: '#111', display: 'flex', gap: '8px', alignItems: 'center', zIndex: 1 });
    const title = document.createElement('span');
    title.textContent = imgs.length + ' images';
    title.style.flex = '1';
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy URLs';
    copyBtn.onclick = async () => {
      const text = imgs.map(i => i.url).join('\n');
      try { await navigator.clipboard.writeText(text); copyBtn.textContent = 'Copied'; } catch { copyBtn.textContent = 'Copy failed'; }
    };
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.onclick = () => wrap.remove();
    [copyBtn, closeBtn].forEach(x => Object.assign(x.style, { padding: '8px 12px', border: 'none', borderRadius: '6px' }));
    bar.append(title, copyBtn, closeBtn);

    const grid = document.createElement('div');
    Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: '8px' });
    imgs.forEach(i => {
      const a = document.createElement('a');
      a.href = i.url; a.target = '_blank'; a.rel = 'noopener';
      a.style.cssText = 'color:#ccc;text-decoration:none;font-size:11px';
      const t = document.createElement('img');
      t.src = i.url;
      t.style.cssText = 'width:100%;height:110px;object-fit:cover;border-radius:6px;display:block';
      const cap = document.createElement('div');
      cap.textContent = i.w + '\u00D7' + i.h;
      a.append(t, cap);
      grid.appendChild(a);
    });

    wrap.append(bar, grid);
    document.documentElement.appendChild(wrap);
  }

  const b = document.createElement('button');
  b.textContent = 'IMG';
  b.title = 'Image grabber';
  b.setAttribute('data-sk', '1');
  Object.assign(b.style, { position: 'fixed', left: '12px', bottom: (12 + 50 * (slot - 1)) + 'px', zIndex: 2147483647, width: '42px', height: '42px', borderRadius: '50%', border: 'none', background: '#111', color: '#fff', font: '600 12px -apple-system,sans-serif', opacity: '.75', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.4)' });
  b.onclick = open;
  document.documentElement.appendChild(b);
})();
