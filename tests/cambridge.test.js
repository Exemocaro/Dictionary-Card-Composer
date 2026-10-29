const test = require('node:test');
const assert = require('node:assert/strict');
const { DCC, loadHtml, parseFixture } = require('./helpers');

const url = word => `https://dictionary.cambridge.org/dictionary/english/${word}`;

test('language: one entry per Cambridge dictionary on the page', () => {
  const entries = parseFixture('cambridge', 'cambridge-language.html', url('language'));
  assert.deepEqual(entries.map(e => e.dictionary), [
    "Cambridge Advanced Learner's Dictionary & Thesaurus",
    'Cambridge Academic Content Dictionary',
    'Cambridge Business English Dictionary'
  ]);

  const [entry] = entries;
  assert.equal(entry.headword, 'language');
  assert.equal(entry.language, 'en');
  assert.equal(entry.groups[0].partOfSpeech, 'noun');
  assert.equal(entry.pronunciation, 'UK /ˈlæŋ.ɡwɪdʒ/, US /ˈlæŋ.ɡwɪdʒ/');

  const senses = entry.groups[0].senses;
  assert.equal(senses.length, 6);
  assert.equal(senses[0].label, '');
  assert.equal(senses[0].definition, '[U] a system of communication consisting of sounds, words, and grammar');
  assert.equal(senses[0].examples[0], 'She does research into how children acquire language.');
  assert.ok(!JSON.stringify(entries).includes('HTML5 audio'), 'audio fallback text is left out');
  assert.ok(!JSON.stringify(entries).includes('More examples'), 'collapsed extra examples are left out');
});

test('run: inflections, synonyms and phrases', () => {
  const [entry] = parseFixture('cambridge', 'cambridge-run.html', url('run'));
  assert.equal(entry.groups[0].partOfSpeech, 'verb (GO QUICKLY)');
  assert.equal(entry.inflections, 'present participle running | past tense ran | past participle run');

  const senses = entry.groups.flatMap(g => g.senses);
  assert.ok(senses.some(s => s.synonyms.startsWith('dribble, drip')), 'synonyms listed under a meaning');
  const phrase = senses.find(s => s.definition.startsWith('run for something:'));
  assert.equal(phrase.definition, 'run for something: to run fast in order to get or avoid something');
  assert.equal(phrase.examples[0], 'I ran for the bus but it drove off.');
});

test('a Cambridge page without entries returns nothing', () => {
  const doc = loadHtml('<div class="page"><p>No results</p></div>', url('xyz'));
  assert.deepEqual(DCC.parsers.cambridge(doc, url('xyz')), []);
});

test('fare: every dictionary on the page, guide words split the meanings, "More examples" kept', () => {
  const entries = parseFixture('cambridge', 'cambridge-fare.html', url('fare'));
  assert.deepEqual(entries.map(e => [e.dictionary.replace('Cambridge ', ''), e.groups.map(g => g.partOfSpeech)]), [
    ["Advanced Learner's Dictionary & Thesaurus", ['noun (PAYMENT)', 'noun (FOOD)']],
    ["Advanced Learner's Dictionary & Thesaurus", ['verb [I usually + adv/prep]']],
    ['Academic Content Dictionary', ['noun (PAYMENT)', 'noun (FOOD)']],
    ['Academic Content Dictionary', ['verb [I always + adv/prep] (PROGRESS)']],
    ['Business English Dictionary', ['noun [C]']]
  ]);
  assert.equal(entries.flatMap(e => e.groups).flatMap(g => g.senses).length, 8, 'all eight meanings on the page');
  const [payment, food] = entries[0].groups;
  assert.equal(payment.senses.length, 2);
  assert.equal(food.senses.length, 1);
  assert.equal(payment.examples.length, 5, 'the "More examples" list');
});

test('cat: picture, synonym and idioms', () => {
  const [entry] = parseFixture('cambridge', 'cambridge-cat.html', url('cat'));
  assert.deepEqual(entry.images.map(i => i.url), ['https://dictionary.cambridge.org/images/thumb/cat_noun_001_02368.jpg?version=6.0.83']);
  assert.ok(entry.groups[0].senses.some(s => s.synonyms === 'felid'));
  const idiom = entry.expressions.find(e => e.phrase === 'let the cat out of the bag');
  assert.ok(idiom, 'idioms are listed');
  assert.match(idiom.url, /^https:\/\/dictionary\.cambridge\.org\//);
});

test('deride: SMART Vocabulary related words, with their topic', () => {
  const [entry] = parseFixture('cambridge', 'cambridge-deride.html', url('deride'));
  assert.equal(entry.relatedWords.length, 1);
  const [{ topic, words }] = entry.relatedWords;
  assert.equal(topic, 'Mocking and taunting');
  for (const word of ['caricature', 'cheap jibe', 'derision', 'lampoon', 'lay yourself open to ridicule']) assert.ok(words.includes(word), word);
  assert.ok(!words.includes('deride'), 'the word itself is not listed');
});

test('cat: "Collocations with cat", each with its example and source', () => {
  const [entry, other] = parseFixture('cambridge', 'cambridge-cat.html', url('cat'));
  assert.deepEqual(entry.collocations.map(c => c.phrase), ['black cat', 'domestic cat', 'feral cat']);
  assert.deepEqual(entry.collocations[0], {
    phrase: 'black cat',
    url: 'https://dictionary.cambridge.org/example/english/black-cat',
    example: 'She has a number of familiars including a black cat.',
    source: 'From Wikipedia'
  });
  assert.equal(entry.collocations[1].source, 'From the Cambridge English Corpus');
  if (other) assert.deepEqual(other.collocations, [], 'the collocations belong to the main entry only');
});
