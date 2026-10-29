const test = require('node:test');
const assert = require('node:assert/strict');
const { DCC, parseFixture } = require('./helpers');

const priberam = word => {
  const [entry] = parseFixture('priberam', `priberam-${word}.html`, `https://dicionario.priberam.org/${word}`);
  entry.accessedAt = '2026-10-28T12:00:00.000Z';
  return entry;
};

function cardWith(...entries) {
  const draft = DCC.newDraft();
  for (const entry of entries) DCC.addBlock(draft, DCC.newBlock(entry));
  return draft;
}

test('acrisolado renders like the card style in the plan', () => {
  const html = DCC.renderBack(cardWith(priberam('acrisolado')));
  assert.ok(html.includes('<b>adjectivo</b>'));
  assert.ok(html.includes('<li value="1">Que se apurou no crisol ou no cadinho.</li>'));
  assert.ok(html.includes('<li value="2">Que se acrisolou ou aperfeiçoou. = APERFEIÇOADO, MELHORADO</li>'));
  assert.ok(html.includes('<li value="3">[Figurado] Que se destaca pelas grandes qualidades. = ELEVADO, SUBLIME, SUPERIOR ≠ INFERIOR, RELES, VIL, VULGAR</li>'));
  assert.ok(html.includes('<p><b>Etimologia:</b> particípio de acrisolar.</p>'));
  assert.ok(html.includes('<b>"acrisolado"</b>, in Dicionário Priberam da Língua Portuguesa [em linha], ' +
    '<a href="https://dicionario.priberam.org/acrisolado">https://dicionario.priberam.org/acrisolado</a> [consultado em 2026-10-28].'));
  assert.ok(!html.includes('<p><b>acrisolado</b></p>'), 'a single entry that repeats the Front has no headword line');
  assert.ok(!/style=|color/i.test(html), 'no fixed colours, works in dark mode');
});

test('numbering continues across parts of speech and survives deselection', () => {
  const draft = cardWith(priberam('gracioso'));
  draft.blocks[0].selected = ['0.0', '1.2'];
  const html = DCC.renderBack(draft);
  assert.ok(html.includes('<li value="1">Que tem graça; engraçado; chistoso.</li>'));
  assert.ok(html.includes('<b>nome masculino</b><ol><li value="6">Actor que desempenha papéis cómicos.</li></ol>'));
  assert.ok(!html.includes('Agradável'));
});

test('optional sections follow the block toggles', () => {
  const draft = cardWith(priberam('tez'));
  let html = DCC.renderBack(draft);
  assert.ok(html.includes('|ê|'));
  assert.ok(html.includes('Etimologia:</b> etimologia duvidosa.'));
  assert.ok(html.includes('Plural: tezes.'));
  assert.ok(html.includes('= EPIDERME'));

  Object.assign(draft.blocks[0].options, { pronunciation: false, etymology: false, inflections: false, synonyms: false, citation: false });
  html = DCC.renderBack(draft);
  assert.ok(!html.includes('|ê|'));
  assert.ok(!html.includes('Etimologia'));
  assert.ok(!html.includes('Plural'));
  assert.ok(!html.includes('EPIDERME'));
  assert.ok(!html.includes('<small>'));
});

test('languidez card: several words and sources on one Back, each with its own citation', () => {
  const oxford = parseFixture('oxford', 'oxford-language.html', 'https://www.oxfordlearnersdictionaries.com/definition/english/language')[0];
  const draft = cardWith(priberam('languidez'), priberam('langor'), oxford);
  assert.equal(draft.front, 'languidez', 'the first entry sets the Front, later ones do not');

  const html = DCC.renderBack(draft);
  assert.equal(html.split('<hr>').length, 3);
  for (const word of ['languidez', 'langor', 'language']) {
    assert.ok(html.includes(`<p><b>${word}</b></p>`), `${word} has a headword line when combined`);
  }
  assert.ok(html.includes('href="https://dicionario.priberam.org/langor"'));
  assert.ok(html.includes('Oxford Advanced Learner&#39;s Dictionary'));
  assert.ok(html.includes('<b>Etymology:</b> Middle English'), 'English entries use an English label');
  assert.ok(html.includes('<b>Etimologia:</b> latim languor, -oris.'), "each etymology stays with its own entry");
});

