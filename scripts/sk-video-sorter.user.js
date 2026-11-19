// ==UserScript==
// @name         SK Video Sorter
// @namespace    skgroups
// @version      1.0
// @description  Re-sort any video/thumbnail list on any website by title, duration, views, date, rating or episode number, overriding the site's own sort. Each page can have its own sort (or one default per site), and it is re-applied when the list reloads.
// @match        *://*/*
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// ==/UserScript==

// HOW TO USE
//  1. Open a page that lists videos (a grid or list of thumbnails with titles).
//  2. Tap the "Sort" button (bottom left), pick a sort method, tap Apply.
//  3. "Remember for" decides where the choice is saved: this page, the whole site, or not at all.
//     Next time you open that page the sort is applied automatically. Another page can use a different sort.
//  4. If it sorts the wrong list (e.g. "related videos"), tap "Pick list", then tap any video in the list you want.
//  5. Sites that load more videos as you scroll or by "next page": tap "Load all" to load them first.
//
// HOW IT WORKS
//  It finds the repeated video cards, reads each card's title, duration, view count, age/date and rating
//  from the text on the card, and reorders the cards on the page. The site's own sort menu keeps working;
//  this script re-applies your order on top whenever the list changes. Nothing is sent anywhere.
//  It can only sort what is on the page, and fields a card doesn't show (e.g. no view count) sort last.
//  Pages that rebuild their list constantly (some single-page apps) may fight the sort; the script pauses
//  itself if that happens.

