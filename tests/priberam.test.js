const test = require('node:test');
const assert = require('node:assert/strict');
const { DCC, loadHtml, parseFixture } = require('./helpers');

const url = word => `https://dicionario.priberam.org/${word}`;

test('acrisolado: senses, labels, synonyms, antonyms and origin', () => {
  const entries = parseFixture('priberam', 'priberam-acrisolado.html', url('acrisolado'));
  assert.equal(entries.length, 2, 'acrisolado and acrisolar stay separate entries');

  const [entry] = entries;
  assert.equal(entry.headword, 'acrisolado');
  assert.equal(entry.language, 'pt');
  assert.equal(entry.dictionary, 'Dicionário Priberam da Língua Portuguesa');
  assert.equal(entry.sourceUrl, url('acrisolado'));
  assert.equal(entry.syllabification, 'a·cri·so·la·do');
  assert.equal(entry.groups.length, 1);
  assert.equal(entry.groups[0].partOfSpeech, 'adjectivo');

  const senses = entry.groups[0].senses;
  assert.deepEqual(senses.map(s => s.label), ['1', '2', '3']);
  assert.equal(senses[0].definition, 'Que se apurou no crisol ou no cadinho.');
  assert.equal(senses[1].definition, 'Que se acrisolou ou aperfeiçoou.');
  assert.equal(senses[1].synonyms, 'APERFEIÇOADO, MELHORADO');
  assert.equal(senses[2].definition, '[Figurado] Que se destaca pelas grandes qualidades.');
  assert.equal(senses[2].synonyms, 'ELEVADO, SUBLIME, SUPERIOR');
  assert.equal(senses[2].antonyms, 'INFERIOR, RELES, VIL, VULGAR');
  assert.equal(entry.etymology, 'particípio de acrisolar.');

  assert.equal(entries[1].headword, 'acrisolar');
  assert.equal(entries[1].groups[0].partOfSpeech, 'verbo transitivo');
  assert.equal(entries[1].etymology, 'a- + crisol + -ar.');
});

test('gracioso: two parts of speech keep the source numbering', () => {
  const [entry] = parseFixture('priberam', 'priberam-gracioso.html', url('gracioso'));
  assert.deepEqual(entry.groups.map(g => g.partOfSpeech), ['adjectivo', 'nome masculino']);
  assert.deepEqual(entry.groups[0].senses.map(s => s.label), ['1', '2', '3']);
  assert.deepEqual(entry.groups[1].senses.map(s => s.label), ['4', '5', '6']);
  assert.equal(entry.groups[1].senses[2].definition, 'Actor que desempenha papéis cómicos.');
  assert.equal(entry.pronunciation, '|i-ô|');
  assert.equal(entry.inflections, 'Plural: graciosos |ó|.', 'the hidden Brazilian copy is not repeated');
  assert.equal(entry.etymology, '');
});

test('tez: uncertain origin and plural', () => {
  const [entry] = parseFixture('priberam', 'priberam-tez.html', url('tez'));
  assert.equal(entry.etymology, 'etimologia duvidosa.');
  assert.equal(entry.inflections, 'Plural: tezes.');
  assert.equal(entry.syllabification, '', 'no syllabification on this page');
});

test('langor: a single unnumbered sense', () => {
  const [entry] = parseFixture('priberam', 'priberam-langor.html', url('langor'));
  const [sense] = entry.groups[0].senses;
  assert.equal(sense.label, '');
  assert.equal(sense.definition, 'O mesmo que languidez.');
  assert.equal(entry.etymology, 'latim languor, -oris.');
});

test('manga: homographs stay separate and illustrations are found', () => {
  const entries = parseFixture('priberam', 'priberam-manga.html', url('manga'));
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map(e => [e.headword, e.homograph]), [['manga', '1'], ['manga', '2']]);
  assert.equal(entries[0].groups[0].senses[1].definition, 'Objecto cuja forma se assemelha a essa parte do vestuário.');

  const urls = entries[0].images.map(i => i.url);
  assert.equal(urls[0], 'https://dicionario.priberam.org/images/dplp/cotovelo.jpg');
  assert.equal(new Set(urls).size, urls.length, 'no duplicate images');
  assert.equal(entries[0].images[0].caption, 'Parte do vestuário que cobre o braço ou parte dele.');
});

test('precisa (pt-pt address): inline examples become example lines', () => {
  const pageUrl = 'https://dicionario.priberam.org/pt-pt/precisa';
  const [entry] = parseFixture('priberam', 'priberam-precisa.html', pageUrl);
  assert.equal(entry.headword, 'preciso');
  assert.equal(entry.sourceUrl, pageUrl);
  const [first] = entry.groups[0].senses;
  assert.equal(first.definition, 'Que faz falta.');
  assert.deepEqual(first.examples, ['fez uma lista de tudo o que era preciso para a viagem']);
  assert.equal(first.synonyms, 'INDISPENSÁVEL, NECESSÁRIO');
  assert.equal(first.antonyms, 'DESNECESSÁRIO, DISPENSÁVEL');
});

test('a page without entry markup returns no entries', () => {
  const doc = loadHtml('<html><body><div id="resultados"><p>Palavra não encontrada</p></div></body></html>', url('xyz'));
  assert.deepEqual(DCC.parsers.priberam(doc, url('xyz')), []);
});

test('Unicode spacing is normalized', () => {
  const doc = loadHtml(`<div id="resultados"><div class="dp-definicao">
    <div class="dp-definicao-header"><div><span class="varpt">teste</span></div></div>
    <p><strong class="varpt">nome\u00a0masculino</strong></p>
    <div class="dp-definicao-linha"><span class="h6">1.</span><span class="ml-4 p"><span class="def">Uma\u00a0\u00a0prova\u200b  simples .</span></span></div>
  </div></div>`, url('teste'));
  const [entry] = DCC.parsers.priberam(doc, url('teste'));
  assert.equal(entry.groups[0].partOfSpeech, 'nome masculino');
  assert.equal(entry.groups[0].senses[0].definition, 'Uma prova simples.');
});

test('gato: expressions are kept apart from the meanings, with labels, synonyms and examples', () => {
  const [entry] = parseFixture('priberam', 'priberam-gato.html', url('gato'));
  assert.deepEqual(entry.groups.map(g => [g.partOfSpeech, g.senses.length]), [['nome masculino', 15], ['adjectivo e nome masculino', 1]]);
  assert.deepEqual(entry.expressions.map(e => e.phrase), [
    'aqui há gato', 'como gato por brasas', 'gato escondido com o rabo de fora', 'gato por lebre', 'não poder com um gato pelo rabo'
  ]);
  const [aqui, , escondido, lebre] = entry.expressions;
  assert.equal(aqui.definition, 'Expressão que indica suspeitas ou dúvidas relativamente a alguma coisa.');
  assert.equal(aqui.synonyms, 'AQUI HÁ COISA');
  assert.equal(escondido.definition, '[Informal] Coisa que se quer escondida, mas que é descoberta por um pormenor, um descuido.');
  assert.equal(lebre.definition, 'Com engano, dando ou recebendo algo com qualidade inferior ao que é esperado.');
  assert.deepEqual(lebre.examples, ['comprou gato por lebre; não deixe que lhe vendam gato por lebre']);
  assert.ok(entry.images.length >= 1);
});
