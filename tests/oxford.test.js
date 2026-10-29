const test = require('node:test');
const assert = require('node:assert/strict');
const { DCC, loadHtml, parseFixture } = require('./helpers');

const british = 'https://www.oxfordlearnersdictionaries.com/definition/english/language';
const american = 'https://www.oxfordlearnersdictionaries.com/definition/american_english/language';

test('British entry: senses, examples, word origin, idioms excluded', () => {
  const entries = parseFixture('oxford', 'oxford-language.html', british);
  assert.equal(entries.length, 1);
  const [entry] = entries;
  assert.equal(entry.headword, 'language');
  assert.equal(entry.language, 'en');
  assert.equal(entry.dictionary, "Oxford Advanced Learner's Dictionary");
  assert.equal(entry.pronunciation, 'BrE /ˈlæŋɡwɪdʒ/, NAmE /ˈlæŋɡwɪdʒ/');
  assert.equal(entry.groups.length, 1);
  assert.equal(entry.groups[0].partOfSpeech, 'noun');

  const senses = entry.groups[0].senses;
  assert.deepEqual(senses.map(s => s.label), ['1', '2', '3', '4', '5'], 'idiom senses are not included');
  assert.match(senses[0].definition, /^\[countable\] the system of communication in speech and writing/);
  assert.equal(senses[0].examples[0], 'the English language');
  assert.equal(senses[0].examples[1], 'It takes a long time to learn to speak a language well.');
  assert.equal(senses[0].examples.length, 10, 'collapsed extra examples are left out');
  assert.equal(senses[3].definition, '[uncountable, countable] a way of expressing ideas and feelings using movements, symbols and sound');

  assert.match(entry.etymology, /^Middle English: from Old French langage, based on Latin lingua ‘tongue’\.$/);
  assert.ok(entry.relatedLinks.some(l => l.word === 'first language' && l.url.startsWith('https://www.oxfordlearnersdictionaries.com/')));
});

test('British adjective: inflections and labels', () => {
  const url = 'https://www.oxfordlearnersdictionaries.com/definition/english/happy';
  const [entry] = parseFixture('oxford', 'oxford-happy.html', url);
  assert.equal(entry.inflections, '(comparative happier, superlative happiest)');
  assert.equal(entry.groups[0].senses[0].definition, 'feeling or showing pleasure; pleased', 'promo boxes inside a sense are left out');
  const sense7 = entry.groups[0].senses[6];
  assert.equal(sense7.label, '7');
  assert.equal(sense7.definition, '(formal) (of words, ideas or behaviour) suitable and appropriate for a particular situation');
  assert.equal(entry.etymology, 'Middle English (in the sense ‘lucky’): from the noun hap ‘good fortune’ + -y.');
  assert.ok(entry.groups[0].senses.some(s => s.synonyms === 'fortunate'), 'marked synonyms are kept with their meaning');
});

test('American entry: older markup is read too', () => {
  const [entry] = parseFixture('oxford', 'oxford-american-language.html', american);
  assert.equal(entry.headword, 'language');
  assert.equal(entry.dictionary, 'Oxford Advanced American Dictionary');
  assert.equal(entry.pronunciation, 'NAmE /ˈlæŋɡwɪdʒ/');
  assert.equal(entry.groups[0].partOfSpeech, 'noun');

  const senses = entry.groups[0].senses;
  assert.deepEqual(senses.map(s => s.label), ['1', '2', '3', '4', '5']);
  assert.match(senses[0].definition, /^\[countable\] the system of communication/);
  assert.equal(senses[0].examples[0], 'the Japanese language');
  assert.equal(entry.etymology, '', 'no etymology on this page, none invented');
});

test('changed markup returns no entries', () => {
  const doc = loadHtml('<div id="main"><h1>language</h1></div>', british);
  assert.deepEqual(DCC.parsers.oxford(doc, british), []);
});

test('idioms are kept as expressions with their definitions and examples', () => {
  const [entry] = parseFixture('oxford', 'oxford-language.html', british);
  assert.deepEqual(entry.expressions.map(e => e.phrase), ['mind/watch your language', 'speak/talk the same language']);
  assert.match(entry.expressions[0].definition, /^to be careful about what you say/);
  assert.equal(entry.expressions[0].examples.length, 2);

  const [happy] = parseFixture('oxford', 'oxford-happy.html', 'https://www.oxfordlearnersdictionaries.com/definition/english/happy');
  assert.equal(happy.expressions.find(e => e.phrase === 'a happy event').definition, '(old-fashioned) the birth of a baby');
});
