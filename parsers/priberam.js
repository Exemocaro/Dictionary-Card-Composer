(() => {
  const DCC = globalThis.DCC;
  const IMAGE = /\.(jpe?g|png|gif|webp|svg)$/i;

  // Priberam prints the PT/BR and pre/post-1990-agreement spellings side by side and hides
  // the unselected ones with CSS. Read only the variants the page is currently showing.
  function hiddenVariantClasses(doc) {
    const view = doc.defaultView;
    const hidden = ['varpt', 'varpb', 'aAO', 'dAO'].filter(name => {
      const el = doc.querySelector('.' + name);
      return el && view && view.getComputedStyle(el).display === 'none';
    });
    if (!hidden.includes('varpt') && !hidden.includes('varpb')) hidden.push('varpb');
    if (!hidden.includes('aAO') && !hidden.includes('dAO')) hidden.push('dAO');
    return hidden;
  }

  DCC.parsers.priberam = function (doc, url) {
    const hidden = hiddenVariantClasses(doc);
    const isVariantHidden = el => hidden.some(name => el.classList.contains(name));
    const text = el => DCC.text(el, isVariantHidden);
    const visible = (els, stop) => [...els].filter(el => {
      for (let node = el; node && node !== stop; node = node.parentElement) {
        if (isVariantHidden(node)) return false;
      }
      return true;
    });
    const dictionary = (doc.querySelector('meta[property="og:site_name"]') || {}).content ||
      'Dicionário Priberam da Língua Portuguesa';

    const entries = [];
    for (const def of doc.querySelectorAll('#resultados .dp-definicao')) {
      const entry = DCC.newEntry({ site: 'priberam', language: 'pt', dictionary, sourceUrl: url });
      const word = def.querySelector('.dp-definicao-header > div');
      entry.headword = DCC.text(word, el => isVariantHidden(el) || el.classList.contains('dp-numeracao'));
      entry.homograph = text(visible(def.querySelectorAll('.dp-definicao-header .dp-numeracao'), def)[0]);
      entry.pronunciation = text(visible(def.querySelectorAll('.dp-definicao-header .dp-ortoepia'), def)[0]);
      entry.syllabification = text(visible(def.querySelectorAll('.dp-divisao-silabica .titpalavra'), def)[0]);

      const card = def.querySelector('.dp-definicao-cartao');
      if (card && card.querySelector('img')) {
        const src = DCC.absoluteUrl(card.querySelector('img').getAttribute('src'), url);
        const caption = text(card.querySelector('.dp-definicao-cartao__descricao .def'));
        DCC.addUnique(entry.images, { url: src, alt: entry.headword, caption, credit: '' }, 'url');
      }

      let group = null;
      const inflections = [];
      for (const el of def.querySelectorAll(':scope > p, .dp-definicao-linha, .dp-seccao-icon')) {
        if (el.matches('p')) {
          const strongs = el.querySelectorAll('strong');
          if (!strongs.length) continue;
          group = DCC.newGroup({ partOfSpeech: text(visible(strongs, el)[0] || strongs[0]) });
          entry.groups.push(group);
        } else if (el.matches('.dp-definicao-linha')) {
          const sense = parseSense(el, entry, url, text, visible, isVariantHidden);
          // Expressions ("aqui há gato") are lines headed by the expression itself.
          const phrase = el.querySelector('h3');
          if (phrase) {
            const { definition, examples, synonyms, antonyms } = sense;
            entry.expressions.push(DCC.newExpression({ phrase: text(phrase), definition, examples, synonyms, antonyms }));
            continue;
          }
          if (!group) entry.groups.push((group = DCC.newGroup()));
          group.senses.push(sense);
        } else if (visible([el], def).length) {
          const heading = text(el.querySelector('strong'));
          if (/^Origem/i.test(heading)) entry.etymology = text(el.querySelector('.def'));
          else inflections.push(text(el));
        }
      }
      entry.inflections = inflections.filter(Boolean).join(' ');
      entries.push(entry);
    }
    return DCC.keepEntries(entries);
  };

  function parseSense(line, entry, url, text, visible, isVariantHidden) {
    const sense = DCC.newSense();
    sense.label = text(line.querySelector(':scope > span.h6')).replace(/\.$/, '');
    const labels = visible(line.querySelectorAll('.ml-4.h6'), line).map(text);
    const body = line.querySelector(':scope > .ml-4.p');

    // Synonyms follow a bare "=" and antonyms a bare "≠", both set in small caps.
    const parts = { definition: '', synonyms: '', antonyms: '' };
    const images = [];
    let mode = 'definition';
    for (const node of body ? body.childNodes : []) {
      if (node.nodeType === 3) {
        const value = node.nodeValue.trim();
        if (value === '=') mode = 'synonyms';
        else if (value === '≠') mode = 'antonyms';
        else parts[mode] += node.nodeValue;
      } else if (node.nodeType === 1 && !isVariantHidden(node)) {
        if (node.matches('a.dp-icon')) {
          const href = DCC.absoluteUrl(node.getAttribute('href'), url);
          if (IMAGE.test(href)) images.push(href);
          continue;
        }
        // Labels such as [Informal] were collected above; expression lines repeat them in here.
        parts[mode] += DCC.rawText(node, el => isVariantHidden(el) || el.matches('.h6'));
      }
    }
    // Expression lines start with a "•". Examples are printed inside the definition as "(ex.: …)";
    // move them to their own lines.
    const definition = DCC.clean(labels.concat(parts.definition.replace(/•/g, ' ')).join(' ')).replace(/\s*\(ex\.:\s*([^)]*)\)/g, (_, example) => {
      sense.examples.push(DCC.clean(example));
      return '';
    });
    sense.definition = DCC.clean(definition);
    sense.synonyms = DCC.clean(parts.synonyms);
    sense.antonyms = DCC.clean(parts.antonyms);
    for (const href of images) {
      DCC.addUnique(entry.images, { url: href, alt: entry.headword, caption: sense.definition, credit: '' }, 'url');
    }
    return sense;
  }
})();
