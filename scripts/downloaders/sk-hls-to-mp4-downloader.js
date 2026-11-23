// ==UserScript==
// @name         SK HLS MP4 Downloader
// @namespace    https://skgroups.ca
// @version      1.0
// @description  Detect HLS streams and save compatible fMP4 video
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const streams = new Set();
  let panel;

  function detect(url) {
    try {
      const absolute = new URL(url, location.href).href;
      if (!/\.m3u8(?:[?#]|$)/i.test(absolute)) return;
      if (streams.has(absolute)) return;
      streams.add(absolute);
      updatePanel();
    } catch (_) {}
  }

  const oldFetch = window.fetch;
  window.fetch = function (...args) {
    detect(typeof args[0] === 'string'
      ? args[0] : args[0]?.url);
    return oldFetch.apply(this, args);
  };

  const oldOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    detect(url);
    return oldOpen.call(this, method, url, ...rest);
  };

  function createPanel() {
    if (panel || !document.body) return;

    panel = document.createElement('div');
    Object.assign(panel.style, {
      position: 'fixed',
      bottom: '18px',
      right: '12px',
      zIndex: '2147483647',
      background: '#151515',
      color: '#fff',
      padding: '12px',
      borderRadius: '12px',
      maxWidth: '90vw',
      maxHeight: '45vh',
      overflowY: 'auto',
      font: '13px Arial, sans-serif',
      boxShadow: '0 4px 20px #0008'
    });

    document.body.appendChild(panel);
    updatePanel();
  }

  function message(text) {
    if (!panel) return;
    const status = panel.querySelector('#sk-status');
    if (status) status.textContent = text;
  }

  async function getText(url) {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.text();
  }

  async function resolvePlaylist(url, depth = 0) {
    if (depth > 5) throw new Error('Too many nested playlists');

    const text = await getText(url);
    const lines = text.split(/\r?\n/).map(x => x.trim());
    const variants = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF:')) {
        const bandwidth = Number(
          lines[i].match(/BANDWIDTH=(\d+)/)?.[1] || 0
        );
        let next = i + 1;
        while (next < lines.length && !lines[next]) next++;
        if (lines[next] && !lines[next].startsWith('#')) {
          variants.push({
            bandwidth,
            url: new URL(lines[next], url).href
          });
        }
      }
    }

    if (variants.length) {
      variants.sort((a, b) => b.bandwidth - a.bandwidth);
      return resolvePlaylist(variants[0].url, depth + 1);
    }

    return { text, url };
  }

  async function download(url) {
    message('Reading playlist...');

    const playlist = await resolvePlaylist(url);
    const lines = playlist.text.split(/\r?\n/)
      .map(x => x.trim());

    if (lines.some(x => x.startsWith('#EXT-X-KEY:') &&
        !/METHOD=NONE(?:,|$)/.test(x))) {
      throw new Error('Encrypted HLS is not supported');
    }

    if (lines.some(x => x.startsWith('#EXT-X-BYTERANGE:'))) {
      throw new Error('Byte-range playlists are not supported');
    }

    if (lines.some(x => x.startsWith('#EXT-X-DISCONTINUITY'))) {
      throw new Error('Discontinuous streams are not supported');
    }

    const mapLine = lines.find(x =>
      x.startsWith('#EXT-X-MAP:'));

    if (!mapLine) {
      throw new Error(
        'This stream is likely MPEG-TS. MP4 conversion required.'
      );
    }

    const initPath = mapLine.match(/URI="([^"]+)"/)?.[1];
    if (!initPath || /BYTERANGE=/.test(mapLine)) {
      throw new Error('Unsupported initialization segment');
    }

    const segmentPaths = lines.filter(x =>
      x && !x.startsWith('#'));

    if (!segmentPaths.length) {
      throw new Error('No video segments found');
    }

    const urls = [
      new URL(initPath, playlist.url).href,
      ...segmentPaths.map(x => new URL(x, playlist.url).href)
    ];

    const chunks = [];

    for (let i = 0; i < urls.length; i++) {
      message('Downloading ' + (i + 1) + '/' + urls.length);

      const response = await fetch(urls[i], {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Segment HTTP ' + response.status);
      }

      chunks.push(await response.blob());
    }

    message('Preparing MP4...');

    const blob = new Blob(chunks, { type: 'video/mp4' });
    const blobURL = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobURL;
    a.download = 'SK-HLS-' + Date.now() + '.mp4';
    document.body.appendChild(a);
    a.click();
    a.remove();

    message('Download requested. Check browser downloads.');

    setTimeout(() => URL.revokeObjectURL(blobURL), 120000);
  }

  function updatePanel() {
    if (!panel) return;
    panel.replaceChildren();

    const title = document.createElement('strong');
    title.textContent = 'SK HLS Downloader';
    panel.appendChild(title);

    const status = document.createElement('div');
    status.id = 'sk-status';
    status.style.margin = '8px 0';
    status.textContent = streams.size
      ? streams.size + ' stream(s) detected'
      : 'Waiting for HLS stream...';
    panel.appendChild(status);

    for (const url of streams) {
      const button = document.createElement('button');
      button.textContent = 'Download MP4';
      Object.assign(button.style, {
        display: 'block',
        marginTop: '8px',
        padding: '9px',
        border: 'none',
        borderRadius: '6px',
        background: '#2185d0',
        color: 'white'
      });

      button.onclick = async () => {
        button.disabled = true;
        try {
          await download(url);
        } catch (error) {
          message('Error: ' + error.message);
        } finally {
          button.disabled = false;
        }
      };

      panel.appendChild(button);
    }
  }

  document.addEventListener('DOMContentLoaded', createPanel);

  setInterval(() => {
    if (!panel) createPanel();
    performance.getEntriesByType('resource')
      .forEach(entry => detect(entry.name));
  }, 2000);
})();