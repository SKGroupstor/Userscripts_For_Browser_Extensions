// ==UserScript==
// @name         Download Current Video
// @namespace    skgroups
// @version      1.0
// @description  Adds a download button for direct HTML5 video files
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const btn = document.createElement('button');
  btn.textContent = 'Download Video';
  btn.style.position = 'fixed';
  btn.style.bottom = '130px';
  btn.style.right = '20px';
  btn.style.zIndex = '999999';
  btn.style.padding = '10px';
  btn.style.borderRadius = '8px';

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

  document.body.appendChild(btn);
})();
