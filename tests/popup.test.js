const test = require('node:test');
const assert = require('node:assert/strict');
const { fakeChrome, openPage, waitFor } = require('./fake-chrome');

const LANGUIDEZ = 'https://dicionario.priberam.org/languidez';
const CAMBRIDGE = 'https://dictionary.cambridge.org/dictionary/english/language';
const SETTINGS = { deck: 'Default', model: 'Basic', frontField: 'Front', backField: 'Back' };

test('Create & upload makes a new card for the word and replaces the open panel', async () => {
  const state = { reply: () => ({ ok: true, settings: SETTINGS }) };
  const chrome = fakeChrome(state);

  const panel = await openPage('sidepanel.html', chrome, state);
  state.tabUrl = LANGUIDEZ;
  panel.$('#read').click();
  await waitFor(() => !panel.$('#pending').hidden);
  panel.$('#add').click();
  assert.equal(panel.$('#front').value, 'languidez');

  state.tabUrl = CAMBRIDGE;
  const popup = await openPage('popup.html', chrome, state);
  popup.$('#create').click();
  await waitFor(() => /Added/.test(popup.$('#status').textContent));
  assert.match(popup.$('#status').textContent, /"language".*Default/);

  const upload = state.messages.find(m => m.type === 'upload');
  assert.equal(upload.draft.front, 'language', 'the Front is the word');
  assert.ok(upload.draft.blocks.every(b => b.entry.headword === 'language'), 'a new word starts a new card');
  assert.equal(upload.draft.blocks.length, 3, 'one entry per Cambridge dictionary on the page');
  assert.equal(upload.draft.blocks[0].options.synonyms, true);

  await waitFor(() => panel.$('#front').value === 'language');
  assert.equal(panel.$('#blocks').children.length, 3, 'the panel now shows only the new card');
});

test('Anki errors are shown and the card is still saved for the panel', async () => {
  const state = { tabUrl: LANGUIDEZ, reply: () => ({ ok: false, error: "Couldn't reach Anki." }) };
  const popup = await openPage('popup.html', fakeChrome(state), state);
  popup.$('#create').click();
  await waitFor(() => /reach Anki/.test(popup.$('#status').textContent));
  assert.equal(state.storage.draft.front, 'languidez');
});

test('unsupported pages disable Create, and the panel button opens the side panel', async () => {
  const state = { tabUrl: 'https://example.com/' };
  const popup = await openPage('popup.html', fakeChrome(state), state);
  assert.equal(popup.$('#create').disabled, true);
  assert.match(popup.$('#status').textContent, /supported dictionary/);

  popup.$('#open-panel').click();
  await waitFor(() => state.openedPanel);
  assert.equal(state.openedPanel.windowId, 3);
  assert.equal(state.closed, true);
});

// Answers like the background would, with a pretend Anki that has two decks.
function ankiReply(message) {
  if (message.type === 'upload') return { ok: true, settings: { ...SETTINGS, deck: 'Inglês' } };
  if (message.action === 'requestPermission') return { ok: true, result: { permission: 'granted', requireApikey: false } };
  if (message.action === 'deckNames') return { ok: true, result: ['Default', 'Inglês'] };
  return { ok: false, error: 'unexpected' };
}

const optionValues = select => [...select.options].map(option => option.value);

test('the deck dropdown sits above the buttons and shows the extension deck by default', async () => {
  const state = { tabUrl: LANGUIDEZ };
  const popup = await openPage('popup.html', fakeChrome(state), state);
  const controls = [...popup.window.document.body.children].filter(el => el.matches('select, button')).map(el => el.id);
  assert.deepEqual(controls, ['deck', 'create', 'open-panel']);
  assert.equal(popup.$('#choose-deck'), null, 'no separate dropdown button');
  assert.equal(popup.$('#deck').value, 'Dictionary Cards');
  assert.match(popup.$('#deck').selectedOptions[0].textContent, /Dictionary Cards/);
});

test('the dropdown lists the Anki decks, and the chosen one stays until changed', async () => {
  const state = { tabUrl: LANGUIDEZ, reply: ankiReply };
  const chrome = fakeChrome(state);
  const popup = await openPage('popup.html', chrome, state);

  await waitFor(() => popup.$('#deck').options.length === 3);
  assert.deepEqual(optionValues(popup.$('#deck')), ['Dictionary Cards', 'Default', 'Inglês']);
  assert.equal(popup.$('#deck').value, 'Dictionary Cards');

  popup.$('#deck').value = 'Inglês';
  popup.$('#deck').dispatchEvent(new popup.window.Event('change'));
  await waitFor(() => state.storage.ankiSettings && state.storage.ankiSettings.deck === 'Inglês');

  const reopened = await openPage('popup.html', chrome, state);
  await waitFor(() => reopened.$('#deck').options.length === 3);
  assert.equal(reopened.$('#deck').value, 'Inglês', 'the choice is remembered');
});

test('without Anki the dropdown keeps the current deck and explains why when used', async () => {
  const state = { tabUrl: LANGUIDEZ, reply: () => ({ ok: false, error: "Couldn't reach Anki. Is Anki running with the AnkiConnect add-on installed?" }) };
  const popup = await openPage('popup.html', fakeChrome(state), state);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.deepEqual(optionValues(popup.$('#deck')), ['Dictionary Cards']);
  assert.equal(popup.$('#status').textContent, '', 'no error just for opening the popup');

  popup.$('#deck').dispatchEvent(new popup.window.Event('focus'));
  assert.match(popup.$('#status').textContent, /reach Anki/);
});

test('Create & upload puts every entry on the page on the card', async () => {
  const state = { tabUrl: 'https://dictionary.cambridge.org/dictionary/english/fare', reply: message =>
    message.type === 'upload' ? { ok: true, settings: SETTINGS, skipped: ['fare.jpg: download failed'] } : { ok: false, error: 'offline' } };
  const popup = await openPage('popup.html', fakeChrome(state), state);
  popup.$('#create').click();
  await waitFor(() => /Added/.test(popup.$('#status').textContent));
  const upload = state.messages.find(m => m.type === 'upload');
  assert.equal(upload.draft.blocks.length, 5, 'all three Cambridge dictionaries on the page');
  assert.equal(upload.draft.blocks.flatMap(b => b.entry.groups).flatMap(g => g.senses).length, 8);
  assert.equal(upload.draft.front, 'fare');
  assert.match(popup.$('#status').textContent, /1 image could not be saved: fare\.jpg: download failed/);
});

test('if the background cannot be reached, the error shows and Create works again', async () => {
  const state = { tabUrl: LANGUIDEZ };
  const chrome = fakeChrome(state);
  chrome.runtime.sendMessage = async () => { throw new Error('Could not establish connection. Receiving end does not exist.'); };
  const popup = await openPage('popup.html', chrome, state);
  popup.$('#create').click();
  await waitFor(() => /Could not establish connection/.test(popup.$('#status').textContent));
  assert.equal(popup.$('#create').disabled, false);
});
