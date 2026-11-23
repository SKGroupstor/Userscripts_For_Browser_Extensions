// ==UserScript==
// @name         SK Smart Video Download Controller
// @namespace    skgroups
// @version      1.0
// @description  One adaptive video download button
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/downloaders/archive/sk-smart-video-download-controller-v1.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/downloaders/archive/sk-smart-video-download-controller-v1.user.js
// ==/UserScript==

(() => {
  'use strict';

  const sources = new Map();
  const originalFetch = window.fetch;
  const originalOpen = XMLHttpRequest.prototype.open;
  let button, status;
  let busy = false;

  const types = [
    { id: 'mp4', pattern: /\.mp4(?:[?#]|$)/i, priority: 100 },
    { id: 'hls', pattern: /\.m3u8(?:[?#]|$)/i, priority: 70 },
    { id: 'dash', pattern: /\.mpd(?:[?#]|$)/i, priority: 60 },
    { id: 'webm', pattern: /\.webm(?:[?#]|$)/i, priority: 40 }
  ];

  function register(input) {
    try {
      if (!input || String(input).startsWith('blob:')) return;

      const url = new URL(String(input), location.href).href;
      const type = types.find(t => t.pattern.test(url));

      if (!type || sources.has(url)) return;

      sources.set(url, {
        url,
        type: type.id,
        priority: type.priority
      });

      update();
    } catch {}
  }

  window.fetch = function (...args) {
    register(typeof args[0] === 'string'
      ? args[0] : args[0]?.url);
    return originalFetch.apply(this, args);
  };

  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    register(url);
    return originalOpen.call(this, method, url, ...args);
  };

  function scan() {
    document.querySelectorAll(
      'video, video source, a[href], source[src]'
    ).forEach(el => {
      register(el.currentSrc);
      register(el.src);
      if (el.tagName === 'A') register(el.href);
    });

    performance.getEntriesByType('resource')
      .forEach(entry => register(entry.name));
  }

  function bestSource() {
    return [...sources.values()]
      .sort((a, b) => b.priority - a.priority)[0];
  }

  function update() {
    if (!button || busy) return;

    const best = bestSource();

    if (!best) {
      button.textContent = 'SK: Scan Video';
      return;
    }

    if (best.type === 'mp4') {
      button.textContent = '⬇ Download MP4';
    } else {
      button.textContent =
        '▶ ' + best.type.toUpperCase() + ' Detected';
    }
  }

  async function downloadMP4(source) {
    status.textContent = 'Starting MP4 download...';

    // A browser-managed download avoids loading the
    // entire video into JavaScript memory.
    const a = document.createElement('a');
    a.href = source.url;
    a.download = 'SK-Video-' + Date.now() + '.mp4';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();

    status.textContent =
      'Download requested. Check browser downloads.';
  }

  async function action() {
    if (busy) return;
    busy = true;

    try {
      scan();
      const source = bestSource();

      if (!source) {
        status.textContent = 'No supported video URL detected';
        return;
      }

      if (source.type === 'mp4') {
        await downloadMP4(source);
      } else {
        status.textContent =
          source.type.toUpperCase() +
          ' stream found. MP4 converter module required.';

        // Copy the stream URL for a compatible module.
        try {
          await navigator.clipboard.writeText(source.url);
          status.textContent += ' URL copied.';
        } catch {
          status.textContent += ' Clipboard unavailable.';
        }
      }
    } catch (e) {
      status.textContent = 'Error: ' + e.message;
    } finally {
      busy = false;
      update();
    }
  }

  function setup() {
    if (button || !document.body) return;

    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:fixed',
      'right:12px',
      'bottom:22px',
      'z-index:2147483647',
      'background:#171717',
      'padding:8px',
      'border-radius:12px',
      'box-shadow:0 3px 15px #0008',
      'font:12px Arial',
      'max-width:85vw'
    ].join(';');

    button = document.createElement('button');
    button.textContent = 'SK: Scan Video';
    button.style.cssText = [
      'background:#087ed1',
      'color:white',
      'border:0',
      'border-radius:8px',
      'padding:12px 16px',
      'font-weight:bold',
      'font-size:14px'
    ].join(';');

    button.addEventListener('click', action);

    status = document.createElement('div');
    status.style.cssText =
      'color:white;margin-top:5px;max-width:240px;' +
      'overflow-wrap:anywhere';

    panel.append(button, status);
    document.body.appendChild(panel);
    update();
  }

  document.addEventListener('DOMContentLoaded', setup);

  setInterval(() => {
    if (!button && document.readyState !== 'loading')
      setup();
    scan();
  }, 2000);
})();