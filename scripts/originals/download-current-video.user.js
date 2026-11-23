// ==UserScript==
// @name         Download Current Video
// @namespace    skgroups
// @version      1.1
// @description  Adds a download button for direct HTML5 video files. The button only appears on video playback pages.
// @match        *://*/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/originals/download-current-video.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/originals/download-current-video.user.js
// ==/UserScript==

(function () {
  'use strict';

  // ----- show the button only on a real video playback page -----
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

  const btn = document.createElement('button');
  btn.textContent = 'Download Video';
  btn.style.position = 'fixed';
  btn.style.bottom = '130px';
  btn.style.right = '20px';
  btn.style.zIndex = '999999';
  btn.style.padding = '10px';
  btn.style.borderRadius = '8px';
  btn.setAttribute('data-sk', '1');

  btn.onclick = () => {
    const video = document.querySelector('video');

    if (!video) {
      alert('No video found on this page.');
      return;
    }

    const src = video.currentSrc || video.src;

    if (!src) {
      alert('Video source not found. This site may use protected streaming.');
      return;
    }

    const a = document.createElement('a');
    a.href = src;
    a.download = 'video.mp4';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Add the button only while this is a video playback page (re-checked as the page loads / navigates)
  function syncUI() {
    if (!document.body) return;
    const on = isVideoPage();
    if (on && !btn.isConnected) document.body.appendChild(btn);
    else if (!on && btn.isConnected) btn.remove();
  }
  syncUI();
  setInterval(syncUI, 1500);
})();
