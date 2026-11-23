# Userscripts_For_Browser_Extensions

Small userscripts for Violentmonkey / Tampermonkey (Chrome, Edge, Firefox) and Stay (Safari on iPhone, iPad and Mac).

## Install

Every script has an install link in [INSTALL.md](INSTALL.md).

- **Stay:** copy a link (long-press, Copy Link) and add it as a script by URL.
- **Violentmonkey / Tampermonkey:** open the link and confirm, or use "Install from URL".
- **Updates:** scripts installed from these links check for newer versions on their own.

Install only the scripts you need. Most add one small round button on the left edge of the page. `general/sk-hide-in-print` hides all of them when you print.

Use at your own risk, and only download or copy video and files you have the right to. DRM-protected streams can't be saved and these scripts don't try.

## Folders

```
scripts/
  general/        page tools that work on any site
  productivity/   form autofill, product glossary, text snippets
  video/          video sorter and keyboard shortcuts
  downloaders/    video, file and image downloaders / scrapers
    mp4-matrix/   90 single-purpose MP4 variants (see its README and INDEX.csv)
    archive/      earlier HLS scripts kept for reference
  sites/
    amazon/       Amazon product pages and Seller Central helpers
    shipping/     Canada Post, FedEx and tracking-number helpers
    store-admin/  WooCommerce, WordPress, Merchant Center, supplier product pages
  originals/      the first five video scripts, unchanged
```

## General (`scripts/general/`)

| Script | What it does |
| --- | --- |
| `sk-clean-links` | Strips tracking parameters (`utm_*`, `fbclid`, `gclid`, ...) from the address bar and clicked links |
| `sk-copy-table-csv` | Tap to cycle tables, long-press to copy one as CSV |
| `sk-enable-select-copy` | Re-enables text selection, copy and right-click on locked-down sites |
| `sk-dark-mode` | Per-site dark mode toggle |
| `sk-reader-mode` | Clean reading overlay for articles |
| `sk-auto-expand` | Clicks "Read more / Show more" for you (capped) |
| `sk-scroll-tools` | Jump to top/bottom and hands-free auto-scroll |
| `sk-page-change-watcher` | Auto-reload and alert when a page or one element changes |
| `sk-image-grabber` | Gallery of page images with copy-all-URLs |
| `sk-cookie-banner-dismiss` | Rejects cookie banners (never accepts) |
| `sk-copy-markdown-link` | Copies the page, or your selection, as Markdown |
| `sk-word-count` | Word count and reading time |
| `sk-hide-sticky` | Hides / restores fixed and sticky overlays |
| `sk-hide-in-print` | Hides all button/panels from these scripts when printing |
| `sk-youtube-ad-skipper` | Skips YouTube video ads |

## Productivity (`scripts/productivity/`)

| Script | What it does |
| --- | --- |
| `sk-form-autofill` | Tap-to-fill details from named profiles. Never touches password, card, bank or ID-number fields; skips hidden fields; never submits |
| `sk-product-glossary` | Save a product (name, model, price, date, URL) from any site and sync rows to a Google Sheet through a Google Form you create |
| `sk-text-snippets` | Insert saved replies into any text box ({date}, {site}, {title}, {url}) |

## Video (`scripts/video/`)

| Script | What it does |
| --- | --- |
| `sk-video-sorter` | Re-sort a video grid by title, duration, views, date, rating or episode number, with a different sort per page. Endless-scroll pages: loads everything first, then sorts |
| `sk-video-hotkeys` | `]` `[` speed, `\` reset, Shift+arrows seek, Shift+M mute, Shift+P picture-in-picture |

## Downloaders (`scripts/downloaders/`)

| Script | What it does |
| --- | --- |
| `sk-universal-video-controller-v4` | One button that picks the right method for direct MP4 and compatible HLS streams, with player detection |
| `sk-html-video-download` | Lists each `<video>` on the page and downloads it with a progress readout |
| `sk-video-sniffer-download` | Watches network requests for video/audio files and stream manifests |
| `sk-video-scraper` | Finds video files on this page or crawls the site (same domain only) |
| `sk-file-scraper` | Same, for PDFs, Office documents, archives and CAD files |
| `sk-image-scraper` | Same, for images, with a full-size upgrade for WordPress thumbnails |

Site crawls stay on one domain, read `robots.txt` and the sitemap, fetch slowly and are capped. Only use them on sites you own or have permission to copy from.

## Sites (`scripts/sites/`)

| Folder | Scripts |
| --- | --- |
| `amazon/` | `sk-amazon-product-helper`, `sk-seller-central-order-copy`, `sk-seller-central-table-copy`, `sk-seller-central-ship-by-badge`, `sk-canadapost-to-seller-central` |
| `shipping/` | `sk-canadapost-helper`, `sk-canadapost-label-pdf`, `sk-fedex-tracking-helper`, `sk-address-paste-fill`, `sk-tracking-detector` |
| `store-admin/` | `sk-woocommerce-admin`, `sk-wordpress-admin`, `sk-merchant-center-helper`, `sk-supplier-product-helper` |

These read the live page structure, so a site redesign can break a selector. Each script's header describes what it expects.

**Google Sheet export (`sk-seller-central-order-copy`, `sk-product-glossary`):** create a Google Form whose short-answer questions are titled as listed in the script's header, link it to a Sheet, copy the form's pre-filled link, and paste it into the script's setup button. Keep your own form link private. `sk-seller-central-order-copy` has no auto-update header, so a private copy with your own connection details isn't overwritten.
