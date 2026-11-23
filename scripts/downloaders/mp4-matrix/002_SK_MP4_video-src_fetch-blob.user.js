// ==UserScript==
// @name         SK MP4 002 - video-src / fetch-blob
// @namespace    https://skgroups.ca/userscripts
// @version      1.0
// @description  Discover direct MP4 URLs and invoke fetch-blob. No DRM/CORS bypass.
// @match        *://*/*
// @run-at       document-idle
// @grant        GM_download
// ==/UserScript==
(() => {
'use strict';
const MODE = 'video-src', METHOD = 'fetch-blob';
const urls = new Set();
function add(raw) {
 try {
  if (!raw || typeof raw !== 'string') return;
  const u = new URL(raw, location.href);
  if (!/^https?:$/.test(u.protocol)) return;
  if (!/\.mp4(?:$|[?#])/i.test(u.href)) return;
  urls.add(u.href);
 } catch (_) {}
}
function scan() {
 const select = {
  'video-src': 'video[src]',
  'video-source': 'video source[src]',
  'source-type': 'source[type="video/mp4"]',
  'video-current': 'video',
  'video-poster-neighbor': 'video',
  'anchor-mp4': 'a[href]',
  'data-src': '[data-src]',
  'data-video': '[data-video]',
  'meta-video': 'meta[property="og:video"],meta[name="twitter:player:stream"]'
 };
 if (MODE === 'performance') {
  performance.getEntriesByType('resource').forEach(x => add(x.name));
 } else {
  document.querySelectorAll(select[MODE]).forEach(el => {
   if (MODE === 'video-current') add(el.currentSrc || el.src);
   else if (MODE === 'video-poster-neighbor') {
    add(el.currentSrc); el.querySelectorAll('source').forEach(s => add(s.src));
   } else if (MODE === 'anchor-mp4') add(el.href);
   else if (MODE === 'data-src') add(el.dataset.src);
   else if (MODE === 'data-video') add(el.dataset.video);
   else if (MODE === 'meta-video') add(el.content);
   else add(el.src);
  });
 }
 draw();
}
function save(blob, name) {
 const u = URL.createObjectURL(blob), a = document.createElement('a');
 a.href=u; a.download=name; document.body.append(a); a.click(); a.remove();
 setTimeout(() => URL.revokeObjectURL(u), 120000);
}
async function run(url) {
 const name = 'SK-video-' + Date.now() + '.mp4';
 if (METHOD === 'copy') {
  await navigator.clipboard.writeText(url); return 'MP4 URL copied';
 }
 if (METHOD === 'share') {
  if (!navigator.share) throw Error('Web Share unavailable');
  await navigator.share({url}); return 'Share sheet opened';
 }
 if (METHOD === 'open') {
  window.open(url, '_blank'); return 'MP4 URL opened';
 }
 if (METHOD === 'preview') {
  const v=document.createElement('video'); v.controls=true; v.src=url;
  v.style.cssText='width:100%;max-height:220px';
  document.querySelector('#sk-mp4-panel').append(v); return 'Preview opened';
 }
 if (METHOD === 'anchor') {
  const a=document.createElement('a'); a.href=url; a.download=name;
  document.body.append(a); a.click(); a.remove(); return 'Download requested';
 }
 if (METHOD === 'gm-download') {
  if (typeof GM_download !== 'function') throw Error('GM_download unavailable in this extension');
  GM_download({url,name,onerror:e=>alert('GM download failed: '+JSON.stringify(e))});
  return 'GM download requested';
 }
 if (METHOD === 'xhr-blob') {
  const blob=await new Promise((resolve,reject)=>{
   const x=new XMLHttpRequest(); x.open('GET',url); x.responseType='blob';
   x.onload=()=>x.status>=200&&x.status<300?resolve(x.response):reject(Error('HTTP '+x.status));
   x.onerror=()=>reject(Error('XHR blocked or failed')); x.send();
  }); save(blob,name); return 'Blob download requested';
 }
 const response=await fetch(url,{credentials:'include'});
 if (!response.ok) throw Error('HTTP '+response.status);
 if (METHOD === 'fetch-blob') {
  save(await response.blob(),name); return 'Blob download requested';
 }
 if (METHOD === 'fetch-stream') {
  if (!response.body) throw Error('ReadableStream unavailable');
  const reader=response.body.getReader(), chunks=[]; let size=0;
  while (true) {
   const {done,value}=await reader.read(); if(done) break;
   size+=value.byteLength;
   if(size>350*1024*1024) {await reader.cancel();throw Error('350MB safety limit');}
   chunks.push(value);
  }
  save(new Blob(chunks,{type:'video/mp4'}),name);
  return 'Stream download requested';
 }
 throw Error('Unknown method');
}
let panel;
function draw() {
 if(!document.body) return;
 if(!panel) {
  panel=document.createElement('div'); panel.id='sk-mp4-panel';
  panel.style.cssText='position:fixed;bottom:12px;right:10px;z-index:2147483647;background:#181818;color:white;padding:12px;border-radius:10px;max-width:85vw;max-height:45vh;overflow:auto;font:13px sans-serif';
  document.body.append(panel);
 }
 panel.replaceChildren();
 const title=document.createElement('div'); title.textContent='SK MP4 | '+MODE+' | '+METHOD+' ('+urls.size+')';panel.append(title);
 const refresh=document.createElement('button');refresh.textContent='Rescan';refresh.onclick=scan;panel.append(refresh);
 for(const url of urls) {
  const row=document.createElement('div');row.style.marginTop='8px';
  const b=document.createElement('button');b.textContent=METHOD+' MP4';
  const s=document.createElement('span');s.style.marginLeft='6px';
  b.onclick=async()=>{b.disabled=true;s.textContent='Working…';try{s.textContent=await run(url)}catch(e){s.textContent=e.message}finally{b.disabled=false}};
  const label=document.createElement('div');label.textContent=url.slice(0,75);label.style.cssText='overflow-wrap:anywhere;font-size:10px';
  row.append(b,s,label);panel.append(row);
 }
}
scan();
new MutationObserver(()=>{clearTimeout(window.__skMp4ScanTimer);window.__skMp4ScanTimer=setTimeout(scan,700)}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','href','data-src','data-video']});
setInterval(scan,4000);
})();
