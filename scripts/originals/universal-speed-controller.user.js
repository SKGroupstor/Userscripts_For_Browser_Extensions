// ==UserScript==
// @name         Universal Video Speed Controller
// @namespace    skgroups
// @version      1.0
// @description  Adds video speed buttons to most websites
// @match        *://*/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/originals/universal-speed-controller.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/originals/universal-speed-controller.user.js
// ==/UserScript==

(function () {
  'use strict';

  function setSpeed(rate) {
    document.querySelectorAll('video').forEach(video => {
      video.playbackRate = rate;
    });
    alert("Video speed set to " + rate + "x");
  }

  const box = document.createElement('div');
  box.style.position = 'fixed';
  box.style.bottom = '20px';
  box.style.right = '20px';
  box.style.zIndex = '999999';
  box.style.background = '#111';
  box.style.padding = '10px';
  box.style.borderRadius = '10px';
  box.style.color = '#fff';
  box.style.fontSize = '14px';

  [1, 1.25, 1.5, 2, 3, 4, 8, 16].forEach(rate => {
    const btn = document.createElement('button');
    btn.textContent = rate + 'x';
    btn.style.margin = '3px';
    btn.onclick = () => setSpeed(rate);
    box.appendChild(btn);
  });

  document.body.appendChild(box);
})();
