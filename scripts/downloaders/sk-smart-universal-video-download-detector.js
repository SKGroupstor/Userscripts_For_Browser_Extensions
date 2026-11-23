// ==UserScript==
// @name         SK Universal Video Downloader - Smart Auto Selector
// @namespace    https://skgroups.ca
// @version      3.0.0
// @description  One smart button for MP4 and supported HLS videos
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const CONFIG = {
    maxBytes: 350 * 1024 * 1024,
    scanInterval: 2000,
    muxLibrary:
      'https://cdn.jsdelivr.net/npm/mux.js@6.3.0/dist/mux.min.js'
  };

  const sources = new Map();
  const nativeFetch = window.fetch.bind(window);
  const nativeOpen = XMLHttpRequest.prototype.open;

  let panel, button, status, busy = false;
  let selected = null;

  const modules = [
    {
      id: 'direct-mp4',
      name: 'Direct MP4',
      priority: 100,
      match: s => s.type === 'mp4',
      run: downloadDirect
    },
    {
      id: 'hls-fmp4',
      name: 'HLS MP4',
      priority: 90,
      match: s => s.type === 'hls',
      run: downloadHLS
    }
  ];

  function classify(url) {
    if (/\.mp4(?:[?#]|$)/i.test(url)) return 'mp4';
    if (/\.m3u8(?:[?#]|$)/i.test(url)) return 'hls';
    if (/\.mpd(?:[?#]|$)/i.test(url)) return 'dash';
    if (/\.webm(?:[?#]|$)/i.test(url)) return 'webm';
    if (url.startsWith('blob:')) return 'blob';
    return null;
  }

  function register(input) {
    if (!input) return;

    try {
      const url = new URL(String(input), location.href).href;
      const type = classify(url);
      if (!type || sources.has(url)) return;

      sources.set(url, {
        url,
        type,
        added: Date.now()
      });

      update();
    } catch {}
  }

  window.fetch = function (...args) {
    register(typeof args[0] === 'string'
      ? args[0] : args[0]?.url);
    return nativeFetch(...args);
  };

  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    register(url);
    return nativeOpen.call(this, method, url, ...args);
  };

  function scan() {
    document.querySelectorAll('video, source').forEach(el => {
      register(el.currentSrc);
      register(el.src);
    });

    document.querySelectorAll('a[href]').forEach(el => {
      register(el.href);
    });

    performance.getEntriesByType('resource').forEach(entry => {
      register(entry.name);
    });
  }

  function choose() {
    const candidates = [...sources.values()];

    // Prefer a source attached to an actual video element.
    const active = [...document.querySelectorAll('video')]
      .map(v => v.currentSrc || v.src)
      .filter(Boolean);

    candidates.sort((a, b) => {
      const aModule = modules.find(m => m.match(a));
      const bModule = modules.find(m => m.match(b));

      const aScore = (aModule?.priority || 0) +
        (active.includes(a.url) ? 30 : 0);
      const bScore = (bModule?.priority || 0) +
        (active.includes(b.url) ? 30 : 0);

      return bScore - aScore || b.added - a.added;
    });

    return candidates[0] || null;
  }

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function update() {
    if (!button || busy) return;

    selected = choose();

    if (!selected) {
      button.textContent = 'SK · Scan Video';
      setStatus('Waiting for video');
      return;
    }

    const module = modules.find(m => m.match(selected));

    if (module) {
      button.textContent = '⬇ Download MP4';
      setStatus(module.name + ' detected');
    } else {
      button.textContent = 'SK · Stream Info';
      setStatus(selected.type.toUpperCase() +
        ' detected — no compatible MP4 engine');
    }
  }

  async function request(url) {
    const response = await nativeFetch(url, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw Error('HTTP ' + response.status);
    }

    return response;
  }

  async function readBytes(url) {
    return new Uint8Array(
      await (await request(url)).arrayBuffer()
    );
  }

  function saveBlob(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = 'SK-Video-' + Date.now() + '.mp4';

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 180000);
  }

  async function downloadDirect(source) {
    setStatus('Requesting MP4 download...');

    // Browser-managed download avoids a full JS memory copy.
    const a = document.createElement('a');
    a.href = source.url;
    a.download = 'SK-Video-' + Date.now() + '.mp4';
    a.rel = 'noopener';

    document.body.appendChild(a);
    a.click();
    a.remove();

    setStatus('Download requested. Check Files or Edge downloads.');
  }

  function parseAttributes(line) {
    const result = {};
    const regex = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
    let match;

    while ((match = regex.exec(line))) {
      result[match[1]] =
        match[2].replace(/^"|"$/g, '');
    }

    return result;
  }

  async function resolvePlaylist(url, depth = 0) {
    if (depth > 5) throw Error('Too many nested playlists');

    const text = await (await request(url)).text();
    const lines = text.split(/\r?\n/).map(x => x.trim());

    if (lines[0] !== '#EXTM3U') {
      throw Error('Invalid HLS playlist');
    }

    const variants = [];

    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('#EXT-X-STREAM-INF:'))
        continue;

      const attr = parseAttributes(lines[i]);
      const next = lines.slice(i + 1).find(Boolean);

      if (next && !next.startsWith('#')) {
        variants.push({
          url: new URL(next, url).href,
          bandwidth: Number(attr.BANDWIDTH || 0)
        });
      }
    }

    if (variants.length) {
      variants.sort((a, b) => b.bandwidth - a.bandwidth);
      return resolvePlaylist(variants[0].url, depth + 1);
    }

    return { url, lines };
  }

  function parseMediaPlaylist(p) {
    const segments = [];
    let initURL = null;
    let sequence = 0;

    for (const line of p.lines) {
      if (line.startsWith('#EXT-X-KEY:')) {
        const a = parseAttributes(line);
        if (a.METHOD !== 'NONE') {
          throw Error(
            'Encrypted HLS requires a separate authorized engine'
          );
        }
      }

      if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
        sequence = Number(line.split(':')[1]);
      }

      if (line.startsWith('#EXT-X-MAP:')) {
        const a = parseAttributes(line);

        if (!a.URI || a.BYTERANGE)
          throw Error('Unsupported MP4 initialization map');

        if (initURL && initURL !== new URL(a.URI, p.url).href)
          throw Error('Multiple initialization maps unsupported');

        initURL = new URL(a.URI, p.url).href;
      }

      if (line.startsWith('#EXT-X-BYTERANGE:')) {
        throw Error('Byte-range HLS unsupported');
      }

      if (line.startsWith('#EXT-X-DISCONTINUITY')) {
        throw Error('Discontinuous HLS unsupported');
      }

      if (line && !line.startsWith('#')) {
        segments.push({
          url: new URL(line, p.url).href,
          sequence: sequence++
        });
      }
    }

    if (!segments.length)
      throw Error('No segments found');

    return { segments, initURL };
  }

  async function loadMux() {
    if (window.muxjs) return window.muxjs;

    setStatus('Loading MPEG-TS converter...');

    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CONFIG.muxLibrary;
      script.onload = resolve;
      script.onerror = () =>
        reject(Error('Unable to load mux.js'));

      document.head.appendChild(script);
    });

    if (!window.muxjs)
      throw Error('mux.js unavailable');

    return window.muxjs;
  }

  async function downloadHLS(source) {
    setStatus('Reading HLS playlist...');

    const playlist = await resolvePlaylist(source.url);
    const media = parseMediaPlaylist(playlist);

    const chunks = [];
    let totalBytes = 0;

    function append(data) {
      totalBytes += data.byteLength;

      if (totalBytes > CONFIG.maxBytes) {
        throw Error('350 MB iPhone memory limit reached');
      }

      chunks.push(data);
    }

    if (media.initURL) {
      // Fragmented MP4 playlist: append init + fragments.
      // This requires compatible codecs and continuous fragments.
      append(await readBytes(media.initURL));

      for (let i = 0; i < media.segments.length; i++) {
        setStatus(
          'Downloading MP4 fragments ' +
          (i + 1) + '/' + media.segments.length
        );

        append(await readBytes(media.segments[i].url));
      }
    } else {
      // MPEG-TS playlist: remux with mux.js.
      const muxjs = await loadMux();
      const transmuxer = new muxjs.mp4.Transmuxer({
        remux: true,
        keepOriginalTimestamps: true
      });

      let initialized = false;
      let outputCount = 0;

      transmuxer.on('data', segment => {
        if (!initialized) {
          append(segment.initSegment);
          initialized = true;
        }

        append(segment.data);
        outputCount++;
      });

      for (let i = 0; i < media.segments.length; i++) {
        setStatus(
          'Remuxing MPEG-TS ' +
          (i + 1) + '/' + media.segments.length
        );

        const data = await readBytes(media.segments[i].url);

        transmuxer.push(data);
        transmuxer.flush();
      }

      if (!outputCount)
        throw Error('No MP4 output produced');
    }

    setStatus('Preparing MP4 file...');

    const blob = new Blob(chunks, {
      type: 'video/mp4'
    });

    saveBlob(blob);

    setStatus(
      'MP4 download requested: ' +
      (blob.size / 1048576).toFixed(1) + ' MB'
    );
  }

  async function handleClick() {
    if (busy) return;

    scan();
    const source = choose();

    if (!source) {
      setStatus('No video source found. Start playback first.');
      return;
    }

    const module = modules.find(m => m.match(source));

    if (!module) {
      setStatus(
        source.type.toUpperCase() +
        ' detected. MP4 conversion module unavailable.'
      );
      return;
    }

    busy = true;
    button.disabled = true;

    try {
      await module.run(source);
    } catch (error) {
      setStatus('Error: ' + error.message);
    } finally {
      busy = false;
      button.disabled = false;
      // Keep the final status visible until the next scan.
      selected = choose();
    }
  }

  function setup() {
    if (panel || !document.body) return;

    panel = document.createElement('div');
    panel.id = 'sk-video-controller';

    panel.style.cssText = [
      'position:fixed',
      'right:12px',
      'bottom:20px',
      'z-index:2147483647',
      'background:#151515',
      'color:#fff',
      'padding:10px',
      'border-radius:12px',
      'box-shadow:0 4px 18px #0009',
      'font:12px Arial,sans-serif',
      'max-width:82vw'
    ].join(';');

    button = document.createElement('button');
    button.textContent = 'SK · Scan Video';

    button.style.cssText = [
      'background:#087ed1',
      'color:white',
      'border:0',
      'border-radius:8px',
      'padding:12px 16px',
      'font-size:14px',
      'font-weight:bold',
      'cursor:pointer'
    ].join(';');

    button.onclick = handleClick;

    status = document.createElement('div');
    status.textContent = 'Waiting for video';

    status.style.cssText = [
      'margin-top:7px',
      'font-size:11px',
      'max-width:240px',
      'overflow-wrap:anywhere'
    ].join(';');

    panel.append(button, status);
    document.body.appendChild(panel);

    update();
  }

  document.addEventListener('DOMContentLoaded', setup);

  setInterval(() => {
    if (!panel && document.readyState !== 'loading')
      setup();

    scan();
  }, CONFIG.scanInterval);
})();