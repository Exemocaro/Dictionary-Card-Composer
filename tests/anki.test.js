// AnkiConnect is never contacted here: fetch and invoke are fakes.
const test = require('node:test');
const assert = require('node:assert/strict');
const { DCC } = require('./helpers');

test('invoke sends a version 6 request to the loopback address', async () => {
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = { url, body: JSON.parse(init.body) };
    return { ok: true, json: async () => ({ result: ['Default'], error: null }) };
  };
  assert.deepEqual(await DCC.ankiInvoke('deckNames', {}, 'secret'), ['Default']);
  assert.equal(sent.url, 'http://127.0.0.1:8765');
  assert.deepEqual(sent.body, { action: 'deckNames', version: 6, params: {}, key: 'secret' });
});

test('invoke reports AnkiConnect errors and connection failures', async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ result: null, error: 'deck was not found' }) });
  await assert.rejects(DCC.ankiInvoke('addNote', {}), /deck was not found/);

  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(DCC.ankiInvoke('version'), /Is Anki running/);

  globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
  await assert.rejects(DCC.ankiInvoke('deckNames'), /403/);
});

test('media filenames are safe and distinct', () => {
  const a = DCC.mediaFilename({ url: 'https://dicionario.priberam.org/images/dplp/multid%C3%A3o.jpg' }, 'Ação/../x');
  const b = DCC.mediaFilename({ url: 'https://dicionario.priberam.org/images/dplp/other.jpg' }, 'Ação/../x');
  assert.match(a, /^dcc-acao-x-[a-z0-9]+\.jpg$/);
  assert.notEqual(a, b);
  assert.equal(DCC.mediaFilename({ url: 'https://x.example/image.bmp' }, 'x'), null, 'unsupported format');
  assert.match(DCC.mediaFilename({ url: 'https://x.example/picture?id=7' }, 'x'), /^dcc-x-[a-z0-9]+\.jpg$/, 'no extension: saved as .jpg');
});

test('storeImages saves each image and lists the ones that failed', async () => {
  const calls = [];
  const invoke = async (action, params) => {
    calls.push([action, params]);
    if (params.url.includes('broken')) throw new Error('download failed');
    return params.filename;
  };
  const ok = { url: 'https://x.example/a.png' };
  const result = await DCC.storeImages(invoke, [ok, { url: 'https://x.example/broken.png' }, { url: 'https://x.example/a.tiff' }], 'word');
  assert.equal(result.stored[ok.url], calls[0][1].filename);
  assert.equal(calls[0][0], 'storeMediaFile');
  assert.equal(calls[0][1].url, ok.url);
  assert.deepEqual(result.failures, ['broken.png: download failed', 'a.tiff: unsupported image format']);
});

const settings = { deck: 'Words', model: 'Basic', frontField: 'Front', backField: 'Back' };

test('checkAnkiNote catches duplicates before anything is saved', async () => {
  const invoke = async (action, params) => {
    if (action === 'canAddNotes') return [params.notes[0].fields.Front !== 'already there'];
    throw new Error('unexpected ' + action);
  };
  await DCC.checkAnkiNote(invoke, settings, 'new word');
  await assert.rejects(DCC.checkAnkiNote(invoke, settings, 'already there'), /same Front is already in this deck/);
});

test('addAnkiNote sends one note with both fields and no duplicates allowed', async () => {
  const calls = [];
  const invoke = async (action, params) => {
    calls.push([action, params]);
    return 1234;
  };
  assert.equal(await DCC.addAnkiNote(invoke, settings, 'a &lt; b', '<p>x</p>'), 1234);
  const [action, params] = calls[0];
  assert.equal(action, 'addNote');
  assert.deepEqual(params.note.fields, { Front: 'a &lt; b', Back: '<p>x</p>' });
  assert.equal(params.note.deckName, 'Words');
  assert.equal(params.note.options.allowDuplicate, false);
});

// A pretend Anki that records every action it receives.
function fakeAnki({ decks = ['Default', 'Words'], models = ['Basic', 'Cloze'], fields = { Basic: ['Front', 'Back'], Cloze: ['Text', 'Back Extra'], 'Básico': ['Frente', 'Verso'] }, duplicate = false } = {}) {
  const calls = [];
  const invoke = async (action, params = {}) => {
    calls.push([action, params]);
    switch (action) {
      case 'requestPermission': return { permission: 'granted', requireApikey: false, version: 6 };
      case 'deckNames': return decks;
      case 'modelNames': return models;
      case 'modelFieldNames': return fields[params.modelName];
      case 'createDeck': return 1;
      case 'canAddNotes': return [!duplicate];
      case 'storeMediaFile': return params.filename;
      case 'addNote': return 99;
      default: throw new Error('unexpected ' + action);
    }
  };
  return { calls, invoke, actions: () => calls.map(c => c[0]) };
}

test('resolveAnkiSettings uses the extension deck and finds a Basic note type', async () => {
  let anki = fakeAnki();
  assert.deepEqual(await DCC.resolveAnkiSettings(anki.invoke, {}),
    { deck: 'Dictionary Cards', model: 'Basic', frontField: 'Front', backField: 'Back' });

  anki = fakeAnki({ models: ['Omissão de palavras', 'Básico'] });
  assert.deepEqual(await DCC.resolveAnkiSettings(anki.invoke, {}),
    { deck: 'Dictionary Cards', model: 'Básico', frontField: 'Frente', backField: 'Verso' });
});

