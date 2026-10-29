// British English pages (/definition/english/) and American English pages
// (/definition/american_english/) use different markup, so most selectors list both.
(() => {
  const DCC = globalThis.DCC;
  // Sense parts are spans and lists; divs inside a sense are ads, promos and collapsed boxes.
  const NOT_DEFINITION = '.examples, .x-gs, .xrefs, .xr-gs, .topic-g, .num, div';

  DCC.parsers.oxford = function (doc, url) {
    const root = doc.querySelector('#entryContent .entry');
    const top = root && root.querySelector('.webtop, .webtop-g');
    if (!top) return [];

    const fromTitle = doc.title.match(/\|\s*(.+?) at OxfordLearnersDictionaries/i);
    const american = url.includes('/american_english/');
    const entry = DCC.newEntry({
      site: 'oxford',
      language: 'en',
      sourceUrl: url,
      dictionary: fromTitle ? fromTitle[1] : american ? 'Oxford Advanced American Dictionary' : "Oxford Advanced Learner's Dictionary"
    });
    entry.headword = DCC.text(top.querySelector('.headword, .h'));
    entry.inflections = DCC.text(top.querySelector('.inflections'));
    entry.pronunciation = pronunciation(root);

    const senses = [];
    for (const li of root.querySelectorAll('li.sense, li.sn-g')) {
      if (li.closest('.idioms, .idm-gs, .pv-g, .pv-gs, .collapse')) continue;
      const words = type => [...li.querySelectorAll(`:scope > .xrefs[xt="${type}"] .xh`)].map(el => DCC.text(el)).join(', ');
      senses.push(DCC.newSense({
        label: li.getAttribute('sensenum') || DCC.text(li.querySelector(':scope > .num')),
        definition: DCC.text(li, el => el.matches(NOT_DEFINITION)),
        examples: [...li.querySelectorAll(':scope > ul.examples > li, :scope > .x-gs > .x-g')].map(el => DCC.text(el)),
        synonyms: words('syn'),
        antonyms: words('opp')
      }));
      for (const link of li.querySelectorAll(':scope > .xrefs:not([xt="syn"]):not([xt="opp"]) a.Ref, :scope > .xr-gs a.Ref')) {
        DCC.addUnique(entry.relatedLinks, { word: DCC.text(link), url: DCC.absoluteUrl(link.getAttribute('href'), url) }, 'url');
      }
    }
    entry.groups.push(DCC.newGroup({ partOfSpeech: DCC.text(top.querySelector('.pos')), senses }));

    for (const idiom of root.querySelectorAll('.idioms .idm-g, .idm-gs .idm-g')) {
      const meanings = [...idiom.querySelectorAll('li.sense, .sn-g')];
      // Labels such as "(old-fashioned)" can sit on the idiom rather than on its meaning;
      // variants ("(British English also … a happy bunny)") go with the phrase.
      const labels = [...idiom.querySelectorAll('.labels')].filter(el => !el.closest('li, .sn-g, .variants')).map(el => DCC.text(el));
      const variants = [...idiom.querySelectorAll('.variants')].filter(el => !el.closest('li, .sn-g')).map(el => DCC.text(el));
      entry.expressions.push(DCC.newExpression({
        phrase: [DCC.text(idiom.querySelector('.idm')), ...variants].join(' '),
        definition: labels.concat(meanings.map(li => DCC.text(li, el => el.matches(NOT_DEFINITION))).join('; ')).join(' ').trim(),
        examples: meanings.flatMap(li => [...li.querySelectorAll(':scope > ul.examples > li, :scope > .x-gs > .x-g')].map(el => DCC.text(el)))
      }));
    }

    const origin = [...root.querySelectorAll('.unbox[unbox="wordorigin"] .body')].find(el => !el.closest('.idioms'));
    entry.etymology = DCC.text(origin);
    return DCC.keepEntries([entry]);
  };

  function pronunciation(root) {
    const british = [['.phons_br .phon', 'BrE'], ['.phons_n_am .phon', 'NAmE']]
      .map(([selector, name]) => {
        const phon = root.querySelector('.webtop ' + selector);
        return phon ? `${name} ${DCC.text(phon)}` : '';
      })
      .filter(Boolean);
    if (british.length) return british.join(', ');

    return [...root.querySelectorAll('.top-container .pron-gs .phon')]
      .map(phon => `${DCC.text(phon.querySelector('.name'))} ${DCC.text(phon, el => el.matches('.name, .separator'))}`.trim())
      .join(', ');
  }
})();
