const test = require('node:test');
const assert = require('node:assert/strict');
const { DCC } = require('./helpers');

function fakeFetch(responses) {
  return async url => {
    const response = responses[url];
    if (!response) throw new TypeError('Failed to fetch');
    return {
      ok: response.status === 200,
      headers: { get: name => (name.toLowerCase() === 'content-type' ? response.type : null) },
      arrayBuffer: async () => new Uint8Array(response.bytes).buffer
    };
  };
}

test('images are fetched on the page and kept as base64 data', async () => {
  const entries = [{ images: [
    { url: 'https://x.example/ok.png' },
    { url: 'https://x.example/forbidden.png' },
    { url: 'https://x.example/page.html' },
    { url: 'https://other.example/blocked.png' }
  ] }];
  await DCC.attachImageData(entries, fakeFetch({
    'https://x.example/ok.png': { status: 200, type: 'image/png', bytes: [137, 80, 78, 71] },
    'https://x.example/forbidden.png': { status: 403, type: 'text/html', bytes: [] },
    'https://x.example/page.html': { status: 200, type: 'text/html', bytes: [60] }
  }));
  const [ok, forbidden, html, blocked] = entries[0].images;
  assert.equal(ok.data, 'iVBORw==');
  assert.equal(ok.type, 'image/png');
  for (const image of [forbidden, html, blocked]) assert.equal(image.data, undefined, image.url);
});

test('very large images are left for Anki to download', async () => {
  const entries = [{ images: [{ url: 'https://x.example/huge.jpg' }] }];
  await DCC.attachImageData(entries, fakeFetch({
    'https://x.example/huge.jpg': { status: 200, type: 'image/jpeg', bytes: new Array(DCC.MAX_IMAGE_BYTES + 1).fill(0) }
  }));
  assert.equal(entries[0].images[0].data, undefined);
});
