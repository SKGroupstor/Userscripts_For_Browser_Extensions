// ==UserScript==
// @name         SK Canada Post Label PDF to Tracking No
// @namespace    skgroups
// @version      1.1
// @description  On a Canada Post label that opens as a PDF, reads the tracking number (PIN) from the PDF, removes the spaces and copies it to the clipboard, ready to paste into Seller Central
// @match        *://est-oee.canadapost-postescanada.ca/*
// @match        *://*.canadapost-postescanada.ca/esto-oee/*
// @noframes
// @require      https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js
// @resource     pdfWorker https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js
// @grant        GM_getResourceText
// @grant        unsafeWindow
// ==/UserScript==

// HOW TO USE
//  1. Open the Canada Post label (the PDF page) and tap the red "PDF#" button (bottom left).
//  2. The tracking number is copied to your clipboard with all spaces removed.
//  3. On Seller Central's Confirm Shipment page: tap "Trk" -> "Paste clipboard (no spaces)",
//     or just paste straight into the Tracking ID field (spaces are stripped automatically
//     by the sk-canadapost-to-seller-central script).
//
// NOTES
//  - The PDF reader (pdf.js) is downloaded by your userscript manager when you install this script.
//  - Reads only the label you have open. Nothing is sent anywhere.
//  - If the number can't be read, select it in the PDF and copy it manually instead.
//  - v1.1: renamed without special characters ("->" and "#") so cloud sync file names are accepted.

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const slot = (W.__skFab = (W.__skFab || 0) + 1);

  // 16-digit PIN (optionally grouped "1234 5678 9012 3456") or international style AB123456789CA
  const PIN_RE = /\b(?:\d{4}[ \u00a0]?){3}\d{4}\b|\b[A-Z]{2}\d{9}CA\b/g;
  const norm = s => String(s == null ? '' : s).replace(/[\s\u00a0\u200b-\u200f]/g, '').toUpperCase();

  function mk(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  function toast(msg, ms) {
    const t = mk('div', 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#111;color:#fff;padding:9px 14px;border-radius:8px;font:14px -apple-system,sans-serif;z-index:2147483647;max-width:85vw;text-align:center;white-space:pre-line', msg);
    t.setAttribute('data-sk', '1');
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), ms || 4500);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const a = document.createElement('textarea');
      a.value = text; a.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(a); a.select();
      const ok = document.execCommand('copy'); a.remove(); return ok;
    }
  }

  function getLib() {
    if (typeof pdfjsLib !== 'undefined') return pdfjsLib;
    return W.pdfjsLib || window.pdfjsLib || null;
  }

  function setupWorker(lib) {
    try {
      const code = typeof GM_getResourceText === 'function' ? GM_getResourceText('pdfWorker') : '';
      if (code) lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    } catch {}
  }

  async function readPins() {
    const lib = getLib();
    if (!lib) throw new Error('The PDF reader did not load. Reinstall the script with an internet connection.');
    setupWorker(lib);

    const res = await fetch(location.href, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Could not load the label (HTTP ' + res.status + ').');
    const data = new Uint8Array(await res.arrayBuffer());

    const pdf = await lib.getDocument({ data }).promise;
    const pins = [];
    const pages = Math.min(pdf.numPages, 20);
    for (let p = 1; p <= pages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const text = tc.items.map(i => i.str).join(' ');
      const re = new RegExp(PIN_RE.source, 'g');
      let m;
      while ((m = re.exec(text))) {
        const n = norm(m[0]);
        if (!pins.includes(n)) pins.push(n);
      }
    }
    return pins;
  }

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#da291c;color:#fff;font:700 11px -apple-system,sans-serif;opacity:.92;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'PDF#');
  fab.setAttribute('data-sk', '1');
  fab.title = 'Read tracking number from this label PDF';

  const panel = mk('div', 'position:fixed;left:12px;right:12px;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;max-width:420px;background:#111;color:#fff;border-radius:12px;padding:12px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
  panel.setAttribute('data-sk', '1');

  function btn(label, fn, bg) {
    const b = mk('button', 'padding:9px 12px;margin:4px 6px 0 0;border:none;border-radius:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label);
    b.onclick = fn;
    return b;
  }

  async function use(n) {
    const ok = await copy(n);
    panel.style.display = 'none';
    toast('Tracking number ' + n + ' (no spaces)' + (ok ? ' copied.' : '.') + '\nIn Seller Central tap Trk \u2192 Paste clipboard, or paste into the Tracking ID field.');
  }

  let busy = false;
  fab.onclick = async () => {
    if (busy) return;
    busy = true;
    toast('Reading label\u2026', 2500);
    try {
      const pins = await readPins();
      if (!pins.length) {
        toast('No tracking number found in this PDF.\nSelect it in the PDF, copy it, then paste into Seller Central (spaces are removed there).', 6000);
      } else if (pins.length === 1) {
        await use(pins[0]);
      } else {
        panel.textContent = '';
        panel.appendChild(mk('div', 'margin-bottom:6px;color:#aaa;font-size:12px', pins.length + ' numbers found - tap the one to copy:'));
        pins.slice(0, 15).forEach(n => panel.appendChild(btn(n, () => use(n), '#0a84ff')));
        panel.appendChild(btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30'));
        panel.style.display = 'block';
      }
    } catch (e) {
      toast('Could not read the PDF: ' + (e && e.message ? e.message : e) + '\nSelect the number in the PDF and copy it manually.', 7000);
    } finally { busy = false; }
  };

  document.documentElement.append(panel, fab);
})();
