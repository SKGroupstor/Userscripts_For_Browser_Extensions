// ==UserScript==
// @name         SK YouTube Ad Skipper
// @namespace    skgroups
// @version      1.0
// @description  Clicks "Skip" on YouTube video ads as soon as it appears and fast-forwards unskippable ones
// @match        *://*.youtube.com/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/general/sk-youtube-ad-skipper.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/general/sk-youtube-ad-skipper.user.js
// ==/UserScript==

(function () {
  'use strict';

  const SKIP = '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-container button';

  setInterval(() => {
    const player = document.querySelector('.html5-video-player');
    if (!player || !player.classList.contains('ad-showing')) return;

    const skip = document.querySelector(SKIP);
    if (skip) { skip.click(); return; }

    const video = player.querySelector('video');
    if (video && isFinite(video.duration) && video.duration > 0) {
      video.muted = true;
      video.playbackRate = 16;
      video.currentTime = Math.max(0, video.duration - 0.1);
    }
  }, 400);
})();
