const test = require('node:test');
const assert = require('node:assert/strict');
const { DCC } = require('./helpers');

function entry(headword, url) {
  return DCC.newEntry({
    headword,
    sourceUrl: url,
    groups: [{ partOfSpeech: 'noun', senses: [DCC.newSense({ label: '1' }), DCC.newSense({ label: '2' })] }, { partOfSpeech: 'verb', senses: [DCC.newSense({ label: '3' })] }]
  });
}

test('new blocks select every meaning and use the default options', () => {
  const block = DCC.newBlock(entry('a', 'https://x/a'));
  assert.deepEqual(block.selected, ['0.0', '0.1', '1.0']);
  assert.equal(block.options.etymology, true);
  assert.equal(block.options.citation, true);
  assert.equal(block.options.images, true);
  assert.equal(block.options.expressions, true);
});

test('every image on the entry starts selected', () => {
  const withImages = entry('a', 'https://x/a');
  withImages.images = [{ url: 'https://x/1.jpg' }, { url: 'https://x/2.jpg' }];
  assert.deepEqual(DCC.newBlock(withImages).selectedImages, ['https://x/1.jpg', 'https://x/2.jpg']);
});


test('the first block sets the Front; later blocks and user edits are never overwritten', () => {
  const draft = DCC.newDraft();
  DCC.addBlock(draft, DCC.newBlock(entry('languidez', 'https://x/languidez')));
  assert.equal(draft.front, 'languidez');

  draft.front = 'languidez (estado)';
  DCC.addBlock(draft, DCC.newBlock(entry('langor', 'https://x/langor')));
  assert.equal(draft.front, 'languidez (estado)');
  assert.equal(draft.blocks.length, 2);
});

test('duplicate additions are detected', () => {
  const draft = DCC.newDraft();
  DCC.addBlock(draft, DCC.newBlock(entry('a', 'https://x/a')));
  assert.equal(DCC.isDuplicate(draft, entry('a', 'https://x/a')), true);
  assert.equal(DCC.isDuplicate(draft, entry('b', 'https://x/b')), false);

  const verb = entry('a', 'https://x/a');
  verb.groups = [{ partOfSpeech: 'verb', senses: [DCC.newSense({ label: '1' })] }];
  assert.equal(DCC.isDuplicate(draft, verb), false, 'another entry for the same word on the same page');
});

test('blocks can be moved and removed', () => {
  const draft = DCC.newDraft();
  for (const word of ['a', 'b', 'c']) DCC.addBlock(draft, DCC.newBlock(entry(word, 'https://x/' + word)));
  DCC.moveBlock(draft, 2, -1);
  assert.deepEqual(draft.blocks.map(b => b.entry.headword), ['a', 'c', 'b']);
  DCC.moveBlock(draft, 0, -1);
  assert.deepEqual(draft.blocks.map(b => b.entry.headword), ['a', 'c', 'b'], 'moving past the edge does nothing');
  DCC.removeBlock(draft, 1);
  assert.deepEqual(draft.blocks.map(b => b.entry.headword), ['a', 'b']);
});

test('stored drafts are restored only when the schema version matches', () => {
  const draft = DCC.newDraft();
  DCC.addBlock(draft, DCC.newBlock(entry('a', 'https://x/a')));
  const restored = DCC.loadDraft(JSON.parse(JSON.stringify(draft)));
  assert.deepEqual(restored, draft);

  assert.deepEqual(DCC.loadDraft(undefined), DCC.newDraft());
  assert.deepEqual(DCC.loadDraft({ version: 999, blocks: [] }), DCC.newDraft());
  assert.deepEqual(DCC.loadDraft({ version: 1, blocks: 'nope' }), DCC.newDraft());
});

test('supported pages are recognised by host and path', () => {
  const id = url => (DCC.siteForUrl(url) || {}).id;
  assert.equal(id('https://dicionario.priberam.org/acrisolado'), 'priberam');
  assert.equal(id('https://dicionario.priberam.org/pt-pt/prodigalidade'), 'priberam');
  assert.equal(id('https://dicionario.priberam.org/pt-br/precisa'), 'priberam');
  assert.equal(id('https://dicionario.priberam.org/pt-pt'), undefined);
  assert.equal(id('https://dicionario.priberam.org/Conjugar/acrisolar'), undefined);
  assert.equal(id('https://dictionary.cambridge.org/dictionary/english/language'), 'cambridge');
  assert.equal(id('https://dictionary.cambridge.org/us/dictionary/english/language'), 'cambridge');
  assert.equal(id('https://dictionary.cambridge.org/pt/dicionario/ingles/language'), 'cambridge');
  assert.equal(id('https://dictionary.cambridge.org/dictionary/english-portuguese/language'), undefined);
  assert.equal(id('https://dictionary.cambridge.org/grammar/british-grammar/'), undefined);
  assert.equal(id('https://www.oxfordlearnersdictionaries.com/definition/english/language'), 'oxford');
  assert.equal(id('https://www.oxfordlearnersdictionaries.com/definition/american_english/language'), 'oxford');
  assert.equal(id('https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000'), undefined);
  assert.equal(id('https://www.merriam-webster.com/dictionary/language'), 'merriam-webster');
  assert.equal(id('https://www.merriam-webster.com/thesaurus/language'), undefined);
  assert.equal(id('https://www.infopedia.pt/dicionarios/lingua-portuguesa/gato'), 'infopedia');
  assert.equal(id('https://www.infopedia.pt/dicionarios/ingles-portugues/cat'), undefined);
  assert.equal(id('https://evil.example/dicionario.priberam.org/x'), undefined);
  assert.equal(id('not a url'), undefined);
});

test('a draft too big for storage is saved without the image data instead of failing', async () => {
  const saved = [];
  globalThis.chrome = { storage: { local: { set: async values => {
    if (JSON.stringify(values).includes('"data"')) throw new Error('QUOTA_BYTES quota exceeded');
    saved.push(values);
  } } } };
  const withImage = entry('a', 'https://x/a');
  withImage.images = [{ url: 'https://x/a.png', data: 'iVBORw0KGgo=', type: 'image/png' }];
  const draft = DCC.newDraft();
  DCC.addBlock(draft, DCC.newBlock(withImage));

  await DCC.saveDraft(draft, { quickCard: 1 });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].quickCard, 1);
  assert.deepEqual(saved[0].draft.blocks[0].entry.images, [{ url: 'https://x/a.png' }]);
  assert.equal(draft.blocks[0].entry.images[0].data, 'iVBORw0KGgo=', 'the draft in memory keeps its data');
  delete globalThis.chrome;
});
