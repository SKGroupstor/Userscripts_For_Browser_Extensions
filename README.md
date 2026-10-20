# Stay_Browser_Extension_Scripts

Userscripts for the [Stay](https://apps.apple.com/app/stay-for-safari/id1591620171) browser extension (Safari on iOS/macOS) and Microsoft Edge.

All scripts in `scripts/` use `@grant none` (no `GM_*` APIs), so they work in Stay, Tampermonkey and Violentmonkey. Floating buttons stack up the **left** edge of the screen so they don't overlap the right-side panels of the original video tools.

## Install

In Stay, add a script from URL using the raw link, e.g.
`https://raw.githubusercontent.com/SKGroupstor/Stay_Browser_Extension_Scripts/main/scripts/sk-dark-mode.user.js`

## Scripts

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

The original scripts (All In One Video Tool, Universal Speed Controller, Picture-In-Picture, etc.) remain in the repo root.
