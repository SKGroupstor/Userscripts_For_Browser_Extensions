// ==UserScript==
// @name         SK Video Hotkeys
// @namespace    skgroups
// @version      1.0
// @description  Keyboard control for any HTML5 video: ] / [ speed, \ reset, Shift+Arrows seek 10s, Shift+M mute, Shift+P picture-in-picture
// @match        *://*/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/video/sk-video-hotkeys.user.js
// @downloadURL  https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/scripts/video/sk-video-hotkeys.user.js
// ==/UserScript==

(function () {
  'use strict';

  function activeVideo() {
    const vids = [...document.querySelectorAll('video')];
    if (!vids.length) return null;
    return vids.find(v => !v.paused && !v.ended) ||
      vids.sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight))[0];
  }

  function toast(msg) {
    let t = document.getElementById('sk-hk-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'sk-hk-toast';
      t.setAttribute('data-sk', '1');
      Object.assign(t.style, { position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,.8)', color: '#fff', padding: '8px 16px', borderRadius: '8px', font: '600 16px -apple-system,sans-serif', zIndex: 2147483647, pointerEvents: 'none' });
      document.documentElement.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.style.display = 'none'; }, 1200);
  }

  document.addEventListener('keydown', async e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const v = activeVideo();
    if (!v) return;

    if (e.key === ']') { v.playbackRate = Math.min(16, +(v.playbackRate + 0.25).toFixed(2)); toast(v.playbackRate + 'x'); }
    else if (e.key === '[') { v.playbackRate = Math.max(0.25, +(v.playbackRate - 0.25).toFixed(2)); toast(v.playbackRate + 'x'); }
    else if (e.key === '\\') { v.playbackRate = 1; toast('1x'); }
    else if (e.shiftKey && e.key === 'ArrowRight') { v.currentTime += 10; toast('+10s'); e.preventDefault(); }
    else if (e.shiftKey && e.key === 'ArrowLeft') { v.currentTime -= 10; toast('-10s'); e.preventDefault(); }
    else if (e.shiftKey && e.key.toLowerCase() === 'm') { v.muted = !v.muted; toast(v.muted ? 'Muted' : 'Unmuted'); }
    else if (e.shiftKey && e.key.toLowerCase() === 'p') {
      try {
        if (document.pictureInPictureElement) await document.exitPictureInPicture();
        else await v.requestPictureInPicture();
      } catch { toast('PiP not supported'); }
    }
  }, true);
})();
