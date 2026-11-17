# Stay_Browser_Extension_Scripts

Userscripts for the [Stay](https://apps.apple.com/app/stay-for-safari/id1591620171) browser extension (Safari on iOS/macOS) and Microsoft Edge. They also run in Violentmonkey / Tampermonkey on Chrome and Edge.

Most scripts in `scripts/` use `@grant none` (no `GM_*` APIs). The scripts that need to remember data across sites (`sk-product-glossary`, `sk-form-autofill`, `sk-canadapost-to-seller-central`) use `GM_getValue` / `GM_setValue`. Floating buttons stack up the **left** edge of the screen so they don't overlap the right-side panels of the original video tools.

## Install

In Stay, add a script from URL using the raw link, e.g.
`https://raw.githubusercontent.com/SKGroupstor/Stay_Browser_Extension_Scripts/main/scripts/sk-dark-mode.user.js`

Folders: `scripts/` (general tools), `scripts/sites/` (site-specific helpers), `scripts/downloaders/` (video / file / image scrapers).

## Productivity (`scripts/`)

| Script | What it does |
| --- | --- |
| `sk-product-glossary` | Save a product (Name, Model, Price, Currency, Date, URL) from any site with one tap. Auto-detects the fields (Amazon, JSON-LD, page text), lets you correct them or use selected text, flags price changes vs. earlier saves, has quick search, and syncs rows to a Google Sheet |
| `sk-form-autofill` | Tap-to-fill business/contact/shipping details from named profiles. Never fills passwords, card, bank or ID-number fields; skips hidden fields; never submits |

### Product glossary -> Google Sheet setup

1. Create a Google Form with 7 short-answer questions titled exactly: `Name`, `Model`, `Price`, `Currency`, `Date`, `URL`, `Site`.
2. In the Form: **Responses** -> **Link to Sheets**. That spreadsheet is where you view everything.
3. Form menu -> **Get pre-filled link**, type each question's own title as its answer, **Get link**, copy it.
4. In the glossary: star button -> **Setup** -> **Connect Google Form** -> paste the link.

Alternative: **Use a webhook instead** with a Zapier "Catch Hook" (-> Google Sheets "Create Spreadsheet Row") or a Make webhook. Fields sent: `name, model, price, currency, date, url, site`.

Products are always stored on the device first; unsynced ones show a hollow dot and can be synced from the Glossary tab. Copy all (TSV) and Export CSV are also there.

## General tools (`scripts/`)

| Script | What it does |
| --- | --- |
| `sk-clean-links` | Strips `utm_*`, `fbclid`, `gclid` etc. from the URL and clicked links |
| `sk-copy-table-csv` | Tap to cycle tables, long-press to copy the highlighted one as CSV |
| `sk-enable-select-copy` | Re-enables selection, copy and right-click on locked-down sites |
| `sk-dark-mode` | Per-site dark mode toggle |
| `sk-reader-mode` | Clean reading overlay for articles |
| `sk-auto-expand` | Auto-clicks "Read more / Show more" (capped) |
| `sk-scroll-tools` | Jump top/bottom plus hands-free auto-scroll |
| `sk-page-change-watcher` | Auto-reload and alert when a page (or selector) changes |
| `sk-image-grabber` | Gallery of page images with copy-all-URLs |
| `sk-video-hotkeys` | `]` `[` speed, `\` reset, Shift+arrows seek, Shift+M mute, Shift+P PiP |
| `sk-cookie-banner-dismiss` | Auto-rejects cookie banners (never accepts) |
| `sk-copy-markdown-link` | Copies page link, or selection as a quote, in Markdown |
| `sk-word-count` | Word count and reading time for page or selection |
| `sk-hide-sticky` | Hides/restores fixed and sticky overlays |
| `sk-youtube-ad-skipper` | Skips YouTube video ads |

## Site helpers (`scripts/sites/`)

| Script | Sites | What it does |
| --- | --- | --- |
| `sk-woocommerce-admin` | Any WooCommerce `/wp-admin/` | Quick-nav (Orders, Products, Coupons, Analytics, Settings, Status...) and, on order screens, copy shipping / billing address and an order summary |
| `sk-wordpress-admin` | Any WordPress `/wp-admin/` | Quick-nav, Ctrl/Cmd+S to save in classic editor / WC product screens, collapsible admin notices, Remember Me ticked on login |
| `sk-supplier-product-helper` | amerex-fire.com, biz.amerex-fire.com, herbertwilliams.com, Safety Plus Pro | Reads name / SKU / price / stock (JSON-LD first, page text as fallback); copy a spreadsheet row, Markdown, or the page's PDF links |
| `sk-amazon-product-helper` | amazon.ca, amazon.com | ASIN, price, seller, stock; copy row / clean `/dp/` link; open same ASIN on the other marketplace |
| `sk-fedex-tracking-helper` | fedex.com | Paste or scan tracking numbers, track up to 30 at once, recent list |
| `sk-canadapost-helper` | canadapost-postescanada.ca | Tracking number links and a postal-code formatter / validator |
| `sk-canadapost-to-seller-central` | Canada Post + sellercentral.amazon.ca / .com | **CP#** on the label page grabs the tracking number with all spaces removed; **Trk** on Confirm Shipment fills the Tracking ID field. Manual pastes into a tracking field are also stripped of spaces. Never submits the shipment |
| `sk-merchant-center-helper` | merchants.google.com | Account-preserving quick-nav and copy visible table as TSV (read-only) |

These helpers read the live page structure, so a site redesign can break a selector. Each script's header notes its assumptions. The Safety Plus Pro domain in `sk-supplier-product-helper` is a placeholder - edit the `@match` lines if it differs.

## Downloaders (`scripts/downloaders/`)

| Script | What it does |
| --- | --- |
| `sk-html-video-download` | Lists each `<video>` on the page, downloads with a progress readout; says so when a player is stream-only |
| `sk-video-sniffer-download` | Watches fetch / XHR / resource timing (including iframes) for video and audio files and stream manifests |
| `sk-video-scraper` | Finds video files on **this page** or **crawls the whole site** |
| `sk-file-scraper` | Same for PDFs, Office docs, archives, CAD files |
| `sk-image-scraper` | Same for images, including lazy-loaded / srcset / background images, with a full-size upgrade for WordPress thumbnails |

Site crawls stay on the current domain, read `robots.txt` and the sitemap, skip login / cart / checkout / admin URLs, fetch sequentially with a short delay, and are capped (default 40 pages, max 300). Only use them on sites you own or have permission to copy from. DRM-protected streams (and HLS/DASH manifests as a single file) can't be saved; the sniffer lists manifest URLs so you can use a dedicated tool.

The original scripts (All In One Video Tool, Universal Speed Controller, Picture-In-Picture, etc.) remain in the repo root.
