// ==UserScript==
// @name         SK Video Sniffer & Download
// @namespace    skgroups
// @version      1.1
// @description  Watches network requests (fetch, XHR, resource timing, iframes) for video/audio files and stream manifests, and lists them so you can copy or download. DRM-protected streams can't be saved. The button only appears on video playback pages.
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const FILE_RE = /\.(mp4|webm|m4v|mov|mkv|ogv|mp3|m4a|aac|ogg|wav|m3u8|mpd)(?:[?#]|$)/i;
  const SEGMENT_RE = /\.(ts|m4s|cmfv|cmfa)(?:[?#]|$)/i;
  const TYPE_RE = /^(video\/|audio\/|application\/(vnd\.apple\.mpegurl|x-mpegurl|dash\+xml))/i;
  const isTop = window.top === window.self;

  // ----- show the widget only on a real video playback page -----
  // (Network sniffing still runs everywhere, in memory only, so requests made while the page loads aren't missed;
  //  only the button/panel is limited to video pages.) Edit the list if your sites use a different address.
  const VIDEO_URL_PATTERNS = [/view_?video/i, /[?&]viewkey=/i, /\/watch(\/|\?|$)/i, /\/video\/[^/?#]+/i, /\/embed\//i];

  function isVideoPage() {
    const url = location.pathname + location.search;
    if (VIDEO_URL_PATTERNS.some(re => re.test(url))) return true;
    const vw = window.innerWidth || 800;
    const big = el => { const r = el.getBoundingClientRect(); return r.width >= 240 && r.width >= vw * 0.4 && r.height >= 120; };
    if ([...document.querySelectorAll('video')].some(big)) return true;
    return [...document.querySelectorAll('iframe[src*="player" i],iframe[src*="embed" i]')].some(big);
  }

  function abs(u) { try { return new URL(u, location.href).href; } catch { return null; } }

  function report(url, source) {
    const a = abs(url);
    if (!a || a.startsWith('data:') || SEGMENT_RE.test(a)) return;
    if (isTop) add(a, source);
    else { try { window.top.postMessage({ skSniff: a, source }, '*'); } catch {} }
  }

  // --- hooks (run in every frame) ---
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url);
      if (url && FILE_RE.test(url)) report(url, 'fetch');
      return origFetch.apply(this, arguments).then(res => {
        try {
          if (TYPE_RE.test(res.headers.get('content-type') || '')) report(res.url || url, 'fetch');
        } catch {}
        return res;
      });
    };
  }

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    const self = this;
    try {
      if (url && FILE_RE.test(String(url))) report(String(url), 'xhr');
      self.addEventListener('readystatechange', function () {
        if (self.readyState === 2) {
          try {
            if (TYPE_RE.test(self.getResponseHeader('content-type') || '')) report(self.responseURL || String(url), 'xhr');
          } catch {}
        }
      });
    } catch {}
    return origOpen.apply(this, arguments);
  };

  try {
    new PerformanceObserver(list => {
      list.getEntries().forEach(e => {
        if (FILE_RE.test(e.name) || e.initiatorType === 'video' || e.initiatorType === 'audio') report(e.name, 'timing');
      });
    }).observe({ type: 'resource', buffered: true });
  } catch {}

  document.addEventListener('loadstart', e => {
    const t = e.target;
    if (t && (t.tagName === 'VIDEO' || t.tagName === 'AUDIO') && t.currentSrc && !t.currentSrc.startsWith('blob:')) report(t.currentSrc, 'element');
  }, true);

  if (!isTop) return;

  // --- top frame UI ---
  const found = new Map();
  let fab, panel, list, countEl;

  window.addEventListener('message', e => {
    if (e.data && typeof e.data.skSniff === 'string') add(e.data.skSniff, e.data.source + ' (frame)');
  });

  function add(url, source) {
    if (found.has(url)) return;
    found.set(url, source);
    if (countEl) countEl.textContent = found.size;
    if (panel && panel.style.display !== 'none') render();
  }

  function mk(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  function nameFrom(url) {
    try { return decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || 'media').replace(/[\\/:*?"<>|]/g, '_'); } catch { return 'media'; }
  }

  async function save(url, msg) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const total = +r.headers.get('content-length') || 0;
      const reader = r.body.getReader();
      const chunks = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); got += value.length;
        msg.textContent = total ? Math.round(got / total * 100) + '%' : (got / 1048576).toFixed(1) + ' MB';
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(chunks, { type: r.headers.get('content-type') || 'video/mp4' }));
      a.download = nameFrom(url);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      msg.textContent = 'Saved \u2713';
    } catch {
      msg.textContent = 'Blocked by site (CORS) \u2014 opened in a new tab.';
      window.open(url, '_blank');
    }
  }

  function render() {
    list.textContent = '';
    if (!found.size) { list.appendChild(mk('div', 'color:#aaa', 'Nothing yet. Press play on the video, then reopen this panel.')); return; }
    [...found.entries()].forEach(([url, source]) => {
      const manifest = /\.(m3u8|mpd)(?:[?#]|$)/i.test(url);
      const card = mk('div', 'background:#1c1c1e;border-radius:10px;padding:10px;margin-bottom:10px');
      card.appendChild(mk('div', 'font-size:11px;color:#aaa;margin-bottom:4px', (manifest ? 'STREAM MANIFEST' : 'FILE') + ' \u00B7 ' + source));
      card.appendChild(mk('div', 'color:#8ab4ff;word-break:break-all;font-size:12px;margin-bottom:8px', url));
      if (manifest) card.appendChild(mk('div', 'font-size:11px;color:#ff9f0a;margin-bottom:8px', 'Streams are split into segments and can\u2019t be saved as one file here. Copy the URL for a tool like yt-dlp/ffmpeg (DRM-protected streams won\u2019t work).'));
      const msg = mk('span', 'font-size:12px;color:#aaa;margin-left:8px');
      const row = mk('div');
      const b = (label, fn, bg) => { const x = mk('button', 'padding:7px 10px;border:none;border-radius:6px;margin-right:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label); x.onclick = fn; return x; };
      if (!manifest) row.appendChild(b('Download', () => save(url, msg), '#34c759'));
      row.appendChild(b('Copy URL', async () => { try { await navigator.clipboard.writeText(url); msg.textContent = 'Copied'; } catch { msg.textContent = 'Copy failed'; } }));
      row.appendChild(b('Open', () => window.open(url, '_blank')));
      row.appendChild(msg);
      card.appendChild(row);
      list.appendChild(card);
    });
  }

  // Add the widget only while this is a video playback page (re-checked as the page loads / navigates)
  function syncUI() {
    if (!fab) return;
    const on = isVideoPage();
    if (on && !fab.isConnected) document.documentElement.append(fab, panel);
    else if (!on && fab.isConnected) { fab.remove(); panel.remove(); panel.style.display = 'none'; }
  }

  function buildUI() {
    const slot = (window.__skFab = (window.__skFab || 0) + 1);
    fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#111;color:#fff;font:600 11px -apple-system,sans-serif;opacity:.75;box-shadow:0 2px 8px rgba(0,0,0,.4)');
    fab.setAttribute('data-sk', '1');
    fab.append(document.createTextNode('\u25B6 '));
    countEl = mk('span', '', String(found.size));
    fab.appendChild(countEl);

    panel = mk('div', 'position:fixed;inset:0;background:rgba(0,0,0,.94);color:#fff;z-index:2147483646;display:none;flex-direction:column;font:14px -apple-system,sans-serif');
    panel.setAttribute('data-sk', '1');
    const bar = mk('div', 'display:flex;gap:6px;padding:10px;background:#111');
    const clear = mk('button', 'padding:8px 12px;border:none;border-radius:6px;background:#2c2c2e;color:#fff', 'Clear');
    clear.onclick = () => { found.clear(); countEl.textContent = '0'; render(); };
    const close = mk('button', 'padding:8px 12px;border:none;border-radius:6px;background:#ff3b30;color:#fff', 'Close');
    close.onclick = () => { panel.style.display = 'none'; };
    bar.append(mk('div', 'flex:1;align-self:center;font-weight:600', 'Sniffed media'), clear, close);
    list = mk('div', 'flex:1;overflow-y:auto;padding:12px');
    panel.append(bar, list);
    fab.onclick = () => { render(); panel.style.display = 'flex'; };
    syncUI();
    setInterval(syncUI, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();
})();
