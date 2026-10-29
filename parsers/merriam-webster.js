// Selectors checked against saved merriam-webster.com pages (ablution, happy), October 2026.
// Each numbered sense is a .vg-sseq-entry-item: the number sits in its label, and lettered
// sub-senses (1 a, 1 b…) are the .sense elements inside it.
(() => {
  const DCC = globalThis.DCC;
  // Sense numbers, inline pronunciations and examples are not part of a definition's text.
  const NOT_DEFINITION = '.sn, .sub-content-thread, .ex-sent, .prt-a';

  DCC.parsers['merriam-webster'] = function (doc, url) {
    const sections = [...doc.querySelectorAll('.entry-word-section-container')];
    // Each etymology may be headed by the part of speech it belongs to ("Noun").
    const etymologies = [...doc.querySelectorAll('#word-history .etymology-content-section .et')].map(et => {
      const heading = et.previousElementSibling;
      return { label: heading && heading.matches('.function-label') ? DCC.text(heading) : '', text: DCC.text(et) };
    });
    const synonyms = [...doc.querySelectorAll('#synonyms .dictionary-synonyms-item')].map(el => DCC.text(el)).filter(Boolean);
    const citation = DCC.text(doc.querySelector('#citations-card-text'));

    const entries = sections.map((section, index) => {
      const entry = DCC.newEntry({
        site: 'merriam-webster',
        language: 'en',
        dictionary: 'Merriam-Webster.com Dictionary',
        sourceUrl: url,
        citation
      });
      entry.headword = DCC.text(section.querySelector('.hword'));
      entry.syllabification = DCC.text(section.querySelector('.word-syllables-entry'));
      entry.pronunciation = [...new Set([...section.querySelectorAll('.prons-entries-list-inline a')].map(el => DCC.text(el)))]
        .filter(Boolean)
        .join(', ');
      entry.inflections = DCC.text(section.querySelector('.vg-ins'));

      const partOfSpeech = DCC.text(section.querySelector('.parts-of-speech'));
      for (const vg of section.querySelectorAll('.vg')) {
        const group = DCC.newGroup({ partOfSpeech: DCC.text(vg.querySelector('.vd')) || partOfSpeech });
        const items = vg.querySelectorAll('.vg-sseq-entry-item');
        if (!items.length) group.senses.push(...[...vg.querySelectorAll('.sense')].map(parseSense));
        for (const item of items) {
          const label = DCC.text(item.querySelector('.vg-sseq-entry-item-label'));
          const senses = [...item.querySelectorAll('.sense')].map(parseSense);
          if (senses.length === 1 && !senses[0].label) group.senses.push(Object.assign(senses[0], { label }));
          else group.senses.push(DCC.newSense({ label, children: senses }));
        }
        entry.groups.push(group);
      }
      // The synonym and phrase lists on the page are for the main (first) entry.
      if (index === 0) {
        entry.synonyms = synonyms;
        entry.expressions = [...doc.querySelectorAll('#related-phrases .related-phrases-list-item a')].map(link =>
          DCC.newExpression({ phrase: DCC.text(link), url: DCC.absoluteUrl(link.getAttribute('href'), url) }));
      }
      return entry;
    });

    // A labelled etymology goes to the first entry of that part of speech without one yet. Unlabelled
    // ones are only paired when there is one per entry, or a single one, so none lands on the wrong word.
    etymologies.forEach((etymology, i) => {
      const entry = etymology.label
        ? entries.find(e => !e.etymology && e.groups.some(g => names(etymology.label, g.partOfSpeech)))
        : etymologies.length === entries.length ? entries[i] : etymologies.length === 1 ? entries[0] : null;
      if (entry) entry.etymology = etymology.text;
    });

    // "Examples of <word> in a Sentence" come under headings such as "Noun" or "Verb";
    // each goes with the first group of that part of speech. (Web examples are left out.)
    const title = DCC.text(doc.querySelector('#examples .content-section-header h2'));
    const groups = entries.flatMap(entry => entry.groups);
    let label = '';
    for (const el of doc.querySelectorAll('#examples .in-sentences .ex-header, #examples .in-sentences .ex-sent')) {
      if (el.matches('.ex-header')) label = DCC.text(el);
      else if (groups.length) {
        const group = groups.find(g => names(label, g.partOfSpeech)) || groups[0];
        group.examples.push(DCC.text(el));
        group.examplesTitle = title;
      }
    }
    return DCC.keepEntries(entries);
  };

  // Whether a heading such as "Verb" or "Noun (1)" names this part of speech, as a whole word:
  // "Verb" fits "transitive verb" but not "adverb".
  function names(label, partOfSpeech) {
    const word = label.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();
    if (!word) return true;
    return new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(partOfSpeech.toLowerCase());
  }

  function parseSense(el) {
    const content = el.querySelector('.sense-content') || el;
    return DCC.newSense({
      label: DCC.text(el.querySelector(':scope > .sn')),
      definition: DCC.text(content, child => child.matches(NOT_DEFINITION)).replace(/^:\s*/, ''),
      // One thread per example, including its "—Author" line when it is a quotation.
      examples: [...el.querySelectorAll('.sub-content-thread')]
        .map(thread => [...thread.querySelectorAll(':scope > .ex-sent')].map(ex => DCC.text(ex)).join(' '))
        .filter(Boolean)
    });
  }
})();
