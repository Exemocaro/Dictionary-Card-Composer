const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// The extension's scripts attach themselves to globalThis.DCC, like they do in the browser.
for (const file of [
  'lib/sites.js',
  'lib/model.js',
  'lib/render.js',
  'lib/sanitize.js',
  'lib/clipboard.js',
  'lib/ankiconnect.js',
  'parsers/common.js',
  'parsers/priberam.js',
  'parsers/oxford.js',
  'parsers/merriam-webster.js',
  'parsers/infopedia.js',
  'parsers/cambridge.js',
  'lib/read-tab.js',
  'extract-page.js'
]) {
  require(path.join(__dirname, '..', file));
}

function loadHtml(html, url) {
  return new JSDOM(html, { url }).window.document;
}

function loadFixture(name, url) {
  return loadHtml(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'), url);
}

function parseFixture(siteId, name, url) {
  return globalThis.DCC.parsers[siteId](loadFixture(name, url), url);
}

module.exports = { DCC: globalThis.DCC, loadHtml, loadFixture, parseFixture };
