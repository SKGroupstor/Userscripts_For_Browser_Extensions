// ==UserScript==
// @name         Universal Play Pause Button
// @namespace    skgroups
// @version      1.0
// @description  Adds play/pause button for videos
// @match        *://*/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/originals/force-video-play-pause.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/originals/force-video-play-pause.user.js
// ==/UserScript==

(function () {
  'use strict';

  const btn = document.createElement('button');
  btn.textContent = '▶ / ⏸';
  btn.style.position = 'fixed';
  btn.style.bottom = '80px';
  btn.style.right = '20px';
  btn.style.zIndex = '999999';
  btn.style.padding = '10px';
  btn.style.borderRadius = '8px';

  btn.onclick = () => {
    document.querySelectorAll('video').forEach(video => {
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    });
  };

  document.body.appendChild(btn);
})();
