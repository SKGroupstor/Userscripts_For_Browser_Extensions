// ==UserScript==
// @name         Picture in Picture Button
// @namespace    skgroups
// @version      1.0
// @description  Adds PiP button to videos
// @match        *://*/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/originals/picture-in-picture.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/originals/picture-in-picture.user.js
// ==/UserScript==

(function () {
  'use strict';

  const btn = document.createElement('button');
  btn.textContent = 'PiP';
  btn.style.position = 'fixed';
  btn.style.bottom = '180px';
  btn.style.right = '20px';
  btn.style.zIndex = '999999';
  btn.style.padding = '10px';
  btn.style.borderRadius = '8px';

  btn.onclick = async () => {
    const video = document.querySelector('video');

    if (!video) {
      alert('No video found.');
      return;
    }

    try {
      await video.requestPictureInPicture();
    } catch (e) {
      alert('Picture-in-Picture not supported on this site/browser.');
    }
  };

  document.body.appendChild(btn);
})();
