const test = require('node:test');
const assert = require('node:assert/strict');
const { DCC } = require('./helpers');

function fakeClipboard(richWorks) {
  const written = [];
  globalThis.ClipboardItem = class { constructor(items) { this.types = Object.keys(items); } };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        write: async items => { if (!richWorks) throw new Error('denied'); written.push(items[0].types); },
        writeText: async text => { written.push(text); }
      }
    }
  });
  return written;
}

test('copyRich writes HTML and plain text together', async () => {
  const written = fakeClipboard(true);
  assert.equal(await DCC.copyRich('<b>x</b>', 'x'), 'rich');
  assert.deepEqual(written, [['text/html', 'text/plain']]);
});

test('copyRich falls back to plain text', async () => {
  const written = fakeClipboard(false);
  assert.equal(await DCC.copyRich('<b>x</b>', 'x'), 'plain');
  assert.deepEqual(written, ['x']);
});