test('examples are italic and under their meaning', () => {
  const oxford = parseFixture('oxford', 'oxford-language.html', 'https://www.oxfordlearnersdictionaries.com/definition/english/language')[0];
  const html = DCC.renderBack(cardWith(oxford));
  assert.ok(html.includes('<li value="1">[countable] the system of communication'));
  assert.ok(html.includes('<br><i>the English language</i>'));
});

test('malicious text and unsafe links are escaped or dropped', () => {
  const entry = DCC.newEntry({
    headword: '<script>alert(1)</script>',
    language: 'en',
    dictionary: 'Evil <b>Dict</b>',
    sourceUrl: 'javascript:alert(1)',
    relatedLinks: [{ word: 'x', url: 'javascript:alert(2)' }, { word: 'ok', url: 'https://example.com/ok' }],
    images: [{ url: 'javascript:alert(3)', alt: '', caption: '', credit: '' }],
    groups: [{ partOfSpeech: 'noun', senses: [DCC.newSense({ label: '1', definition: '<img src=x onerror=alert(1)>' })] }]
  });
  const draft = cardWith(entry);
  Object.assign(draft.blocks[0].options, { related: true, images: true });
  draft.blocks[0].selectedImages = ['javascript:alert(3)'];
  const html = DCC.renderBack(draft) + DCC.renderBlock(draft.blocks[0], { showHeadword: true });

  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('<a href="https://example.com/ok">ok</a>'));
});

test('images are included by default and use the given source mapping', () => {
  const entry = parseFixture('priberam', 'priberam-manga.html', 'https://dicionario.priberam.org/manga')[0];
  const draft = cardWith(entry);
  const image = entry.images[0];
  assert.ok(DCC.renderBack(draft).includes(`<img src="${image.url}"`), 'every image is on by default');
  const stored = DCC.renderBack(draft, { imageSrc: () => 'dcc-manga-abc.jpg' });
  assert.ok(stored.includes('<img src="dcc-manga-abc.jpg"'));

  draft.blocks[0].options.images = false;
  assert.ok(!DCC.renderBack(draft).includes('<img'));
});

test('plain-text version keeps numbering, examples and citation', () => {
  const text = DCC.renderBackText(cardWith(priberam('acrisolado')));
  assert.ok(text.includes('adjectivo\n1. Que se apurou no crisol ou no cadinho.\n2. Que se acrisolou ou aperfeiçoou. = APERFEIÇOADO, MELHORADO'));
  assert.ok(text.includes('Etimologia: particípio de acrisolar.'));
  assert.ok(text.includes('"acrisolado", in Dicionário Priberam da Língua Portuguesa [em linha], https://dicionario.priberam.org/acrisolado [consultado em 2026-10-28].'));
  assert.ok(!text.includes('<'));
});

test('a citation taken from the page is kept and its URL linked', () => {
  const entry = priberam('tez');
  entry.citation = 'Citação de teste, https://dicionario.priberam.org/tez.';
  const html = DCC.renderBack(cardWith(entry));
  assert.ok(html.includes('Citação de teste, <a href="https://dicionario.priberam.org/tez">https://dicionario.priberam.org/tez</a>.'));
});

test('expressions follow the meanings and can be turned off', () => {
  const draft = cardWith(parseFixture('priberam', 'priberam-gato.html', 'https://dicionario.priberam.org/gato')[0]);
  let html = DCC.renderBack(draft);
  assert.ok(html.includes('<p><b>Expressões:</b></p><ul><li><b>aqui há gato</b>: Expressão que indica suspeitas ou dúvidas relativamente a alguma coisa. = AQUI HÁ COISA</li>'));
  assert.ok(html.includes('<b>gato por lebre</b>: Com engano, dando ou recebendo algo com qualidade inferior ao que é esperado.<br><i>comprou gato por lebre'));
  assert.ok(DCC.renderBackText(draft).includes('Expressões:\n- aqui há gato: Expressão que indica'));

  draft.blocks[0].options.expressions = false;
  assert.ok(!DCC.renderBack(draft).includes('aqui há gato'));
});

test('idioms without a definition are listed as links', () => {
  const draft = cardWith(parseFixture('cambridge', 'cambridge-cat.html', 'https://dictionary.cambridge.org/dictionary/english/cat')[0]);
  const html = DCC.renderBack(draft);
  assert.match(html, /<p><b>Idioms and phrases:<\/b> <a href="https:\/\/dictionary\.cambridge\.org\/[^"]+">be the cat&#39;s whiskers<\/a>, /);
});