(function () {
  'use strict';
  if (window.top !== window.self) return;

  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const slot = (W.__skFab = (W.__skFab || 0) + 1);
  const KEY = 'sk_vsort_v1';

  const store = {
    get(k, d) {
      try {
        const raw = typeof GM_getValue === 'function' ? GM_getValue(k) : localStorage.getItem(k);
        return raw == null ? d : JSON.parse(raw);
      } catch { return d; }
    },
    set(k, v) {
      try {
        const s = JSON.stringify(v);
        if (typeof GM_setValue === 'function') GM_setValue(k, s); else localStorage.setItem(k, s);
      } catch {}
    }
  };
  const getCfg = () => { const c = store.get(KEY, null) || {}; c.pages = c.pages || {}; c.sites = c.sites || {}; return c; };
  const pageKey = () => location.hostname + location.pathname.replace(/\/+$/, '');
  const siteKey = () => location.hostname;

  const METHODS = [
    ['orig', 'Site order (original)'],
    ['title-az', 'Title A \u2192 Z'], ['title-za', 'Title Z \u2192 A'],
    ['dur-long', 'Duration: longest first'], ['dur-short', 'Duration: shortest first'],
    ['views-most', 'Views: most first'], ['views-least', 'Views: least first'],
    ['new', 'Newest first'], ['old', 'Oldest first'],
    ['rating-high', 'Rating: highest first'], ['rating-low', 'Rating: lowest first'],
    ['num-asc', 'Number in title: low \u2192 high'], ['num-desc', 'Number in title: high \u2192 low'],
    ['random', 'Shuffle']
  ];

  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const txt = el => clean(el.innerText || el.textContent || '');
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  function mk(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------- reading a video card ----------
  function parseDuration(item, t) {
    const hints = [...item.querySelectorAll('[class*="duration" i],[class*="length" i],[class*="time" i],time')].map(txt);
    for (const s of hints.concat([t])) {
      let m = s.match(/\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/);
      if (m) return (+m[1] || 0) * 3600 + (+m[2]) * 60 + (+m[3]);
      m = s.match(/(\d+)\s*(?:h|hr|hrs|hours?)\b\s*(?:(\d+)\s*(?:m|min|mins|minutes?)\b)?/i);
      if (m) return (+m[1]) * 3600 + (+m[2] || 0) * 60;
      m = s.match(/(\d+)\s*(?:m|min|mins|minutes?)\b/i);
      if (m) return (+m[1]) * 60;
    }
    return null;
  }

  function toCount(numStr, suffix) {
    const n = parseFloat(String(numStr).replace(/,/g, ''));
    if (isNaN(n)) return null;
    const mult = { K: 1e3, M: 1e6, B: 1e9 }[(suffix || '').toUpperCase()] || 1;
    return n * mult;
  }

  function parseViews(item, t) {
    let m = t.match(/(\d[\d.,]*)\s*([KMB])?\s*(?:views?|plays?|watch(?:es|ed)?)\b/i);
    if (m) return toCount(m[1], m[2]);
    const hint = item.querySelector('[class*="view" i]');
    if (hint) {
      m = txt(hint).match(/(\d[\d.,]*)\s*([KMB])?/i);
      if (m) return toCount(m[1], m[2]);
    }
    return null;
  }

  function parseAge(item, t) {
    const tm = item.querySelector('time[datetime]');
    if (tm) { const d = Date.parse(tm.getAttribute('datetime')); if (!isNaN(d)) return Date.now() - d; }
    let m = t.match(/(\d+|an?|one)\s*(second|sec|minute|min|hour|hr|day|week|month|year|yr)s?\s*ago/i);
    if (m) {
      const n = /^(an?|one)$/i.test(m[1]) ? 1 : +m[1];
      const ms = { second: 1e3, sec: 1e3, minute: 6e4, min: 6e4, hour: 36e5, hr: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6, yr: 31536e6 }[m[2].toLowerCase()];
      return n * ms;
    }
    m = t.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (m) { const d = Date.parse(m[0]); if (!isNaN(d)) return Date.now() - d; }
    m = t.match(/\b([A-Z][a-z]{2,8})\.?\s+(\d{1,2}),?\s+(\d{4})\b/);
    if (m) { const d = Date.parse(m[1] + ' ' + m[2] + ', ' + m[3]); if (!isNaN(d)) return Date.now() - d; }
    return null;
  }

  function parseRating(t) {
    let m = t.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
    if (m) return parseFloat(m[1]);
    m = t.match(/(\d(?:\.\d)?)\s*\/\s*5\b/);
    return m ? parseFloat(m[1]) * 20 : null;
  }

  function getTitle(item) {
    const a = [...item.querySelectorAll('a[href]')]
      .map(x => clean(x.getAttribute('title') || txt(x)))
      .filter(s => s.length > 2)
      .sort((x, y) => y.length - x.length)[0];
    const img = item.querySelector('img[alt]');
    return clean(a || (img && img.alt) || txt(item)).slice(0, 200);
  }

  const parseNum = title => { const m = title.match(/\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };

  // ---------- finding the list ----------
  const origIdx = new WeakMap();
  let origCounter = 0;
  const noteOrig = els => els.forEach(el => { if (!origIdx.has(el)) origIdx.set(el, ++origCounter); });

  function isItem(k) {
    return k.nodeType === 1 && !k.closest('[data-sk]') && k.querySelector('a[href]') &&
      (k.querySelector('img,video,picture,canvas,[class*="thumb" i]') || /\b\d{1,2}:\d{2}\b/.test(k.textContent));
  }

  function itemsOf(c) {
    const kids = [...c.children].filter(isItem);
    if (kids.length < 2) return kids;
    const counts = {};
    kids.forEach(k => { counts[k.tagName] = (counts[k.tagName] || 0) + 1; });
    const tag = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    return kids.filter(k => k.tagName === tag);
  }

  function autoDetect() {
    let best = null, bestScore = 0;
    for (const el of document.body.querySelectorAll('*')) {
      if (el.children.length < 4 || el.closest('nav,header,footer,[data-sk]')) continue;
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
      const items = itemsOf(el);
      if (items.length < 4) continue;
      const withDur = items.filter(i => /\b\d{1,2}:\d{2}\b/.test(i.textContent)).length;
      const score = items.length + withDur;
      if (score > bestScore) { bestScore = score; best = el; }
    }
    return best;
  }

  function cssPath(el) {
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      if (cur.id && !/\d{4,}/.test(cur.id)) { parts.unshift('#' + CSS.escape(cur.id)); break; }
      let s = cur.tagName.toLowerCase();
      const cls = [...cur.classList].filter(c => !/\d{3,}|active|hover|selected|open|loading/i.test(c)).slice(0, 2);
      if (cls.length) s += '.' + cls.map(c => CSS.escape(c)).join('.');
      else if (cur.parentElement) {
        const sibs = [...cur.parentElement.children].filter(x => x.tagName === cur.tagName);
        if (sibs.length > 1) s += ':nth-of-type(' + (sibs.indexOf(cur) + 1) + ')';
      }
      parts.unshift(s);
      cur = cur.parentElement;
      if (parts.length > 7) break;
    }
    const path = parts.join(' > ');
    try { return document.querySelector(path) === el ? path : null; } catch { return null; }
  }

  const state = { container: null, containerSel: null, method: 'orig', last: [], reapplies: [], paused: false };

  function savedRecord() { const c = getCfg(); return c.pages[pageKey()] || c.sites[siteKey()] || null; }

  function resolveContainer() {
    const rec = savedRecord();
    if (rec && rec.container) {
      try { const el = document.querySelector(rec.container); if (el && itemsOf(el).length >= 2) { state.containerSel = rec.container; return el; } } catch {}
    }
    const el = autoDetect();
    state.containerSel = el ? cssPath(el) : null;
    return el;
  }

  // ---------- sorting ----------
  const cmpNum = (a, b, dir) => (a == null && b == null) ? 0 : a == null ? 1 : b == null ? -1 : dir * (a - b);

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function reorder(items, sortedEls) {
    const markers = items.map(el => { const m = document.createComment('sk'); el.parentNode.insertBefore(m, el); return m; });
    items.forEach(el => el.remove());
    sortedEls.forEach((el, i) => markers[i].parentNode.insertBefore(el, markers[i]));
    markers.forEach(m => m.remove());
  }

  // returns stats about how many cards had each field
  function sortItems(method) {
    const c = state.container;
    if (!c || !c.isConnected) return null;
    const items = itemsOf(c);
    noteOrig(items);
    const data = items.map(el => {
      const t = txt(el);
      const title = getTitle(el);
      return { el, title, dur: parseDuration(el, t), views: parseViews(el, t), age: parseAge(el, t), rating: parseRating(t), num: parseNum(title), orig: origIdx.get(el) };
    });
    const by = {
      'orig': (a, b) => a.orig - b.orig,
      'title-az': (a, b) => collator.compare(a.title, b.title),
      'title-za': (a, b) => collator.compare(b.title, a.title),
      'dur-long': (a, b) => cmpNum(a.dur, b.dur, -1), 'dur-short': (a, b) => cmpNum(a.dur, b.dur, 1),
      'views-most': (a, b) => cmpNum(a.views, b.views, -1), 'views-least': (a, b) => cmpNum(a.views, b.views, 1),
      'new': (a, b) => cmpNum(a.age, b.age, 1), 'old': (a, b) => cmpNum(a.age, b.age, -1),
      'rating-high': (a, b) => cmpNum(a.rating, b.rating, -1), 'rating-low': (a, b) => cmpNum(a.rating, b.rating, 1),
      'num-asc': (a, b) => cmpNum(a.num, b.num, 1), 'num-desc': (a, b) => cmpNum(a.num, b.num, -1)
    };
    const sorted = method === 'random' ? shuffle(data) : data.slice().sort(by[method] || by.orig);
    const sortedEls = sorted.map(d => d.el);
    if (sortedEls.some((el, i) => el !== items[i])) reorder(items, sortedEls);
    state.last = sortedEls;
    const n = data.length;
    return {
      n,
      dur: data.filter(d => d.dur != null).length, views: data.filter(d => d.views != null).length,
      age: data.filter(d => d.age != null).length, rating: data.filter(d => d.rating != null).length,
      num: data.filter(d => d.num != null).length
    };
  }

  // Keep our order on top of the site's: if the list changes, re-sort (paused if the site fights back)
  setInterval(() => {
    if (state.paused || state.method === 'orig' || state.method === 'random') return;
    if (!state.container || !state.container.isConnected) { state.container = resolveContainer(); state.last = []; if (!state.container) return; }
    const cur = itemsOf(state.container);
    if (cur.length === state.last.length && cur.every((el, i) => el === state.last[i])) return;
    const now = Date.now();
    state.reapplies = state.reapplies.filter(t => now - t < 15000);
    state.reapplies.push(now);
    if (state.reapplies.length > 10) { state.paused = true; setStatus('This site keeps rebuilding the list, so auto re-sort is paused. Tap Apply to sort again.', true); return; }
    const st = sortItems(state.method);
    if (st) showStats(st);
  }, 1000);

  // ---------- saving ----------
  function saveChoice(method, scope) {
    if (scope === 'none') return;
    const c = getCfg();
    const rec = { method, container: state.containerSel || null };
    if (scope === 'site') c.sites[siteKey()] = rec; else c.pages[pageKey()] = rec;
    store.set(KEY, c);
  }

  function forget() {
    const c = getCfg();
    delete c.pages[pageKey()];
    delete c.sites[siteKey()];
    store.set(KEY, c);
  }

  // ---------- UI ----------
  const panel = mk('div', 'position:fixed;left:12px;right:12px;bottom:' + (12 + 50 * (slot - 1) + 50) + 'px;max-width:440px;max-height:78vh;overflow-y:auto;background:#111;color:#fff;border-radius:12px;padding:12px;display:none;z-index:2147483647;font:14px -apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)');
  panel.setAttribute('data-sk', '1');
  const status = mk('div', 'font-size:12px;color:#34c759;margin-top:8px;min-height:15px;line-height:1.5;white-space:pre-line');
  const setStatus = (m, warn) => { status.style.color = warn ? '#ff9f0a' : '#34c759'; status.textContent = m; };

  const FIELD_FOR = { 'dur-long': 'dur', 'dur-short': 'dur', 'views-most': 'views', 'views-least': 'views', 'new': 'age', 'old': 'age', 'rating-high': 'rating', 'rating-low': 'rating', 'num-asc': 'num', 'num-desc': 'num' };
  const FIELD_NAME = { dur: 'a duration', views: 'a view count', age: 'a date or age', rating: 'a rating', num: 'a number in the title' };

  function showStats(st) {
    const f = FIELD_FOR[state.method];
    let msg = st.n + ' videos \u00B7 durations ' + st.dur + ' \u00B7 views ' + st.views + ' \u00B7 dates ' + st.age + ' \u00B7 ratings ' + st.rating;
    let warn = false;
    if (f && st[f] < st.n) {
      warn = true;
      msg += '\nOnly ' + st[f] + ' of ' + st.n + ' show ' + FIELD_NAME[f] + '; the rest sort last.' + (st[f] === 0 ? ' This method won\u2019t work on this page.' : '');
    }
    setStatus(msg, warn);
  }

  function btn(label, fn, bg) {
    const b = mk('button', 'padding:9px 12px;margin:6px 6px 0 0;border:none;border-radius:6px;background:' + (bg || '#2c2c2e') + ';color:#fff;font-size:13px', label);
    b.onclick = fn;
    return b;
  }

  function pickMode(done) {
    const handler = e => {
      if (e.target.closest && e.target.closest('[data-sk]')) return;
      e.preventDefault(); e.stopPropagation();
      document.removeEventListener('click', handler, true);
      let el = e.target;
      for (let i = 0; i < 10 && el && el !== document.body; i++) {
        const p = el.parentElement;
        if (p) { const items = itemsOf(p); if (items.length >= 3 && items.includes(el)) return done(p); }
        el = p;
      }
      done(null);
    };
    document.addEventListener('click', handler, true);
  }

  let loading = false;
  async function loadAll() {
    if (loading) { loading = false; return; }
    loading = true;
    let same = 0, last = -1;
    for (let i = 0; i < 60 && loading; i++) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise(r => setTimeout(r, 900));
      const n = state.container ? itemsOf(state.container).length : document.querySelectorAll('a[href] img').length;
      setStatus('Loading more\u2026 ' + n + ' items (tap Load all again to stop)');
      same = n === last ? same + 1 : 0; last = n;
      if (same >= 2) break;
    }
    loading = false;
    window.scrollTo(0, 0);
  }

  function render() {
    panel.textContent = '';
    const rec = savedRecord();
    panel.appendChild(mk('div', 'font-weight:600;margin-bottom:6px', 'Video Sorter'));
    panel.appendChild(mk('div', 'font-size:11px;color:#8e8e93;margin-bottom:6px',
      rec ? 'Saved here: ' + ((METHODS.find(m => m[0] === rec.method) || [0, rec.method])[1]) : 'Nothing saved for this page yet.'));

    const sel = mk('select', 'width:100%;padding:9px;border-radius:6px;border:none;font-size:14px');
    METHODS.forEach(([v, l]) => { const o = mk('option', '', l); o.value = v; if (v === (state.method !== 'orig' ? state.method : (rec && rec.method) || 'new')) o.selected = true; sel.appendChild(o); });
    panel.appendChild(sel);

    const scopeWrap = mk('div', 'margin-top:8px;font-size:12px;color:#ccc');
    scopeWrap.appendChild(mk('div', '', 'Remember for:'));
    const scopes = [['page', 'This page only'], ['site', 'Whole site (default for all its pages)'], ['none', 'Don\u2019t remember']];
    const defaultScope = rec ? (getCfg().pages[pageKey()] ? 'page' : 'site') : 'page';
    scopes.forEach(([v, l]) => {
      const lab = mk('label', 'display:block;margin-top:3px');
      const r = mk('input'); r.type = 'radio'; r.name = 'sk-vs-scope'; r.value = v; r.checked = v === defaultScope;
      lab.append(r, document.createTextNode(' ' + l));
      scopeWrap.appendChild(lab);
    });
    panel.appendChild(scopeWrap);
    const scopeVal = () => (scopeWrap.querySelector('input:checked') || {}).value || 'page';

    const row = mk('div');
    row.append(
      btn('Apply', () => {
        if (!state.container || !state.container.isConnected) state.container = resolveContainer();
        if (!state.container) return setStatus('No video list found on this page. Tap "Pick list", then tap one video in the list you want to sort.', true);
        state.method = sel.value; state.paused = false; state.reapplies = [];
        const st = sortItems(state.method);
        if (!st) return setStatus('Couldn\u2019t sort this list.', true);
        saveChoice(state.method, scopeVal());
        showStats(st);
      }, '#34c759'),
      btn('Pick list', () => {
        panel.style.display = 'none';
        const note = mk('div', 'position:fixed;left:50%;top:14px;transform:translateX(-50%);background:#0a84ff;color:#fff;padding:10px 16px;border-radius:10px;font:600 14px -apple-system,sans-serif;z-index:2147483647', 'Tap any video in the list you want to sort');
        note.setAttribute('data-sk', '1');
        document.documentElement.appendChild(note);
        pickMode(el => {
          note.remove();
          panel.style.display = 'block';
          if (!el) return setStatus('That didn\u2019t look like a list of videos. Try tapping a thumbnail or title.', true);
          state.container = el; state.containerSel = cssPath(el); state.last = [];
          const st = sortItems(state.method);
          if (state.method !== 'orig') saveChoice(state.method, scopeVal());
          setStatus('List selected (' + itemsOf(el).length + ' videos). Choose a sort and tap Apply.' + (state.containerSel ? '' : '\n(Couldn\u2019t save this list for next time; it will be auto-detected.)'));
          if (st) void st;
        });
      }),
      btn('Load all', loadAll),
      btn('Reset', () => {
        state.method = 'orig';
        sortItems('orig');
        forget();
        setStatus('Back to the site\u2019s order. Saved sorts for this page and site were cleared.');
        render();
      }, '#5c2020'),
      btn('Close', () => { panel.style.display = 'none'; }, '#ff3b30')
    );
    panel.append(row, status);
  }

  const fab = mk('button', 'position:fixed;left:12px;bottom:' + (12 + 50 * (slot - 1)) + 'px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:none;background:#30b0c7;color:#111;font:700 11px -apple-system,sans-serif;opacity:.85;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'Sort');
  fab.setAttribute('data-sk', '1');
  fab.title = 'Sort the videos on this page';
  fab.onclick = () => { if (panel.style.display === 'none') { render(); panel.style.display = 'block'; } else panel.style.display = 'none'; };
  document.documentElement.append(panel, fab);

  // ---------- auto-apply saved sort ----------
  (function init() {
    const rec = savedRecord();
    if (!rec || !rec.method || rec.method === 'orig') return;
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      const c = resolveContainer();
      if (c) {
        clearInterval(t);
        state.container = c; state.method = rec.method;
        sortItems(rec.method);
      } else if (tries > 15) clearInterval(t);
    }, 1000);
  })();
})();
