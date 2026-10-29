// Selectors checked against a saved infopedia.pt page (álamo), October 2026.
(() => {
  const DCC = globalThis.DCC;
  // Labels at the start of a meaning: domain (DESPORTO), register (coloquial), region (Trás-os-Montes)
  // and form (plural). On the page they run into the definition, so each is put in brackets.
  const LABELS = '.dolSubacepTbdom, .dolSubacepTbreg, .dolSubacepTbvar, .dolSubacepExcep';

  function textWithLabels(el) {
    if (!el) return '';
    const copy = el.cloneNode(true);
    for (const label of copy.querySelectorAll(LABELS)) label.textContent = ` [${DCC.text(label)}] `;
    return DCC.text(copy);
  }

  // Words from a box such as "sinónimos de pesado". The page shows the box twice, and each copy
  // ends with a "..." link to the full list.
  function relatedList(doc, title) {
    const words = [];
    for (const box of doc.querySelectorAll('.dolRelacoes')) {
      if (!title.test(DCC.text(box.querySelector('.title')))) continue;
      for (const link of box.querySelectorAll('.dolRelacoesAssociacao a')) {
        const word = DCC.text(link);
        if (word && !/^(\.\.\.|…)$/.test(word) && !words.includes(word)) words.push(word);
      }
    }
    return words;
  }

  DCC.parsers.infopedia = function (doc, url) {
    const citation = DCC.text(doc.querySelector('.como-referenciar-info'));
    const synonyms = relatedList(doc, /^sin[óô]nimos/i);
    const antonyms = relatedList(doc, /^ant[óô]nimos/i);
    const image = doc.querySelector('.dolEntradaImageDesktop img, img.dolEntradaImage');

    const entries = [...doc.querySelectorAll('.dolEntradaVverbete')].map((root, index) => {
      const entry = DCC.newEntry({
        site: 'infopedia',
        language: 'pt',
        dictionary: 'Dicionário infopédia da Língua Portuguesa',
        sourceUrl: url,
        citation
      });
      entry.headword = DCC.text(root.querySelector('.dolEntrinfoEntrada'));
      entry.syllabification = DCC.text(root.querySelector('.dolSilab'));
      entry.pronunciation = DCC.text(root.querySelector('.dolRegfonFonet'));
      entry.etymology = DCC.text(root.querySelector('.dolVverbeteEtim')).replace(/^Etimologia:\s*/i, '');

      for (const division of root.querySelectorAll('.dolDivisaoCatgram')) {
        entry.groups.push(DCC.newGroup({
          partOfSpeech: DCC.text(division.querySelector('.dolCatgramTbcat')),
          senses: [...division.querySelectorAll('.dolAcepsRow')].map(row => DCC.newSense({
            label: DCC.text(row.querySelector('.dolAcepsNum')).replace(/\.$/, ''),
            definition: textWithLabels(row.querySelector('.dolAcepsRightCell'))
          }))
        }));
      }

      // Expressions: a heading (with an optional context such as "(provérbio)" and region such as
      // "Brasil") followed by a table of one or more numbered meanings.
      let labels = [];
      for (const el of root.querySelectorAll('.dolVverbeteLexeger > *')) {
        if (el.matches('.dolLexegerExeger')) {
          const region = DCC.text(el.querySelector('.dolExegerTbvar'));
          labels = [DCC.text(el.querySelector('.dolExegerContex')), region && `[${region}]`].filter(Boolean);
          entry.expressions.push(DCC.newExpression({ phrase: DCC.text(el.querySelector('.dolExegerLexpress')) }));
        } else if (el.matches('.dolTable') && entry.expressions.length) {
          const meanings = [...el.querySelectorAll('.dolRow')].map(row =>
            [DCC.text(row.querySelector('.dolAcepsExegerNum')), textWithLabels(row.querySelector('.dolExegerAceps'))].filter(Boolean).join(' '));
          entry.expressions[entry.expressions.length - 1].definition = labels.concat(meanings).join(' ');
        }
      }

      // The synonym and antonym lists and the picture on the page belong to its main (first) entry.
      if (index === 0) {
        entry.synonyms = synonyms;
        entry.antonyms = antonyms;
        const src = image ? DCC.absoluteUrl(image.getAttribute('src'), url) : '';
        if (src) entry.images.push({ url: src, alt: entry.headword, caption: '', credit: '' });
      }
      return entry;
    });
    return DCC.keepEntries(entries);
  };
})();