test('examples that belong to no single meaning come after the list', () => {
  const draft = cardWith(parseFixture('cambridge', 'cambridge-fare.html', 'https://dictionary.cambridge.org/dictionary/english/fare')[0]);
  const html = DCC.renderBack(draft);
  assert.match(html, /<b>noun \(PAYMENT\)<\/b><ol>.*<\/ol><p><b>More examples:<\/b><br><i>[^<]+<\/i>/);
  assert.ok(html.includes('<b>noun (FOOD)</b>'));
});

test('several entries from one page and dictionary read as one: no repeated word, rule or citation', () => {
  const entries = parseFixture('cambridge', 'cambridge-fare.html', 'https://dictionary.cambridge.org/dictionary/english/fare').slice(0, 2);
  const draft = cardWith(...entries);
  const html = DCC.renderBack(draft);
  assert.ok(!html.includes('<hr>'));
  assert.ok(!html.includes('<p><b>fare</b></p>'), 'the Front already says "fare"');
  assert.equal(html.split('<small>').length - 1, 1, 'one citation for the page');
  assert.ok(html.includes('<b>verb [I usually + adv/prep]</b>'));
});

test('each dictionary on a page stays visibly separate, with its own citation', () => {
  const entries = parseFixture('cambridge', 'cambridge-fare.html', 'https://dictionary.cambridge.org/dictionary/english/fare');
  const html = DCC.renderBack(cardWith(...entries));
  assert.equal(html.split('<hr>').length, 3, 'a rule between the three dictionaries');
  for (const name of ["Advanced Learner&#39;s Dictionary", 'Academic Content Dictionary', 'Business English Dictionary']) {
    assert.ok(html.includes(name), name);
  }
  assert.equal(html.split('<small>').length - 1, 3, 'one citation per dictionary');
});

test('related words show their topic and follow the synonyms toggle', () => {
  const draft = cardWith(parseFixture('cambridge', 'cambridge-deride.html', 'https://dictionary.cambridge.org/dictionary/english/deride')[0]);
  assert.match(DCC.renderBack(draft), /<p><b>Related words \(Mocking and taunting\):<\/b> [^<]*caricature, cheap jibe/);
  assert.match(DCC.renderBackText(draft), /Related words \(Mocking and taunting\): .*lampoon/);
  draft.blocks[0].options.synonyms = false;
  assert.ok(!DCC.renderBack(draft).includes('Related words'));
});

test('collocations are listed with their example and source', () => {
  const draft = cardWith(parseFixture('cambridge', 'cambridge-cat.html', 'https://dictionary.cambridge.org/dictionary/english/cat')[0]);
  const html = DCC.renderBack(draft);
  assert.ok(html.includes('<p><b>Collocations:</b></p><ul><li><a href="https://dictionary.cambridge.org/example/english/black-cat">black cat</a><br><i>She has a number of familiars including a black cat.</i> <small>(From Wikipedia)</small></li>'));
  assert.ok(DCC.renderBackText(draft).includes('Collocations:\n- black cat: She has a number of familiars including a black cat. (From Wikipedia)'));
  draft.blocks[0].options.expressions = false;
  assert.ok(!DCC.renderBack(draft).includes('Collocations'));
});

test('pictures come first, before the pronunciation and meanings', () => {
  const draft = cardWith(parseFixture('cambridge', 'cambridge-cat.html', 'https://dictionary.cambridge.org/dictionary/english/cat')[0]);
  const html = DCC.renderBack(draft);
  assert.ok(html.startsWith('<div><p><img src="https://dictionary.cambridge.org/images/thumb/cat_noun_001_02368.jpg'), html.slice(0, 120));
  const text = DCC.renderBackText(draft);
  assert.match(text.split('\n')[0], /cat_noun_001_02368\.jpg/);

  const two = cardWith(priberam('languidez'), parseFixture('cambridge', 'cambridge-cat.html', 'https://dictionary.cambridge.org/dictionary/english/cat')[0]);
  const second = DCC.renderBack(two).split('<hr>')[1];
  assert.ok(second.startsWith('<div><p><b>cat</b></p><p><img '), 'with several words, under that word\'s headword');
});
