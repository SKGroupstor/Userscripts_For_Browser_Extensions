// ==UserScript==
// @name         SK Universal Video Tool
// @namespace    skgroups
// @version      1.0
// @description  Speed, play/pause, PiP, and download for HTML5 videos
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function getVideo() {
    return document.querySelector('video');
  }

  function makeButton(text, action) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.margin = '4px';
    btn.style.padding = '6px 8px';
    btn.style.borderRadius = '6px';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.onclick = action;
    return btn;
  }

  const panel = document.createElement('div');
  panel.style.position = 'fixed';
  panel.style.bottom = '20px';
  panel.style.right = '20px';
  panel.style.zIndex = '999999';
  panel.style.background = '#111';
  panel.style.color = '#fff';
  panel.style.padding = '10px';
  panel.style.borderRadius = '10px';
  panel.style.fontSize = '14px';
  panel.style.maxWidth = '260px';

  panel.appendChild(makeButton('Play/Pause', () => {
    const video = getVideo();
    if (!video) return alert('No video found.');
    video.paused ? video.play() : video.pause();
  }));

  [1, 1.5, 2, 3, 4, 8, 16].forEach(rate => {
    panel.appendChild(makeButton(rate + 'x', () => {
      document.querySelectorAll('video').forEach(v => v.playbackRate = rate);
    }));
  });

  panel.appendChild(makeButton('PiP', async () => {
    const video = getVideo();
    if (!video) return alert('No video found.');
    try {
      await video.requestPictureInPicture();
    } catch {
      alert('PiP not supported here.');
    }
  }));

  panel.appendChild(makeButton('Download', () => {
    const video = getVideo();
    if (!video) return alert('No video found.');

    const src = video.currentSrc || video.src;
    if (!src) return alert('No downloadable source found.');

    const a = document.createElement('a');
    a.href = src;
    a.download = 'video.mp4';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }));

  document.body.appendChild(panel);
})();
