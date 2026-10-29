const test = require('node:test');
const assert = require('node:assert/strict');
const { DCC, loadHtml, parseFixture } = require('./helpers');

const url = word => `https://www.merriam-webster.com/dictionary/${word}`;

test('ablution: no "How to pronounce … (audio)" labels, etymology and citation kept', () => {
  const [entry] = parseFixture('merriam-webster', 'merriam-webster-ablution.html', url('ablution'));
  assert.equal(entry.headword, 'ablution');
  assert.equal(entry.syllabification, 'ab·lu·tion');
  assert.equal(entry.pronunciation, 'ə-ˈblü-shən');
  assert.ok(!JSON.stringify(entry).includes('How to pronounce'));

  const senses = entry.groups[0].senses;
  assert.deepEqual(senses.map(s => s.label), ['1', '2']);
  assert.equal(senses[0].definition, "formal: the washing of one's body or part of it (as in a religious rite) —usually plural");
  assert.deepEqual(senses[0].examples, ['ritual ablutions', 'performing his morning ablutions']);
  assert.equal(senses[1].definition, 'ablutions plural, British: a building on a military base that houses bathing and toilet facilities',
    'the inline pronunciation of "ablutions" is left out');
  assert.match(entry.etymology, /^Middle English ablucioun/);
  assert.equal(entry.citation, '“Ablution.” Merriam-Webster.com Dictionary, Merriam-Webster, https://www.merriam-webster.com/dictionary/ablution. Accessed 28 Oct. 2026.');
});

test('happy: numbered senses with lettered sub-senses, synonyms and quote attributions', () => {
  const [entry] = parseFixture('merriam-webster', 'merriam-webster-happy.html', url('happy'));
  const senses = entry.groups[0].senses;
  assert.deepEqual(senses.map(s => s.label), ['1', '2', '3', '4', '5']);
  assert.equal(senses[0].definition, '');
  assert.deepEqual(senses[0].children.map(s => s.label), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(senses[0].children[0].definition, 'enjoying or characterized by well-being and contentment');
  assert.equal(senses[1].definition, 'favored by luck or fortune: fortunate');
  assert.deepEqual(senses[3].children.map(s => s.label), ['a', 'b', 'c']);
  assert.ok(senses[3].children[1].examples.includes('… the most pass-happy team in the league … —Bill Barnwell'));
  assert.deepEqual(entry.synonyms, ['delighted', 'pleased', 'glad', 'satisfied', 'thankful']);
  assert.equal(entry.inflections, 'happier; happiest');
  assert.equal(entry.etymology, 'Middle English, from hap');

  const draft = DCC.newDraft();
  DCC.addBlock(draft, DCC.newBlock(entry));
  const html = DCC.renderBack(draft);
  assert.ok(html.includes('<li value="1"><ol type="a"><li value="1">enjoying or characterized'));
  assert.ok(html.includes('<p><b>Synonyms:</b> delighted, pleased, glad, satisfied, thankful</p>'));
});

test('a Merriam-Webster page without entries returns nothing', () => {
  const doc = loadHtml('<div class="spelling-suggestions">Did you mean?</div>', url('xyz'));
  assert.deepEqual(DCC.parsers['merriam-webster'](doc, url('xyz')), []);
});

test('cat: every entry, the sentence examples and the phrases containing the word', () => {
  const entries = parseFixture('merriam-webster', 'merriam-webster-cat.html', url('cat'));
  assert.equal(entries.length, 5);
  assert.deepEqual(entries[0].groups[0].examples, ['I have two dogs and a cat.', "the family's cat did an exemplary job of keeping the house and yard free of all rodents"]);
  const phrases = entries[0].expressions.map(e => e.phrase);
  assert.ok(phrases.includes('bell the cat') && phrases.includes('alley cat'));
  assert.ok(entries[0].expressions.every(e => e.url.startsWith('https://www.merriam-webster.com/dictionary/')));
  assert.deepEqual(entries[1].expressions, [], 'the phrase list belongs to the main entry only');
});

test('cat: the etymology goes to the entry its label names, sentence examples keep their heading', () => {
  const entries = parseFixture('merriam-webster', 'merriam-webster-cat.html', url('cat'));
  assert.match(entries[0].etymology, /^Middle English, from Old English catt, probably from Late Latin cattus, catta/);
  assert.deepEqual(entries.slice(1).map(e => e.etymology), ['', '', '', ''], 'not copied onto the other entries');
  assert.equal(entries[0].groups[0].examplesTitle, 'Examples of cat in a Sentence');

  const draft = DCC.newDraft();
  DCC.addBlock(draft, DCC.newBlock(entries[0]));
  const html = DCC.renderBack(draft);
  assert.ok(html.includes('<p><b>Examples of cat in a Sentence:</b><br><i>I have two dogs and a cat.</i>'));
  assert.ok(html.includes('<p><b>Etymology:</b> Middle English, from Old English catt'));
});

test('labels like "Verb" are matched as whole words, so "adverb" entries are not picked', () => {
  const doc = loadHtml(`
    <div class="entry-word-section-container"><h1 class="hword">fast</h1>
      <div class="vg"><div class="vd">adverb</div><div class="vg-sseq-entry-item"><div class="sense"><span class="dtText">: quickly</span></div></div></div></div>
    <div class="entry-word-section-container"><h1 class="hword">fast</h1>
      <div class="vg"><div class="vd">verb</div><div class="vg-sseq-entry-item"><div class="sense"><span class="dtText">: to eat nothing</span></div></div></div></div>
    <div class="entry-word-section-container"><h1 class="hword">fast</h1>
      <div class="vg"><div class="vd">noun</div><div class="vg-sseq-entry-item"><div class="sense"><span class="dtText">: a time of fasting</span></div></div></div></div>
    <div id="word-history"><div class="etymology-content-section"><p class="function-label">Verb</p><p class="et">Old English fæstan</p></div></div>
    <div id="examples"><div class="in-sentences"><span class="ex-header">Verb</span><span class="ex-sent">They fast during the holiday.</span></div></div>`, url('fast'));
  const [adverb, verb] = DCC.parsers['merriam-webster'](doc, url('fast'));
  assert.equal(adverb.etymology, '');
  assert.equal(verb.etymology, 'Old English fæstan');
  assert.deepEqual(verb.groups[0].examples, ['They fast during the holiday.']);
  assert.deepEqual(adverb.groups[0].examples, []);
});
