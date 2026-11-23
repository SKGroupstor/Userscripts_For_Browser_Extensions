// ==UserScript==
// @name         SK Universal HLS MP4 Downloader
// @namespace    https://skgroups.ca
// @version      2.0
// @description  Download supported M3U8 HLS streams as MP4
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/downloaders/archive/sk-universal-hls-to-mp4-downloader-v2.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/downloaders/archive/sk-universal-hls-to-mp4-downloader-v2.user.js
// ==/UserScript==

(() => {
  'use strict';

  const found = new Set();
  const nativeFetch = window.fetch.bind(window);
  const oldOpen = XMLHttpRequest.prototype.open;
  let panel, status, list;

  const muxURL =
    'https://cdn.jsdelivr.net/npm/mux.js@6.3.0/dist/mux.min.js';

  function detect(input) {
    try {
      const url = new URL(input, location.href).href;
      if (!/\.m3u8(?:[?#]|$)/i.test(url)) return;
      if (found.has(url)) return;
      found.add(url);
      render();
    } catch {}
  }

  window.fetch = function (...args) {
    detect(typeof args[0] === 'string'
      ? args[0] : args[0]?.url);
    return nativeFetch(...args);
  };

  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    detect(url);
    return oldOpen.call(this, method, url, ...args);
  };

  function setStatus(msg) {
    if (status) status.textContent = msg;
  }

  async function request(url) {
    const r = await nativeFetch(url, {
      credentials: 'include'
    });
    if (!r.ok) throw Error('HTTP ' + r.status);
    return r;
  }

  async function bytes(url) {
    return new Uint8Array(await (await request(url)).arrayBuffer());
  }

  function attrs(line) {
    const obj = {};
    const regex = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
    let m;
    while ((m = regex.exec(line))) {
      obj[m[1]] = m[2].replace(/^"|"$/g, '');
    }
    return obj;
  }

  async function playlist(url, depth = 0) {
    if (depth > 6) throw Error('Too many nested playlists');

    const text = await (await request(url)).text();
    const lines = text.split(/\r?\n/).map(x => x.trim());

    if (!lines[0]?.startsWith('#EXTM3U'))
      throw Error('Invalid M3U8 playlist');

    const variants = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF:')) {
        const a = attrs(lines[i]);
        const next = lines.slice(i + 1).find(x => x.length);
        if (next && !next.startsWith('#')) {
          variants.push({
            url: new URL(next, url).href,
            bw: Number(a.BANDWIDTH || 0)
          });
        }
      }
    }

    if (variants.length) {
      variants.sort((a, b) => b.bw - a.bw);
      return playlist(variants[0].url, depth + 1);
    }

    return { url, lines };
  }

  function ivFromSequence(n) {
    const iv = new Uint8Array(16);
    let value = BigInt(n);
    for (let i = 15; i >= 0; i--) {
      iv[i] = Number(value & 255n);
      value >>= 8n;
    }
    return iv;
  }

  function parseIV(hex) {
    const clean = hex.replace(/^0x/i, '');
    if (!/^[0-9a-f]+$/i.test(clean) || clean.length > 32)
      throw Error('Invalid AES IV');
    return Uint8Array.from(
      clean.padStart(32, '0').match(/../g),
      x => parseInt(x, 16)
    );
  }

  async function decrypt(data, keyInfo, sequence, keyCache) {
    if (!keyInfo || keyInfo.METHOD === 'NONE') return data;

    if (keyInfo.METHOD !== 'AES-128')
      throw Error('Unsupported encryption: ' + keyInfo.METHOD);

    const keyURL = keyInfo.url;
    let key = keyCache.get(keyURL);

    if (!key) {
      const raw = await bytes(keyURL);
      if (raw.length !== 16)
        throw Error('AES key must be 16 bytes');

      key = await crypto.subtle.importKey(
        'raw', raw, { name: 'AES-CBC' }, false, ['decrypt']
      );
      keyCache.set(keyURL, key);
    }

    const iv = keyInfo.IV
      ? parseIV(keyInfo.IV)
      : ivFromSequence(sequence);

    const result = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv }, key, data
    );
    return new Uint8Array(result);
  }

  async function loadMux() {
    if (window.muxjs) return window.muxjs;

    setStatus('Loading MP4 converter...');

    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = muxURL;
      s.onload = resolve;
      s.onerror = () => reject(
        Error('Unable to load mux.js converter')
      );
      document.head.appendChild(s);
    });

    if (!window.muxjs)
      throw Error('Converter unavailable');

    return window.muxjs;
  }

  async function downloadHLS(url) {
    setStatus('Reading playlist...');

    const p = await playlist(url);
    const segments = [];
    const keyCache = new Map();

    let sequence = 0;
    let currentKey = null;
    let init = null;
    let initKey = null;
    let initSequence = 0;

    for (const line of p.lines) {
      if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
        sequence = Number(line.split(':')[1]);
      } else if (line.startsWith('#EXT-X-KEY:')) {
        const k = attrs(line);
        if (k.METHOD === 'NONE') {
          currentKey = null;
        } else {
          if (!k.URI) throw Error('Missing encryption key URI');
          currentKey = {
            ...k,
            url: new URL(k.URI, p.url).href
          };
        }
      } else if (line.startsWith('#EXT-X-MAP:')) {
        const a = attrs(line);
        if (!a.URI || a.BYTERANGE)
          throw Error('Unsupported initialization map');
        init = new URL(a.URI, p.url).href;
        initKey = currentKey;
        initSequence = sequence;
      } else if (line.startsWith('#EXT-X-BYTERANGE:')) {
        throw Error('Byte-range segments not supported');
      } else if (line.startsWith('#EXT-X-DISCONTINUITY')) {
        throw Error('Discontinuous streams not supported');
      } else if (line && !line.startsWith('#')) {
        segments.push({
          url: new URL(line, p.url).href,
          sequence: sequence++,
          key: currentKey
        });
      }
    }

    if (!segments.length)
      throw Error('No video segments found');

    const chunks = [];
    let total = 0;

    function add(data) {
      chunks.push(data);
      total += data.byteLength;
      if (total > 350 * 1024 * 1024)
        throw Error('350 MB memory safety limit reached');
    }

    if (init) {
      let data = await bytes(init);
      data = await decrypt(
        data, initKey, initSequence, keyCache
      );
      add(data);

      for (let i = 0; i < segments.length; i++) {
        setStatus('Downloading ' + (i + 1) +
          ' / ' + segments.length);

        const s = segments[i];
        let data = await bytes(s.url);
        data = await decrypt(
          data, s.key, s.sequence, keyCache
        );
        add(data);
      }
    } else {
      const muxjs = await loadMux();
      const transmuxer = new muxjs.mp4.Transmuxer({
        keepOriginalTimestamps: true,
        remux: true
      });

      let initAdded = false;
      let outputCount = 0;

      transmuxer.on('data', segment => {
        if (!initAdded) {
          add(segment.initSegment);
          initAdded = true;
        }
        add(segment.data);
        outputCount++;
      });

      for (let i = 0; i < segments.length; i++) {
        setStatus('Converting ' + (i + 1) +
          ' / ' + segments.length);

        const s = segments[i];
        let data = await bytes(s.url);
        data = await decrypt(
          data, s.key, s.sequence, keyCache
        );

        transmuxer.push(data);
        transmuxer.flush();
      }

      if (!outputCount)
        throw Error('Unable to remux MPEG-TS video');
    }

    setStatus('Preparing MP4 download...');

    const blob = new Blob(chunks, {
      type: 'video/mp4'
    });

    const objectURL = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectURL;
    a.download = 'SK-Video-' + Date.now() + '.mp4';
    document.body.appendChild(a);
    a.click();
    a.remove();

    setStatus('MP4 download requested (' +
      (blob.size / 1048576).toFixed(1) + ' MB)');

    setTimeout(() => URL.revokeObjectURL(objectURL), 180000);
  }

  function render() {
    if (!list) return;
    list.replaceChildren();

    for (const url of found) {
      const b = document.createElement('button');
      b.textContent = 'Download MP4';
      b.style.cssText =
        'display:block;margin:6px 0;padding:10px;' +
        'background:#087ed1;color:white;border:0;' +
        'border-radius:7px;font-weight:bold';

      b.onclick = async () => {
        b.disabled = true;
        try {
          await downloadHLS(url);
        } catch (e) {
          setStatus('Error: ' + e.message);
        } finally {
          b.disabled = false;
        }
      };
      list.appendChild(b);
    }
  }

  function setup() {
    if (panel || !document.body) return;

    panel = document.createElement('div');
    panel.style.cssText =
      'position:fixed;bottom:15px;right:10px;' +
      'z-index:2147483647;background:#171717;' +
      'color:white;padding:12px;border-radius:12px;' +
      'max-width:85vw;max-height:45vh;overflow:auto;' +
      'font:13px Arial;box-shadow:0 3px 15px #0008';

    const header = document.createElement('div');
    header.textContent = 'SK HLS → MP4 v2.0';
    header.style.fontWeight = 'bold';

    status = document.createElement('div');
    status.textContent = 'Waiting for video...';
    status.style.margin = '8px 0';

    list = document.createElement('div');

    const manual = document.createElement('button');
    manual.textContent = 'Paste M3U8 URL';
    manual.style.marginTop = '6px';
    manual.onclick = () => {
      const url = prompt('Enter M3U8 URL:');
      if (url) detect(url);
    };

    const hide = document.createElement('button');
    hide.textContent = '×';
    hide.style.cssText =
      'float:right;background:none;color:white;' +
      'border:0;font-size:20px';
    hide.onclick = () => panel.remove();

    panel.append(hide, header, status, list, manual);
    document.body.appendChild(panel);
    render();
  }

  document.addEventListener('DOMContentLoaded', setup);

  setInterval(() => {
    if (!panel && document.readyState !== 'loading')
      setup();

    performance.getEntriesByType('resource')
      .forEach(r => detect(r.name));
  }, 2000);
})();