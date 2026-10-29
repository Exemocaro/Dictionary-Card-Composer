// A Cambridge page can hold several dictionaries (Advanced Learner's, American, Business),
// each with one entry per part of speech. Every one of those becomes its own entry.
// Within an entry, each guide word ("fare noun (PAYMENT)", "(FOOD)") becomes its own group.
(() => {
  const DCC = globalThis.DCC;
  const DICTIONARIES = {
    cald4: "Cambridge Advanced Learner's Dictionary & Thesaurus",
    cacd: 'Cambridge Academic Content Dictionary',
    cbed: 'Cambridge Business English Dictionary'
  };

  DCC.parsers.cambridge = function (doc, url) {
    const entries = [];
    for (const section of doc.querySelectorAll('.pr.dictionary')) {
      const dictionary = DICTIONARIES[section.getAttribute('data-id')] || 'Cambridge Dictionary';
      for (const body of section.querySelectorAll('.entry-body__el')) {
        const header = body.querySelector('.pos-header') || body;
        const entry = DCC.newEntry({ site: 'cambridge', language: 'en', dictionary, sourceUrl: url });
        entry.headword = DCC.text(header.querySelector('.hw'));
        entry.inflections = DCC.text(header.querySelector('.irreg-infls'));
        entry.pronunciation = ['uk', 'us']
          .map(region => {
            const pron = header.querySelector(`.${region}.dpron-i .pron`);
            return pron ? `${region.toUpperCase()} ${DCC.text(pron)}` : '';
          })
          .filter(Boolean)
          .join(', ');

        const partOfSpeech = DCC.text(header.querySelector('.posgram'));
        const senseGroups = body.querySelectorAll('.dsense');
        for (const dsense of senseGroups.length ? senseGroups : [body]) {
          const guideWord = DCC.text(dsense.querySelector('.dsense_h .guideword'));
          const group = DCC.newGroup({
            partOfSpeech: [partOfSpeech, guideWord].filter(Boolean).join(' '),
            // The "More examples" list under a guide word.
            examples: [...dsense.querySelectorAll('.daccord li.eg')].map(el => DCC.text(el))
          });
          for (const block of dsense.querySelectorAll('.def-block')) {
            if (!block.closest('.daccord, .smartt')) group.senses.push(parseSense(block, entry, url));
          }
          if (group.senses.length) entry.groups.push(group);
        }

        // "SMART Vocabulary: related words and phrases": topic headings, each followed by its word list.
        for (const box of body.querySelectorAll('.smartt .daccord_b')) {
          let related = null;
          for (const part of box.children) {
            if (part.matches('.daccord_lt')) {
              const topic = DCC.text(part);
              related = entry.relatedWords.find(r => r.topic === topic);
              if (!related) entry.relatedWords.push((related = { topic, words: [] }));
            } else if (part.matches('.daccord_lb') && related) {
              for (const link of part.querySelectorAll('li a')) {
                const word = DCC.text(link.querySelector('.hw, .phrase') || link); // without the "idiom" tag
                if (word && word !== entry.headword && !related.words.includes(word)) related.words.push(word);
              }
            }
          }
        }

        for (const link of body.querySelectorAll('.xref.idioms a[href], .xref.idiom a[href], .xref.phrasal_verbs a[href], .xref.phrasal_verb a[href]')) {
          DCC.addUnique(entry.expressions, DCC.newExpression({
            phrase: DCC.text(link.querySelector('.x-h') || link),
            url: DCC.absoluteUrl(link.getAttribute('href'), url)
          }), 'url');
        }
        entries.push(entry);
      }
    }

    // "Collocations with <word>" sits outside the dictionaries, so it goes with the main (first) entry.
    if (entries.length) {
      for (const item of doc.querySelectorAll('.cpexamps .cpegs > div')) {
        const link = item.querySelector(':scope > a[href]');
        if (!link || !item.querySelector('.dexamp')) continue; // skips the "See all collocations" button
        entries[0].collocations.push({
          phrase: DCC.text(link),
          url: DCC.absoluteUrl(link.getAttribute('href'), url),
          example: DCC.text(item.querySelector('.dexamp')),
          source: DCC.text(item.querySelector('.dsource'), el => el.matches('.hdn')) // without the hidden licence pop-up
        });
      }
    }
    return DCC.keepEntries(entries);
  };

  function parseSense(block, entry, url) {
    // The CEFR level (A1, B2…) is a study aid, not part of the definition.
    let definition = DCC.text(block.querySelector('.ddef_h'), el => el.matches('.epp-xref')).replace(/:$/, '');
    const phrase = block.closest('.phrase-block');
    if (phrase) definition = `${DCC.text(phrase.querySelector('.phrase-title'))}: ${definition}`;

    for (const picture of block.querySelectorAll('.dimg')) {
      const img = picture.querySelector('amp-img[src]') || picture.querySelector('img[src]');
      const src = img ? DCC.absoluteUrl(img.getAttribute('src'), url) : '';
      if (src) DCC.addUnique(entry.images, { url: src, alt: img.getAttribute('alt') || entry.headword, caption: definition, credit: '' }, 'url');
    }
    for (const link of block.querySelectorAll('.xref.see_also a[href], .xref.compare a[href]')) {
      DCC.addUnique(entry.relatedLinks, {
        word: DCC.text(link.querySelector('.x-h') || link),
        url: DCC.absoluteUrl(link.getAttribute('href'), url)
      }, 'url');
    }
    const words = selector => [...block.querySelectorAll(selector)].map(el => DCC.text(el)).join(', ');
    return DCC.newSense({
      definition,
      examples: [...block.querySelectorAll(':scope > .def-body > .examp')].map(el => DCC.text(el)),
      synonyms: words('.xref.synonym .x-h, .xref.synonyms .x-h'),
      antonyms: words('.xref.opposite .x-h, .xref.opposites .x-h')
    });
  }
})();
