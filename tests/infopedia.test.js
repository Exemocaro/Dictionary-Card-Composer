const test = require('node:test');
const assert = require('node:assert/strict');
const { DCC, loadHtml, parseFixture } = require('./helpers');

const pageUrl = 'https://www.infopedia.pt/dicionarios/lingua-portuguesa/%C3%A1lamos';

test('álamo: senses, pronunciation, etymology, synonyms and citation', () => {
  const entries = parseFixture('infopedia', 'infopedia-alamo.html', pageUrl);
  assert.equal(entries.length, 1);
  const [entry] = entries;
  assert.equal(entry.headword, 'álamo');
  assert.equal(entry.language, 'pt');
  assert.equal(entry.syllabification, 'á.la.mo');
  assert.equal(entry.pronunciation, 'ˈalɐmu');
  assert.equal(entry.groups[0].partOfSpeech, 'nome masculino');

  const senses = entry.groups[0].senses;
  assert.deepEqual(senses.map(s => s.label), ['1', '2']);
  assert.match(senses[0].definition, /^\[BOTÂNICA\] designação comum às árvores do género Populus, da família das Salicáceas/);
  assert.match(senses[0].definition, /; choupo$/);
  assert.match(senses[1].definition, /^\[BOTÂNICA\] \(Populus nigra\) árvore da família das Salicáceas/);

  assert.equal(entry.etymology, 'do latim alnu-, «álamo» × latim ulmu-, «olmo»');
  assert.deepEqual(entry.synonyms, ['choupo']);
  assert.match(entry.citation, /^álamos – no Dicionário infopédia da Língua Portuguesa \[em linha\]\. Porto Editora\./);
  assert.equal(entry.images.length, 1);
  assert.match(entry.images[0].url, /%C3%A1lamo\.png$/);
});

test('the decoded URL in the citation becomes the link', () => {
  const [entry] = parseFixture('infopedia', 'infopedia-alamo.html', pageUrl);
  const draft = DCC.newDraft();
  DCC.addBlock(draft, DCC.newBlock(entry));
  const html = DCC.renderBack(draft);
  assert.equal(html.split('<a href=').length, 2, 'exactly one link in the citation');
  assert.ok(html.includes(`<a href="${pageUrl}">https://www.infopedia.pt/dicionarios/lingua-portuguesa/álamos</a>`));
  assert.ok(html.includes('<p><b>Sinónimos:</b> choupo</p>'));
});

test('an Infopédia page without entries returns nothing', () => {
  const doc = loadHtml('<main class="dictionary"><p>Sem resultados</p></main>', pageUrl);
  assert.deepEqual(DCC.parsers.infopedia(doc, pageUrl), []);
});

test('gato: expressions with their context, region and numbered meanings', () => {
  const [entry] = parseFixture('infopedia', 'infopedia-gato.html', 'https://www.infopedia.pt/dicionarios/lingua-portuguesa/gato');
  assert.equal(entry.headword, 'gato');
  assert.equal(entry.expressions.length, 9);
  const byPhrase = Object.fromEntries(entry.expressions.map(e => [e.phrase, e.definition]));
  assert.equal(byPhrase['aqui há gato'], 'expressão usada para indicar suspeita de erro ou irregularidade');
  assert.equal(byPhrase['gato escaldado de água fria tem medo'], '(provérbio) os percalços sofridos tornam uma pessoa precavida');
  assert.match(byPhrase['balaio de gatos'], /^\[Brasil\] 1\. situação confusa; saco de gatos 2\. briga ou conflito/);
  assert.equal(entry.images.length, 1);
});

test('gato: labels at the start of a meaning are put in brackets', () => {
  const [entry] = parseFixture('infopedia', 'infopedia-gato.html', 'https://www.infopedia.pt/dicionarios/lingua-portuguesa/gato');
  const byLabel = Object.fromEntries(entry.groups[0].senses.map(s => [s.label, s.definition]));
  assert.match(byLabel['1'], /^\[ZOOLOGIA\] \(Felis catus\) pequeno mamífero/);
  assert.equal(byLabel['4'], '[coloquial] engano; erro; lapso');
  assert.match(byLabel['10'], /^\[regionalismo\] peça angular/);
  assert.equal(byLabel['12'], '[Trás-os-Montes] mentira');
  assert.equal(byLabel['13'], '[Brasil] [coloquial] homem considerado atraente');
  assert.match(byLabel['17'], /^\[Brasil\] \[DESPORTO\] \[gíria\] guarda-redes/);
  assert.match(byLabel['19'], /^\[coloquial\] \[plural\] ruído/);
});

test('pesado: synonyms and antonyms, without the "..." link to the full list', () => {
  const [entry] = parseFixture('infopedia', 'infopedia-pesado.html', 'https://www.infopedia.pt/dicionarios/lingua-portuguesa/pesado');
  assert.deepEqual(entry.synonyms, ['acarretado', 'agressivo', 'arrastado']);
  assert.deepEqual(entry.antonyms, ['agradável', 'alado', 'alígero']);
  assert.ok(entry.groups.flatMap(g => g.senses).some(s => s.definition.startsWith('[DESPORTO]')));

  const draft = DCC.newDraft();
  DCC.addBlock(draft, DCC.newBlock(entry));
  assert.ok(DCC.renderBack(draft).includes('<p><b>Antónimos:</b> agradável, alado, alígero</p>'));
});
