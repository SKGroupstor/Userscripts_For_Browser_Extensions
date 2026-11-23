// One-time script: moves files into folders by purpose. Run by .github/workflows/reorganize.yml, then deleted.
import fs from 'node:fs';
import path from 'node:path';

const S = 'scripts';
const moves = [];
const add = (from, to) => { if (fs.existsSync(from)) moves.push([from, to]); };

// General page tools
['sk-auto-expand', 'sk-clean-links', 'sk-cookie-banner-dismiss', 'sk-copy-markdown-link', 'sk-copy-table-csv',
  'sk-dark-mode', 'sk-enable-select-copy', 'sk-hide-in-print', 'sk-hide-sticky', 'sk-image-grabber',
  'sk-page-change-watcher', 'sk-reader-mode', 'sk-scroll-tools', 'sk-word-count', 'sk-youtube-ad-skipper']
  .forEach(n => add(`${S}/${n}.user.js`, `${S}/general/${n}.user.js`));

// Productivity
['sk-form-autofill', 'sk-product-glossary', 'sk-text-snippets']
  .forEach(n => add(`${S}/${n}.user.js`, `${S}/productivity/${n}.user.js`));

// Video helpers (not downloaders)
['sk-video-sorter', 'sk-video-hotkeys']
  .forEach(n => add(`${S}/${n}.user.js`, `${S}/video/${n}.user.js`));

// Site helpers, grouped by platform
['sk-amazon-product-helper', 'sk-seller-central-order-copy', 'sk-seller-central-table-copy',
  'sk-seller-central-ship-by-badge', 'sk-canadapost-to-seller-central']
  .forEach(n => add(`${S}/sites/${n}.user.js`, `${S}/sites/amazon/${n}.user.js`));

['sk-canadapost-helper', 'sk-canadapost-label-pdf', 'sk-fedex-tracking-helper', 'sk-address-paste-fill']
  .forEach(n => add(`${S}/sites/${n}.user.js`, `${S}/sites/shipping/${n}.user.js`));
add(`${S}/sk-tracking-detector.user.js`, `${S}/sites/shipping/sk-tracking-detector.user.js`);

['sk-woocommerce-admin', 'sk-wordpress-admin', 'sk-merchant-center-helper', 'sk-supplier-product-helper']
  .forEach(n => add(`${S}/sites/${n}.user.js`, `${S}/sites/store-admin/${n}.user.js`));

// Downloaders: the 90-variant MP4 matrix gets its own folder
const dl = `${S}/downloaders`;
if (fs.existsSync(dl)) {
  fs.readdirSync(dl).filter(f => /^\d{3}_SK_MP4_.*\.user\.js$/.test(f)).forEach(f => add(`${dl}/${f}`, `${dl}/mp4-matrix/${f}`));
}
add(`${dl}/INDEX.csv`, `${dl}/mp4-matrix/INDEX.csv`);
add(`${dl}/README.md`, `${dl}/mp4-matrix/README.md`);

// Older / overlapping HLS scripts are archived (renamed to .user.js so they install from a raw link)
add(`${dl}/sk-hls-to-mp4-downloader.js`, `${dl}/archive/sk-hls-to-mp4-downloader-v1.user.js`);
add(`${dl}/sk-universal-hls-to-mp4-downloader.js`, `${dl}/archive/sk-universal-hls-to-mp4-downloader-v2.user.js`);
add(`${dl}/sk-smart-universal-video-download-detector.js`, `${dl}/archive/sk-smart-universal-video-download-detector-v3.user.js`);
add(`${dl}/sk-smart-video-download-controller.js`, `${dl}/archive/sk-smart-video-download-controller-v1.user.js`);
add(`${dl}/m3u8-stream-detector.js`, `${dl}/archive/m3u8-stream-detector.user.js`);

// The current all-in-one controller stays in downloaders/, with a consistent file name
add(`${dl}/SK_Universal_Video_Controller_v4.user.js`, `${dl}/sk-universal-video-controller-v4.user.js`);

for (const [from, to] of moves) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
}
console.log(`Moved ${moves.length} files.`);
