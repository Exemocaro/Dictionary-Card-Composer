const test = require('node:test');
const assert = require('node:assert/strict');
const { fakeChrome, openPage, waitFor } = require('./fake-chrome');

const LANGUIDEZ = 'https://dicionario.priberam.org/languidez';
const LANGOR = 'https://dicionario.priberam.org/langor';

async function readAndAdd(panel, state, url) {
  state.tabUrl = url;
  panel.$('#read').click();
  await waitFor(() => !panel.$('#pending').hidden);
  panel.$('#add').click();
}

test('read two pages, build one card, copy the Back', async () => {
  const state = {};
  const panel = await openPage('sidepanel.html', fakeChrome(state), state);
  const { $ } = panel;

  await readAndAdd(panel, state, LANGUIDEZ);
  assert.equal($('#front').value, 'languidez');
  await readAndAdd(panel, state, LANGOR);

  assert.equal($('#blocks').children.length, 2);
  assert.equal($('#preview').querySelectorAll('hr').length, 1);
  assert.ok($('#preview').innerHTML.includes('Estado de lânguido.'));
  assert.ok($('#preview').innerHTML.includes('O mesmo que languidez.'));
  assert.equal(state.storage.draft.blocks.length, 2, 'draft saved after each change');

  await readAndAdd(panel, state, LANGOR);
  assert.equal($('#blocks').children.length, 2, 'duplicate not added');
  assert.match($('#read-status').textContent, /already on the card/);

  $('#copy-back').click();
  await waitFor(() => $('#card-status').textContent);
  assert.deepEqual(state.clipboard, ['text/html', 'text/plain'], 'rich copy, not the plain-text fallback');
});

test('Send to Anki sends the whole draft in one request', async () => {
  const state = { reply: () => ({ ok: true, settings: { deck: 'Default', model: 'Basic', frontField: 'Front', backField: 'Back' } }) };
  const panel = await openPage('sidepanel.html', fakeChrome(state), state);
  await readAndAdd(panel, state, LANGUIDEZ);

  panel.$('#anki-send').click();
  await waitFor(() => /Added/.test(panel.$('#card-status').textContent));
  const upload = state.messages.find(m => m.type === 'upload');
  assert.equal(upload.draft.front, 'languidez');
  assert.equal(state.storage.draft.blocks.length, 1, 'the draft is kept after sending');
});

test('unsupported pages are reported and the card is kept', async () => {
  const state = {};
  const panel = await openPage('sidepanel.html', fakeChrome(state), state);
  state.tabUrl = 'https://example.com/';
  panel.$('#read').click();
  await waitFor(() => panel.$('#read-status').textContent.includes('not a supported'));
  assert.ok(panel.$('#pending').hidden);
});

test('"Add all" puts every entry on the page on the card', async () => {
  const state = {};
  const panel = await openPage('sidepanel.html', fakeChrome(state), state);
  state.tabUrl = 'https://dictionary.cambridge.org/dictionary/english/fare';
  panel.$('#read').click();
  await waitFor(() => !panel.$('#pending').hidden);
  assert.equal(panel.$('#add-all').hidden, false);
  assert.match(panel.$('#add-all').textContent, /5/);
  panel.$('#add-all').click();
  assert.equal(panel.$('#blocks').children.length, 5);
  assert.equal(panel.$('#front').value, 'fare');
});
