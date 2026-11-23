// One-time script: adds @updateURL / @downloadURL to every userscript and writes INSTALL.md.
// Run by .github/workflows/autoupdate.yml, then deleted.
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://raw.githubusercontent.com/SKGroupstor/Userscripts_For_Browser_Extensions/main/';

// Scripts that a person may customise privately (e.g. built-in connection details): no auto-update header.
const EXCLUDE = new Set(['scripts/sites/amazon/sk-seller-central-order-copy.user.js']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.user.js')) out.push(p);
  }
  return out;
}

const files = walk('scripts').map(f => f.split(path.sep).join('/')).sort();
let changed = 0, skipped = 0;

for (const rel of files) {
  if (EXCLUDE.has(rel)) { skipped++; continue; }
  let src = fs.readFileSync(rel, 'utf8');
  const start = src.indexOf('// ==UserScript==');
  const end = src.indexOf('// ==/UserScript==');
  if (start < 0 || end < 0 || end < start) { skipped++; continue; }
  const header = src.slice(start, end);
  if (/@updateURL/.test(header) || /@downloadURL/.test(header)) { skipped++; continue; }
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const url = BASE + rel.split('/').map(encodeURIComponent).join('/');
  const insert = '// @updateURL    ' + url + eol + '// @downloadURL  ' + url + eol;
  src = src.slice(0, end) + insert + src.slice(end);
  fs.writeFileSync(rel, src);
  changed++;
}

// INSTALL.md: one link per script, grouped by folder
const groups = new Map();
for (const rel of files) {
  const dir = path.posix.dirname(rel);
  if (!groups.has(dir)) groups.set(dir, []);
  groups.get(dir).push(rel);
}
let md = '# Install links\n\n' +
  'Copy a link (long-press \u2192 Copy Link on iPhone) and add it as a script by URL in Stay, Violentmonkey or Tampermonkey. ' +
  'Scripts installed from these links update automatically when a newer version is published here.\n\n' +
  'Install only the scripts you need; many add a button to every page.\n';
for (const [dir, list] of groups) {
  md += '\n## ' + dir + '\n\n';
  for (const rel of list) {
    const name = path.posix.basename(rel).replace(/\.user\.js$/, '');
    md += '- [' + name + '](' + BASE + rel.split('/').map(encodeURIComponent).join('/') + ')\n';
  }
}
fs.writeFileSync('INSTALL.md', md);

console.log('Updated ' + changed + ' scripts, skipped ' + skipped + ', indexed ' + files.length + '.');
