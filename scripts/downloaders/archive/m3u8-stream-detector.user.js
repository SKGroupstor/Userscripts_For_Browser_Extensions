// ==UserScript==
// @name         SK M3U8 Stream Detector
// @namespace    skgroups
// @version      1.0
// @description  Detect HLS playlists and copy/open URLs
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const found = new Set();

  function detect(url) {
    if (!url || !/\.m3u8(?:[?#]|$)/i.test(String(url))) return;
    const full = new URL(String(url), location.href).href;
    if (found.has(full)) return;
    found.add(full);
    render();
  }

  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    detect(typeof args[0] === 'string'
      ? args[0] : args[0]?.url);
    return originalFetch.apply(this, args);
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    detect(url);
    return originalOpen.call(this, method, url, ...rest);
  };

  function render() {
    let panel = document.getElementById('sk-hls-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'sk-hls-panel';
      Object.assign(panel.style, {
        position: 'fixed',
        bottom: '20px',
        right: '10px',
        zIndex: '2147483647',
        background: '#171717',
        color: '#fff',
        padding: '12px',
        borderRadius: '10px',
        maxWidth: '85vw',
        fontSize: '14px'
      });
      document.body.appendChild(panel);
    }

    panel.replaceChildren();
    const heading = document.createElement('div');
    heading.textContent = 'HLS Streams: ' + found.size;
    panel.appendChild(heading);

    for (const url of found) {
      const row = document.createElement('div');
      row.style.marginTop = '8px';

      const copy = document.createElement('button');
      copy.textContent = 'Copy URL';
      copy.onclick = () => navigator.clipboard.writeText(url);

      const open = document.createElement('button');
      open.textContent = 'Open';
      open.style.marginLeft = '8px';
      open.onclick = () => window.open(url, '_blank');

      row.append(copy, open);
      panel.appendChild(row);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    performance.getEntriesByType('resource')
      .forEach(entry => detect(entry.name));
  });
})();