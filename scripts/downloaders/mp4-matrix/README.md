# SK MP4 Userscript Library — 90 variants

These are 90 distinct detector/action combinations (10 discovery sources × 9 actions), not 90 independent video conversion engines. All operate on **direct, discoverable HTTP(S) `.mp4` URLs only**. They do not download HLS `.m3u8`, DASH `.mpd`, DRM streams, or `blob:` MediaSource streams. The `open`, `copy`, `share`, and `preview` variants are **helpers**, not automatic downloads.

## Install
Install **one script at a time** in Stay; do not enable all 90 simultaneously. Each adds a floating panel. Start with `001` (video src + anchor), `002` (video src + fetch blob), `029` (video currentSrc + fetch blob), `047` (anchors + fetch blob), or `083` (performance resources + fetch blob).

## iOS caveats
Download attribute may be ignored; fetch/XHR can fail due to CORS; GM_download depends on extension support; very large blobs may exhaust memory. MP4 extension does not guarantee the file is actually an MP4. Only use on videos you have rights to download.

## Numbering
See INDEX.csv for the full numbered catalogue.
