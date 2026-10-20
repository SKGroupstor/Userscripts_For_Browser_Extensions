// ==UserScript==
// @name         SK Video Scraper & Downloader (Page + Whole Site)
// @namespace    skgroups
// @version      1.0
// @description  Find video files on this page, or crawl the whole site (same domain only, polite, capped). Copy URLs or download.
// @match        *://*/*
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const CFG = {
    label: 'Videos',
    icon: 'VID',
    exts: ['mp4', 'webm', 'm4v', 'mov', 'mkv', 'ogv', 'avi', 'flv', 'm3u8', 'mpd'],
    noDownload: /\.(m3u8|mpd)(?:[?#]|$)/i, // streaming manifests can't be saved as a single file
    usePerf: true,
    transform: null,
    extract(doc, base, out) {
      const add = u => { const a = abs(u, base); if (a) out.add(a); };
      doc.querySelectorAll('video[src], source[src], [data-video-src], [data-mp4], [data-webm]').forEach(el => {
        ['src', 'data-video-src', 'data-mp4', 'data-webm'].forEach(k => { const v = el.getAttribute(k); if (v) add(v); });
      });
      doc.querySelectorAll('meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"], meta[name="twitter:player:stream"]').forEach(m => {
        const v = m.getAttribute('content'); if (v) add(v);
      });
      doc.querySelectorAll('a[href]').forEach(a => { const h = a.getAttribute('href'); if (h && EXT_RE.test(h)) add(h); });
      if (doc === document) {
        document.querySelectorAll('video').forEach(v => { if (v.currentSrc && !v.currentSrc.startsWith('blob:')) add(v.currentSrc); });
      }
    }
  };

  // ---------- shared engine ----------
  const slot = (window.__skFab = (window.__skFab || 0) + 1);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const EXT = CFG.exts.join('|');
  const EXT_RE = new RegExp('\\.(?:' + EXT + ')(?:[?#]|$)', 'i');
  const SCAN_RE = new RegExp('(?:https?:)?//[^\\s\'"<>()\\\\]+?\\.(?:' + EXT + ')(?:\\?[^\\s\'"<>()\\\\]*)?(?=[\\s\'"<>()\\\\]|$)', 'gi');
  const SKIP_PATH = /(logout|log-out|signout|sign-out|wp-admin|wp-login|add-to-cart|add_to_cart|checkout|\/cart|remove_item|delete|unsubscribe|\/feed\/?$)/i;
  const FILE_EXT = /\.(pdf|zip|rar|7z|jpe?g|png|gif|webp|avif|svg|mp4|webm|mov|m4v|docx?|xlsx?|pptx?|css|js|json|xml|ico|mp3|csv|txt)$/i;

  function abs(u, base) {
    try { return new URL(String(u).trim(), base).href; } catch { return null; }
  }

  function scanText(text, base, out) {
    const t = text.replace(/\\\//g, '/');
    SCAN_RE.lastIndex = 0;
    let m;
    while ((m = SCAN_RE.exec(t))) { const a = abs(m[0], base); if (a) out.add(a); }
  }

  function pageScan() {
    const out = new Set();
    CFG.extract(document, location.href, out);
    scanText(document.documentElement.innerHTML, location.href, out);
    if (CFG.usePerf) performance.getEntriesByType('resource').forEach(e => { if (EXT_RE.test(e.name)) out.add(e.name); });
    return out;
  }

  async function getRobots() {
    const dis = [];
    try {
      const r = await fetch('/robots.txt', { credentials: 'omit' });
      if (!r.ok) return dis;
      let applies = false;
      (await r.text()).split(/\r?\n/).forEach(line => {
        const l = line.split('#')[0].trim();
        const i = l.indexOf(':');
        if (i < 0) return;
        const k = l.slice(0, i).trim().toLowerCase(), v = l.slice(i + 1).trim();
        if (k === 'user-agent') applies = v === '*';
        else if (applies && k === 'disallow' && v && !/[*$]/.test(v)) dis.push(v);
      });
    } catch {}
    return dis;
  }

  async function sitemapSeeds(limit) {
    const urls = [];
    const tried = new Set();
    async function load(u, depth) {
      if (tried.has(u) || tried.size > 8 || urls.length >= limit) return;
      tried.add(u);
      try {
        const r = await fetch(u, { credentials: 'omit' });
        if (!r.ok) return;
        const txt = await r.text();
        const locs = [...txt.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]);
        for (const l of locs) {
          if (urls.length >= limit) break;
          if (/\.xml(\.gz)?$/i.test(l) && depth < 1) await load(l, depth + 1);
          else if (!/\.xml/i.test(l)) urls.push(l);
        }
      } catch {}
    }
    for (const p of ['/sitemap.xml', '/wp-sitemap.xml', '/sitemap_index.xml']) { await load(location.origin + p, 0); if (urls.length) break; }
    return urls;
  }

  let stopFlag = false;

  async function crawl(maxPages, progress) {
    const origin = location.origin;
    const disallow = await getRobots();
    const blocked = p => disallow.some(d => p.startsWith(d));
    const found = new Map();
    pageScan().forEach(u => found.set(u, location.href));

    const seen = new Set([location.href.split('#')[0]]);
    const queue = [location.href.split('#')[0]];
    (await sitemapSeeds(maxPages * 2)).forEach(u => {
      const a = abs(u, origin);
      if (a && a.startsWith(origin) && !seen.has(a)) { seen.add(a); queue.push(a); }
    });

    let pages = 0;
    while (queue.length && pages < maxPages && !stopFlag) {
      const url = queue.shift();
      let html;
      try {
        const r = await fetch(url, { credentials: 'same-origin' });
        if (!r.ok || !(r.headers.get('content-type') || '').includes('text/html')) continue;
        html = await r.text();
      } catch { continue; }
      pages++;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const urls = new Set();
      CFG.extract(doc, url, urls);
      scanText(html, url, urls);
      urls.forEach(u => { if (!found.has(u)) found.set(u, url); });

      doc.querySelectorAll('a[href]').forEach(a => {
        const link = abs(a.getAttribute('href'), url);
        if (!link) return;
        let u;
        try { u = new URL(link); } catch { return; }
        if (u.origin !== origin) return;
        u.hash = '';
        const n = u.href;
        if (seen.has(n) || SKIP_PATH.test(u.pathname + u.search) || FILE_EXT.test(u.pathname) || blocked(u.pathname)) return;
        seen.add(n);
        queue.push(n);
      });
      progress(pages, maxPages, queue.length, found.size);
      await sleep(300);
    }
    return found;
  }

  function nameFrom(url) {
    try {
      const p = new URL(url).pathname.split('/').filter(Boolean).pop() || 'file';
      return decodeURIComponent(p).replace(/[\\/:*?"<>|]/g, '_');
    } catch { return 'file'; }
  }

  async function download(url) {
    if (CFG.noDownload && CFG.noDownload.test(url)) { window.open(url, '_blank'); return false; }
    try {
      const r = await fetch(url, { credentials: 'omit' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nameFrom(url);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      return true;
    } catch {
      // Cross-origin without CORS: let the browser handle it directly
      const a = document.createElement('a');
      a.href = url; a.download = nameFrom(url); a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      return false;
    }
  }

  // ---------- UI ----------
  function mk(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  let items = [];
  let lastMap = new Map();
  let busy = false;

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#111;color:#fff;font:600 11px -apple-system,sans-serif;opacity:.75;box-shadow:0 2px 8px rgba(0,0,0,.4)', CFG.icon);
  fab.setAttribute('data-sk', '1');
  fab.title = CFG.label + ' scraper';

  const panel = mk('div', 'position:fixed;inset:0;background:rgba(0,0,0,.94);color:#fff;z-index:2147483646;display:none;flex-direction:column;font:14px -apple-system,sans-serif');
  panel.setAttribute('data-sk', '1');
  const bar = mk('div', 'display:flex;flex-wrap:wrap;gap:6px;padding:10px;background:#111');
  const status = mk('div', 'padding:6px 12px;font-size:12px;color:#aaa', 'Ready');
  const filter = mk('input', 'margin:0 12px 6px;padding:8px;border-radius:6px;border:none;font-size:14px');
  filter.placeholder = 'Filter (e.g. .mp4, thumbnail, cdn)';
  const opts = mk('div', 'padding:0 12px 6px;font-size:12px;color:#ccc');
  const list = mk('div', 'flex:1;overflow-y:auto;padding:0 12px 20px');
  const count = mk('div', 'padding:0 12px 6px;font-size:12px;color:#aaa');

  function btn(label, fn, bg) {
    const b = mk('button', 'padding:8px 10px;border:none;border-radius:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label);
    b.onclick = fn; bar.appendChild(b); return b;
  }

  let chk = null;
  if (CFG.transform) {
    const lab = mk('label');
    chk = mk('input'); chk.type = 'checkbox'; chk.checked = true;
    chk.onchange = () => setItems(lastMap);
    lab.append(chk, document.createTextNode(' Full-size (strip -300x300 style suffixes)'));
    opts.appendChild(lab);
  }

  function setItems(map) {
    lastMap = map;
    const useT = CFG.transform && chk && chk.checked;
    const seen = new Set();
    items = [];
    map.forEach((page, u) => {
      const x = useT ? CFG.transform(u) : u;
      if (!seen.has(x)) { seen.add(x); items.push({ url: x, page }); }
    });
    render();
  }

  function render() {
    const q = filter.value.trim().toLowerCase();
    const shown = items.filter(i => !q || i.url.toLowerCase().includes(q));
    list.textContent = '';
    shown.slice(0, 400).forEach(i => {
      const row = mk('div', 'display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #333');
      const a = mk('a', 'flex:1;color:#8ab4ff;word-break:break-all;font-size:12px', i.url);
      a.href = i.url; a.target = '_blank'; a.rel = 'noopener';
      const d = mk('button', 'padding:6px 10px;border:none;border-radius:6px;background:#2c2c2e;color:#fff', '\u2B07');
      d.onclick = async () => { d.textContent = '\u2026'; const ok = await download(i.url); d.textContent = ok ? '\u2713' : '\u2197'; };
      row.append(a, d);
      list.appendChild(row);
    });
    count.textContent = shown.length + ' of ' + items.length + ' ' + CFG.label.toLowerCase() + (shown.length > 400 ? ' (showing first 400)' : '');
  }
  filter.oninput = render;

  btn('This page', () => {
    if (busy) return;
    setItems(new Map([...pageScan()].map(u => [u, location.href])));
    status.textContent = 'Scanned this page.';
  }, '#0a84ff');

  btn('Whole site', async () => {
    if (busy) return;
    const n = parseInt(prompt('Crawl up to how many pages on ' + location.hostname + '? (same domain only)', '40'), 10);
    if (!n || n < 1) return;
    busy = true; stopFlag = false;
    try {
      const map = await crawl(Math.min(n, 300), (p, m, q, f) => { status.textContent = 'Crawled ' + p + '/' + m + ' pages \u00B7 ' + q + ' queued \u00B7 ' + f + ' found'; });
      setItems(map);
      status.textContent = (stopFlag ? 'Stopped. ' : 'Done. ') + map.size + ' found.';
    } finally { busy = false; }
  }, '#0a84ff');

  btn('Stop', () => { stopFlag = true; });

  btn('Copy', async () => {
    const text = items.map(i => i.url).join('\n');
    try { await navigator.clipboard.writeText(text); status.textContent = 'Copied ' + items.length + ' URLs.'; }
    catch { status.textContent = 'Copy failed (clipboard blocked).'; }
  });

  btn('Download all', async () => {
    const todo = items.filter(i => !(CFG.noDownload && CFG.noDownload.test(i.url)));
    if (!todo.length) return alert('Nothing downloadable.');
    if (!confirm('Download ' + todo.length + ' files one by one?')) return;
    for (let i = 0; i < todo.length; i++) {
      status.textContent = 'Downloading ' + (i + 1) + '/' + todo.length + '\u2026';
      await download(todo[i].url);
      await sleep(700);
    }
    status.textContent = 'Finished ' + todo.length + ' downloads.';
  }, '#34c759');

  btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30');

  panel.append(bar, status, filter, opts, count, list);
  fab.onclick = () => { panel.style.display = 'flex'; };
  document.documentElement.append(fab, panel);
})();
