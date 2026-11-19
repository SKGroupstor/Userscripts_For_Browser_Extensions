// ==UserScript==
// @name         SK HTML Video Download
// @namespace    skgroups
// @version      1.1
// @description  Lists every <video> on the page and downloads the file with a progress readout. Handles direct files and blob: URLs; tells you when a video is stream-only. The button only appears on video playback pages.
// @match        *://*/*
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  // ----- show the widget only on a real video playback page -----
  // A page counts as a video page if its address matches one of these patterns (tested against path + query),
  // OR it has a large video player on screen. Edit the list if your sites use a different address.
  const VIDEO_URL_PATTERNS = [/view_?video/i, /[?&]viewkey=/i, /\/watch(\/|\?|$)/i, /\/video\/[^/?#]+/i, /\/embed\//i];

  function isVideoPage() {
    const url = location.pathname + location.search;
    if (VIDEO_URL_PATTERNS.some(re => re.test(url))) return true;
    const vw = window.innerWidth || 800;
    const big = el => { const r = el.getBoundingClientRect(); return r.width >= 240 && r.width >= vw * 0.4 && r.height >= 120; };
    if ([...document.querySelectorAll('video')].some(big)) return true;
    return [...document.querySelectorAll('iframe[src*="player" i],iframe[src*="embed" i]')].some(big);
  }

  const slot = (window.__skFab = (window.__skFab || 0) + 1);

  function mk(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  function nameFrom(url, fallback) {
    try {
      const p = new URL(url, location.href).pathname.split('/').filter(Boolean).pop();
      if (p && /\.[a-z0-9]{2,4}$/i.test(p)) return decodeURIComponent(p).replace(/[\\/:*?"<>|]/g, '_');
    } catch {}
    return fallback;
  }

  async function save(url, fallbackName, onProgress) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const total = +r.headers.get('content-length') || 0;
    const reader = r.body && r.body.getReader ? r.body.getReader() : null;
    let blob;
    if (reader) {
      const chunks = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.length;
        onProgress(total ? Math.round(got / total * 100) + '%' : (got / 1048576).toFixed(1) + ' MB');
      }
      blob = new Blob(chunks, { type: r.headers.get('content-type') || 'video/mp4' });
    } else {
      blob = await r.blob();
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nameFrom(url, fallbackName);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }

  function sources() {
    const out = [];
    document.querySelectorAll('video').forEach((v, i) => {
      const urls = new Set();
      if (v.currentSrc) urls.add(v.currentSrc);
      if (v.src) urls.add(v.src);
      v.querySelectorAll('source[src]').forEach(s => urls.add(s.src));
      out.push({ index: i + 1, video: v, urls: [...urls] });
    });
    return out;
  }

  const panel = mk('div', 'position:fixed;inset:0;background:rgba(0,0,0,.94);color:#fff;z-index:2147483646;display:none;flex-direction:column;font:14px -apple-system,sans-serif');
  panel.setAttribute('data-sk', '1');
  const bar = mk('div', 'display:flex;gap:6px;padding:10px;background:#111');
  const list = mk('div', 'flex:1;overflow-y:auto;padding:12px');

  function btn(label, fn, bg) {
    const b = mk('button', 'padding:8px 12px;border:none;border-radius:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label);
    b.onclick = fn; return b;
  }

  function render() {
    list.textContent = '';
    const vids = sources();
    if (!vids.length) { list.appendChild(mk('div', 'color:#aaa', 'No <video> elements on this page. Try the Video Sniffer script, or scroll/play first so the player loads.')); return; }
    vids.forEach(v => {
      const card = mk('div', 'background:#1c1c1e;border-radius:10px;padding:10px;margin-bottom:12px');
      const dur = isFinite(v.video.duration) ? Math.round(v.video.duration) + 's' : 'unknown length';
      card.appendChild(mk('div', 'font-weight:600;margin-bottom:6px', 'Video ' + v.index + ' \u00B7 ' + v.video.videoWidth + '\u00D7' + v.video.videoHeight + ' \u00B7 ' + dur));
      if (!v.urls.length) card.appendChild(mk('div', 'color:#ff9f0a;font-size:12px', 'No source URL exposed (player uses MediaSource). Try the Video Sniffer.'));
      v.urls.forEach(u => {
        const row = mk('div', 'margin:6px 0');
        row.appendChild(mk('div', 'color:#8ab4ff;word-break:break-all;font-size:12px;margin-bottom:6px', u));
        const msg = mk('span', 'font-size:12px;color:#aaa;margin-left:8px');
        const dl = btn('Download', async () => {
          msg.textContent = 'Starting\u2026';
          try { await save(u, 'video-' + v.index + '.mp4', p => { msg.textContent = p; }); msg.textContent = 'Saved \u2713'; }
          catch (e) {
            msg.textContent = /blob:/.test(u) ? 'Stream-only video: cannot be saved directly.' : 'Blocked by the site (CORS). Opening it so you can use Share \u2192 Save.';
            if (!/blob:/.test(u)) window.open(u, '_blank');
          }
        }, '#34c759');
        const cp = btn('Copy URL', async () => { try { await navigator.clipboard.writeText(u); msg.textContent = 'Copied'; } catch { msg.textContent = 'Copy failed'; } });
        row.append(dl, cp, msg);
        card.appendChild(row);
      });
      list.appendChild(card);
    });
  }

  bar.append(btn('Rescan', render, '#0a84ff'), btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30'));
  panel.append(bar, list);

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#111;color:#fff;font:600 11px -apple-system,sans-serif;opacity:.75;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'VID\u2B07');
  fab.setAttribute('data-sk', '1');
  fab.onclick = () => { render(); panel.style.display = 'flex'; };

  // Add the widget only while this is a video playback page (re-checked as the page loads / navigates)
  function syncUI() {
    const on = isVideoPage();
    if (on && !fab.isConnected) document.documentElement.append(fab, panel);
    else if (!on && fab.isConnected) { fab.remove(); panel.remove(); panel.style.display = 'none'; }
  }
  syncUI();
  setInterval(syncUI, 1500);
})();