test('resolveAnkiSettings explains a note type with too few fields', async () => {
  const anki = fakeAnki({ models: ['One'], fields: { One: ['Only'] } });
  await assert.rejects(DCC.resolveAnkiSettings(anki.invoke, {}), /needs at least two fields/);
});

test('resolveAnkiSettings keeps the chosen deck and fields until they are changed', async () => {
  const anki = fakeAnki();
  const saved = { deck: 'Inglês', model: 'Basic', frontField: 'Back', backField: 'Front', key: 'k' };
  assert.deepEqual(await DCC.resolveAnkiSettings(anki.invoke, saved), saved);
});

function draftWith(images = false) {
  const entry = DCC.newEntry({
    headword: 'flébil',
    language: 'pt',
    dictionary: 'Teste',
    sourceUrl: 'https://example.com/flebil',
    images: [{ url: 'https://example.com/f.jpg', alt: '', caption: '', credit: '' }],
    groups: [{ partOfSpeech: 'adjetivo', senses: [DCC.newSense({ label: '1', definition: 'Choroso.' })] }]
  });
  const draft = DCC.newDraft();
  DCC.addBlock(draft, DCC.newBlock(entry));
  draft.blocks[0].options.images = images;
  return draft;
}

test('uploadDraft adds one note with the word on the Front', async () => {
  const anki = fakeAnki();
  const { settings, skipped } = await DCC.uploadDraft(anki.invoke, {}, draftWith());
  assert.equal(settings.deck, 'Dictionary Cards');
  assert.deepEqual(skipped, []);
  assert.deepEqual(anki.actions(), ['requestPermission', 'modelNames', 'modelFieldNames', 'createDeck', 'canAddNotes', 'addNote']);
  assert.deepEqual(anki.calls.find(c => c[0] === 'createDeck')[1], { deck: 'Dictionary Cards' }, 'the deck is created if missing');
  assert.equal(anki.calls.at(-1)[1].note.deckName, 'Dictionary Cards');
  const note = anki.calls.at(-1)[1].note;
  assert.equal(note.fields.Front, 'flébil');
  assert.match(note.fields.Back, /<li value="1">Choroso\.<\/li>/);
});

test('uploadDraft saves selected images first and points the Back at the saved files', async () => {
  const anki = fakeAnki();
  await DCC.uploadDraft(anki.invoke, {}, draftWith(true));
  const stored = anki.calls.find(c => c[0] === 'storeMediaFile')[1].filename;
  assert.ok(anki.calls.at(-1)[1].note.fields.Back.includes(`<img src="${stored}"`));
});

test('uploadDraft stops before saving anything when the note is a duplicate', async () => {
  const anki = fakeAnki({ duplicate: true });
  await assert.rejects(DCC.uploadDraft(anki.invoke, {}, draftWith(true)), /already in this deck/);
  assert.ok(!anki.actions().includes('storeMediaFile'));
  assert.ok(!anki.actions().includes('addNote'));
});

test('uploadDraft uses hand edits and swaps in saved image names', async () => {
  const anki = fakeAnki();
  const draft = draftWith(true);
  draft.backOverride = '<p>Edited</p><img src="https://example.com/f.jpg">';
  await DCC.uploadDraft(anki.invoke, {}, draft);
  const back = anki.calls.at(-1)[1].note.fields.Back;
  assert.match(back, /^<p>Edited<\/p><img src="dcc-flebil-[a-z0-9]+\.jpg">$/);
});

test('an image that cannot be saved does not stop the card, and is reported', async () => {
  const anki = fakeAnki();
  const broken = anki.invoke;
  const invoke = async (action, params) => {
    if (action === 'storeMediaFile') throw new Error('download failed');
    return broken(action, params);
  };
  const draft = draftWith(true);
  const result = await DCC.uploadDraft(invoke, {}, draft);
  assert.deepEqual(result.skipped, ['f.jpg: download failed']);
  const back = anki.calls.at(-1)[1].note.fields.Back;
  assert.ok(!back.includes('<img'), 'no broken image in the note');
});

test('images fetched on the page are handed to Anki as data, so Anki never downloads them', async () => {
  const calls = [];
  const invoke = async (action, params) => { calls.push(params); return params.filename; };
  const image = { url: 'https://www.infopedia.pt/defimages/lingua-portuguesa/desktop/g/gato', data: 'iVBORw0KGgo=', type: 'image/png' };
  const { stored, failures } = await DCC.storeImages(invoke, [image], 'gato');
  assert.deepEqual(failures, []);
  assert.equal(calls[0].data, 'iVBORw0KGgo=');
  assert.equal(calls[0].url, undefined);
  assert.match(stored[image.url], /^dcc-gato-[a-z0-9]+\.png$/, 'extension from the image type');
});

test('an image address with a broken %-escape is reported, not fatal', async () => {
  const invoke = async () => { throw new Error('download failed'); };
  const { failures } = await DCC.storeImages(invoke, [{ url: 'https://x.example/bad%E0%A4%A.png' }], 'word');
  assert.deepEqual(failures, ['bad%E0%A4%A.png: download failed']);
});
