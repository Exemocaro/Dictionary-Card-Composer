// Runs the matching parser on a page you saved from your browser and prints the card Back.
// Usage: node scripts/try-page.js <saved-page.html> <original page URL> [--json]
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

for (const file of ['lib/sites.js', 'lib/model.js', 'lib/render.js', 'parsers/common.js']) {
  require(path.join(__dirname, '..', file));
}
const DCC = globalThis.DCC;
for (const site of DCC.sites) require(path.join(__dirname, '..', site.parser));

const [file, url, flag] = process.argv.slice(2);
if (!file || !url) {
  console.error('Usage: node scripts/try-page.js <saved-page.html> <original page URL> [--json]');
  process.exit(1);
}
const site = DCC.siteForUrl(url);
if (!site) {
  console.error(`Not a supported dictionary entry URL: ${url}`);
  process.exit(1);
}

// jsdom does not run the page's scripts or fetch anything.
const doc = new JSDOM(fs.readFileSync(file, 'utf8'), { url }).window.document;
const entries = DCC.parsers[site.id](doc, url);
if (!entries.length) {
  console.log(`No entries found: the ${site.name} parser does not match this page's markup.`);
  process.exit(1);
}

if (flag === '--json') {
  console.log(JSON.stringify(entries, null, 2));
} else {
  for (const entry of entries) {
    const draft = DCC.newDraft();
    DCC.addBlock(draft, DCC.newBlock(entry));
    console.log(`===== ${entry.headword}${entry.homograph ? ' (' + entry.homograph + ')' : ''} — ${entry.images.length} image(s)`);
    console.log(DCC.renderBackText(draft) + '\n');
  }
}
