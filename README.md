# Userscripts_For_Browser_Extensions

(Formerly `Stay_Browser_Extension_Scripts`.)

Userscripts for the [Stay](https://apps.apple.com/app/stay-for-safari/id1591620171) browser extension (Safari on iOS/macOS) and for Violentmonkey / Tampermonkey on Chrome and Edge.

## Install

This repo is **private**, so raw links don't work. Open a file on GitHub, click **Copy raw file**, then in Violentmonkey click **+** -> **New** and paste (Stay: use its built-in script editor). To update a script, open it in the editor, select all, paste the new version and save. Violentmonkey sync (OneDrive) copies it to your other profiles and devices.

## Layout

```
scripts/
  sites/         site-specific helpers (Amazon Seller Central, Canada Post, FedEx, WooCommerce, suppliers, Merchant Center)
  downloaders/   video / file / image scrapers and downloaders
  originals/     the first five video scripts (unchanged)
  *.user.js      general tools that work on any site
```

All SK scripts put a small floating button on the **left** edge (bottom-up), tag their UI with `data-sk`, and never submit forms or take actions for you. Install `sk-hide-in-print` once and every SK button/panel/toast is hidden when printing or saving as PDF.

Scripts that remember data across sites use `GM_getValue` / `GM_setValue`: `sk-product-glossary`, `sk-form-autofill`, `sk-text-snippets`, `sk-canadapost-to-seller-central`. Script names avoid special characters (`>`, `#`) so cloud-sync file names are accepted.

---

## By workflow

### Shipping an Amazon order (Seller Central -> Canada Post / FedEx)

| Step | Script | Button | What it does |
| --- | --- | --- | --- |
| 1 | `sites/sk-seller-central-ship-by-badge` | (badge) | Colour-coded "ship by" countdown at the top of order pages |
| 2 | `sites/sk-seller-central-order-copy` | **Ship** | Copy buyer name, address, phone, item(s); Copy all or a spreadsheet row |
| 3 | `sites/sk-address-paste-fill` | **Addr** | On Canada Post / FedEx forms: paste that address and fill the recipient section |
| 4 | `sites/sk-canadapost-label-pdf` | **PDF#** | Reads the tracking number out of the Canada Post label PDF, no spaces |
| 4 | `sites/sk-canadapost-to-seller-central` | **CP#** | Grabs a tracking number from a Canada Post page, no spaces |
| 5 | `sites/sk-canadapost-to-seller-central` | **Trk** | Fills Seller Central's Tracking ID box (you click Confirm) |

### Amazon Seller Central (.ca / .com)

| Script | What it does |
| --- | --- |
| `sites/sk-seller-central-order-copy` | **Ship** button on order details (see above) |
| `sites/sk-seller-central-table-copy` | **Tbl** button on any Seller Central page: copy the visible table as a spreadsheet, or all order IDs / ASINs on the page |
| `sites/sk-seller-central-ship-by-badge` | Earliest "Ship by" date with days left; red = overdue/today, orange = tomorrow |
| `sites/sk-canadapost-to-seller-central` | Tracking number transfer (see above) |
| `sites/sk-amazon-product-helper` | amazon.ca / .com product pages: ASIN, price, seller, stock; copy row or clean link |

### Canada Post

| Script | What it does |
| --- | --- |
| `sites/sk-canadapost-helper` | Tracking links for pasted numbers; postal-code formatter and validator |
| `sites/sk-canadapost-label-pdf` | Label PDF -> tracking number (no spaces) |
| `sites/sk-canadapost-to-seller-central` | Tracking number to Seller Central |
| `sites/sk-address-paste-fill` | Fill the recipient section of a shipping form from a copied address |

### FedEx

| Script | What it does |
| --- | --- |
| `sites/sk-fedex-tracking-helper` | Paste or scan tracking numbers, track up to 30 at once, recent list |
| `sites/sk-address-paste-fill` | Fill the recipient section of a shipping form from a copied address |

### Any site

| Script | What it does |
| --- | --- |
| `sk-tracking-detector` | **Pkg** button: finds Canada Post / FedEx numbers on the page (or in your selection); open the tracking page or copy with no spaces |
| `sk-text-snippets` | **Txt** button: insert saved replies into any text box ({date}, {site}, {title}, {url}); edit your own |
| `sk-product-glossary` | Save products (Name, Model, Price, Currency, Date, URL) and sync to a Google Sheet |
| `sk-form-autofill` | Fill business/contact/shipping details from named profiles |
| `sk-hide-in-print` | Hide all SK buttons/panels when printing |

### Product sourcing and store admin

| Script | Sites | What it does |
| --- | --- | --- |
| `sites/sk-supplier-product-helper` | amerex-fire.com, biz.amerex-fire.com, herbertwilliams.com, Safety Plus Pro | Name / SKU / price / stock; copy a row, Markdown, or PDF links |
| `sites/sk-woocommerce-admin` | WooCommerce `/wp-admin/` | Quick-nav; copy shipping / billing address and order summary |
| `sites/sk-wordpress-admin` | WordPress `/wp-admin/` | Quick-nav, Ctrl/Cmd+S to save, collapsible notices |
| `sites/sk-merchant-center-helper` | merchants.google.com | Account-preserving nav; copy visible table as TSV (read-only) |

---

## All scripts

### General tools (`scripts/`)

`sk-clean-links` (strip tracking params), `sk-copy-table-csv`, `sk-enable-select-copy`, `sk-dark-mode`, `sk-reader-mode`, `sk-auto-expand`, `sk-scroll-tools`, `sk-page-change-watcher`, `sk-image-grabber`, `sk-video-hotkeys`, `sk-cookie-banner-dismiss`, `sk-copy-markdown-link`, `sk-word-count`, `sk-hide-sticky`, `sk-youtube-ad-skipper`, plus the any-site tools listed above.

### Downloaders (`scripts/downloaders/`)

| Script | What it does |
| --- | --- |
| `sk-html-video-download` | Lists each `<video>` on the page, downloads with a progress readout |
| `sk-video-sniffer-download` | Watches network requests for video/audio files and stream manifests |
| `sk-video-scraper` | Video files on this page, or crawl the whole site |
| `sk-file-scraper` | PDFs, Office docs, archives, CAD files: this page or whole site |
| `sk-image-scraper` | Images (lazy-loaded, srcset, backgrounds) with full-size upgrade: this page or whole site |

Site crawls stay on the current domain, read `robots.txt` and the sitemap, skip login / cart / checkout / admin URLs, fetch sequentially with a short delay, and are capped (default 40 pages, max 300). Only use them on sites you own or have permission to copy from. DRM-protected streams can't be saved.

### Originals (`scripts/originals/`)

`all-in-one-video-tool`, `download-current-video`, `picture-in-picture`, `universal-speed-controller`, `force-video-play-pause` (kept as first written; their buttons sit bottom-right, are not tagged `data-sk`, and run on every site).

---

## Notes

- Helpers read live page structure, so a site redesign can break a selector. Each script header notes its assumptions.
- The Safety Plus Pro domain in `sk-supplier-product-helper` is a placeholder - edit its `@match` lines if it differs.
- Product glossary -> Google Sheet: create a Google Form with 7 short-answer questions (`Name`, `Model`, `Price`, `Currency`, `Date`, `URL`, `Site`), link it to a Sheet, copy the form's pre-filled link (type each question title as its answer), then glossary star button -> Setup -> Connect Google Form.
- Scripts never fill the package contents / goods description on shipping forms: for regulated goods that wording must be entered by you.
