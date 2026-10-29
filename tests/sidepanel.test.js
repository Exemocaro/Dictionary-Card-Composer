const test = require('node:test');
const assert = require('node:assert/strict');
const { fakeChrome, openPage, waitFor } = require('./fake-chrome');
const { DCC, loadFixture } = require('./helpers');

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

const FARE = 'https://dictionary.cambridge.org/dictionary/english/fare';

test('"Read this page" shows every entry, giving the same card as Create & upload', async () => {
  const state = {};
  const panel = await openPage('sidepanel.html', fakeChrome(state), state);
  state.tabUrl = FARE;
  panel.$('#read').click();
  await waitFor(() => !panel.$('#pending').hidden);
  assert.equal(panel.$('#pending-editor').children.length, 5, 'all five entries on the page');
  assert.equal(panel.$('#entry-picker'), null, 'no picker showing one entry at a time');

  panel.$('#add').click();
  assert.equal(panel.$('#blocks').children.length, 5);
  assert.equal(panel.$('#front').value, 'fare');

  const quick = DCC.newDraft();
  const entries = DCC.parsers.cambridge(loadFixture('cambridge-fare.html', FARE), FARE);
  for (const entry of entries) DCC.addBlock(quick, DCC.newBlock(entry));
  const expected = panel.window.document.createElement('div');
  expected.innerHTML = DCC.renderBack(quick); // serialized the way the browser does (' instead of &#39;)
  assert.equal(panel.$('#preview').innerHTML, expected.innerHTML, 'same Back as the quick button');
});

test('an entry can be left out before adding', async () => {
  const state = {};
  const panel = await openPage('sidepanel.html', fakeChrome(state), state);
  state.tabUrl = FARE;
  panel.$('#read').click();
  await waitFor(() => !panel.$('#pending').hidden);
  panel.$('#pending-editor').lastElementChild.querySelector('button[title="Leave out"]').click();
  assert.equal(panel.$('#pending-editor').children.length, 4);
  panel.$('#add').click();
  assert.equal(panel.$('#blocks').children.length, 4);
});
