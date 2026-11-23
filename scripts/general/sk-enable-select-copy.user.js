// ==UserScript==
// @name         SK Enable Select, Copy & Right-Click
// @namespace    skgroups
// @version      1.0
// @description  Re-enables text selection, copy and context menu on sites that block them
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/general/sk-enable-select-copy.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/general/sk-enable-select-copy.user.js
// ==/UserScript==

(function () {
  'use strict';

  ['contextmenu', 'copy', 'cut', 'selectstart', 'dragstart'].forEach(type => {
    window.addEventListener(type, e => e.stopImmediatePropagation(), true);
  });

  const style = document.createElement('style');
  style.textContent = '*, *::before, *::after { -webkit-user-select: text !important; user-select: text !important; -webkit-touch-callout: default !important; }';
  (document.head || document.documentElement).appendChild(style);

  function unlock() {
    ['oncontextmenu', 'oncopy', 'oncut', 'onselectstart', 'ondragstart'].forEach(p => {
      document[p] = null;
      if (document.body) document.body[p] = null;
    });
  }
  unlock();
  document.addEventListener('DOMContentLoaded', unlock);
  window.addEventListener('load', unlock);
})();
