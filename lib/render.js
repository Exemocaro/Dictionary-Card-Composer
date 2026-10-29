// Builds the card Back from the draft. All text is escaped; no page HTML is ever reused.
(() => {
  const DCC = (globalThis.DCC = globalThis.DCC || {});

  const WORDS = {
    pt: {
      etymology: 'Etimologia:', synonyms: 'Sinónimos:', antonyms: 'Antónimos:', related: 'Ver também:',
      expressions: 'Expressões:', moreExamples: 'Mais exemplos:', relatedWords: 'Palavras relacionadas',
      collocations: 'Colocações:'
    },
    en: {
      etymology: 'Etymology:', synonyms: 'Synonyms:', antonyms: 'Antonyms:', related: 'See also:',
      expressions: 'Idioms and phrases:', moreExamples: 'More examples:', relatedWords: 'Related words',
      collocations: 'Collocations:'
    }
  };
  const words = language => WORDS[language] || WORDS.en;

  const esc = (DCC.escapeHtml = text => String(text == null ? '' : text).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));

  DCC.safeUrl = function (url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
    } catch {
      return '';
    }
  };

  const selectedSenses = (block, group, gi) => group.senses.filter((_, si) => block.selected.includes(`${gi}.${si}`));
  const selectedImages = block => block.entry.images.filter(image => block.selectedImages.includes(image.url));

  // One dictionary on one page. (A Cambridge page holds several dictionaries; each stays separate.)
  const samePage = (a, b) => a.entry.sourceUrl === b.entry.sourceUrl && a.entry.dictionary === b.entry.dictionary;
  const sameWord = (a, b) => samePage(a, b) && a.entry.headword === b.entry.headword;

  // How each block joins the one before it. Entries for the same word from the same page and
  // dictionary read as one (no rule, no repeated word) and share one citation at the end. A headword
  // line is only needed when the Back holds more than that, or the word differs from the Front.
  function layout(draft) {
    const oneWord = draft.blocks.every(block => sameWord(block, draft.blocks[0]));
    return draft.blocks.map((block, i) => {
      const previous = draft.blocks[i - 1];
      const next = draft.blocks[i + 1];
      const continues = Boolean(previous && sameWord(previous, block));
      const isFront = block.entry.headword.trim().toLowerCase() === draft.front.trim().toLowerCase();
      return {
        separator: i === 0 || continues ? '' : 'rule',
        showHeadword: !continues && !(oneWord && isFront),
        showCitation: !(next && samePage(next, block))
      };
    });
  }

  DCC.renderBack = function (draft, opts = {}) {
    return layout(draft)
      .map((place, i) => (place.separator ? '<hr>' : '') + DCC.renderBlock(draft.blocks[i], { ...opts, ...place }))
      .join('');
  };

  DCC.renderBackText = function (draft) {
    return layout(draft)
      .map((place, i) => (i === 0 ? '' : place.separator ? '\n\n' : '\n') + DCC.renderBlockText(draft.blocks[i], place))
      .join('');
  };

  DCC.renderBlock = function (block, opts = {}) {
    const { entry, options } = block;
    const w = words(entry.language);
    const parts = [];

    if (opts.showHeadword) parts.push(`<p><b>${esc(entry.headword)}</b></p>`);

    // Pictures come first, right under the word.
    if (options.images) {
      for (const image of selectedImages(block)) {
        const src = opts.imageSrc ? opts.imageSrc(image) : DCC.safeUrl(image.url);
        if (!src) continue;
        const note = [image.caption, image.credit].filter(Boolean).join(' — ');
        parts.push(`<p><img src="${esc(src)}" alt="${esc(image.alt)}">${note ? `<br><small>${esc(note)}</small>` : ''}</p>`);
      }
    }

    const pronunciation = options.pronunciation ? [entry.syllabification, entry.pronunciation].filter(Boolean).join(' ') : '';
    if (pronunciation) parts.push(`<p>${esc(pronunciation)}</p>`);

    entry.groups.forEach((group, gi) => {
      const senses = selectedSenses(block, group, gi);
      if (!senses.length) return;
      const more = options.examples && group.examples && group.examples.length
        ? `<p><b>${group.examplesTitle ? esc(group.examplesTitle) + ':' : w.moreExamples}</b>` +
          `${group.examples.map(example => `<br><i>${esc(example)}</i>`).join('')}</p>`
        : '';
      parts.push((group.partOfSpeech ? `<b>${esc(group.partOfSpeech)}</b>` : '') + senseList(senses, options) + more);
    });

    if (options.expressions !== false) {
      const expressions = entry.expressions || [];
      const defined = expressions.filter(expression => expression.definition);
      const listed = expressions.filter(expression => !expression.definition);
      if (defined.length) {
        parts.push(`<p><b>${w.expressions}</b></p><ul>${defined.map(expression => `<li>${expressionHtml(expression, options)}</li>`).join('')}</ul>`);
      }
      if (listed.length) {
        const links = listed.map(expression => {
          const url = DCC.safeUrl(expression.url);
          return url ? `<a href="${esc(url)}">${esc(expression.phrase)}</a>` : esc(expression.phrase);
        });
        parts.push(`<p><b>${w.expressions}</b> ${links.join(', ')}</p>`);
      }
      const collocations = (entry.collocations || []).map(c => {
        const url = DCC.safeUrl(c.url);
        const phrase = url ? `<a href="${esc(url)}">${esc(c.phrase)}</a>` : esc(c.phrase);
        const example = options.examples && c.example ? `<br><i>${esc(c.example)}</i>` : '';
        return `<li>${phrase}${example}${c.source ? ` <small>(${esc(c.source)})</small>` : ''}</li>`;
      });
      if (collocations.length) parts.push(`<p><b>${w.collocations}</b></p><ul>${collocations.join('')}</ul>`);
    }

    if (options.etymology && entry.etymology) parts.push(`<p><b>${w.etymology}</b> ${esc(entry.etymology)}</p>`);
    if (options.inflections && entry.inflections) parts.push(`<p>${esc(entry.inflections)}</p>`);
    if (options.synonyms && entry.synonyms.length) parts.push(`<p><b>${w.synonyms}</b> ${esc(entry.synonyms.join(', '))}</p>`);
    if (options.synonyms && entry.antonyms.length) parts.push(`<p><b>${w.antonyms}</b> ${esc(entry.antonyms.join(', '))}</p>`);
    if (options.synonyms) {
      for (const { topic, words: list } of entry.relatedWords || []) {
        parts.push(`<p><b>${w.relatedWords} (${esc(topic)}):</b> ${esc(list.join(', '))}</p>`);
      }
    }

    if (options.related) {
      const links = entry.relatedLinks
        .filter(link => DCC.safeUrl(link.url))
        .map(link => `<a href="${esc(DCC.safeUrl(link.url))}">${esc(link.word)}</a>`);
      if (links.length) parts.push(`<p>${w.related} ${links.join(', ')}</p>`);
    }

    if (options.citation && opts.showCitation !== false) parts.push(`<p><small>${citationHtml(entry)}</small></p>`);
    return `<div>${parts.join('')}</div>`;
  };

  function expressionHtml(expression, options) {
    let html = `<b>${esc(expression.phrase)}</b>: ${esc(expression.definition)}`;
    if (options.synonyms && expression.synonyms) html += ' = ' + esc(expression.synonyms);
    if (options.synonyms && expression.antonyms) html += ' ≠ ' + esc(expression.antonyms);
    if (options.examples) html += expression.examples.map(example => `<br><i>${esc(example)}</i>`).join('');
    return html;
  }

  function senseList(senses, options) {
    const labels = senses.map(sense => sense.label);
    const numbers = labels.every(label => /^\d+$/.test(label));
    const letters = labels.every(label => /^[a-z]$/.test(label));
    const unlabelled = labels.every(label => !label);
    const items = senses.map(sense => {
      let value = '';
      if (numbers) value = ` value="${sense.label}"`;
      if (letters) value = ` value="${sense.label.charCodeAt(0) - 96}"`;
      const prefix = numbers || letters || unlabelled ? '' : `<b>${esc(sense.label)}</b> `;
      return `<li${value}>${prefix}${senseHtml(sense, options)}</li>`;
    });
    if (numbers || unlabelled) return `<ol>${items.join('')}</ol>`;
    if (letters) return `<ol type="a">${items.join('')}</ol>`;
    return `<ul>${items.join('')}</ul>`;
  }

  function senseHtml(sense, options) {
    let html = esc(sense.definition);
    if (options.synonyms && sense.synonyms) html += ' = ' + esc(sense.synonyms);
    if (options.synonyms && sense.antonyms) html += ' ≠ ' + esc(sense.antonyms);
    if (options.examples) html += sense.examples.map(example => `<br><i>${esc(example)}</i>`).join('');
    if (sense.children.length) html += senseList(sense.children, options);
    return html;
  }

  // The page's own citation may print the address encoded or decoded ("%C3%A1lamos" or "álamos").
  function urlInCitation(citation, url) {
    let decoded = url;
    try {
      decoded = decodeURI(url);
    } catch {}
    return [url, decoded].find(form => form && citation.includes(form)) || '';
  }

  function citationHtml(entry) {
    const url = DCC.safeUrl(entry.sourceUrl);
    const link = url ? `<a href="${esc(url)}">${esc(url)}</a>` : '';
    if (entry.citation) {
      const text = esc(entry.citation);
      const shown = url && urlInCitation(entry.citation, url);
      if (shown) return text.replace(esc(shown), () => `<a href="${esc(url)}">${esc(shown)}</a>`);
      return link ? `${text} ${link}` : text;
    }
    const date = (entry.accessedAt || '').slice(0, 10);
    const name = `<b>"${esc(entry.headword)}"</b>`;
    if (entry.language === 'pt') return `${name}, in ${esc(entry.dictionary)} [em linha]${link ? ', ' + link : ''} [consultado em ${date}].`;
    return `${name}, ${esc(entry.dictionary)}${link ? ', ' + link : ''} (accessed ${date}).`;
  }

  function citationText(entry) {
    const url = DCC.safeUrl(entry.sourceUrl);
    if (entry.citation) return urlInCitation(entry.citation, url) ? entry.citation : [entry.citation, url].filter(Boolean).join(' ');
    const date = (entry.accessedAt || '').slice(0, 10);
    if (entry.language === 'pt') return `"${entry.headword}", in ${entry.dictionary} [em linha]${url ? ', ' + url : ''} [consultado em ${date}].`;
    return `"${entry.headword}", ${entry.dictionary}${url ? ', ' + url : ''} (accessed ${date}).`;
  }

  DCC.renderBlockText = function (block, opts = {}) {
    const { entry, options } = block;
    const w = words(entry.language);
    const lines = [];

    if (opts.showHeadword) lines.push(entry.headword);
    if (options.images) {
      for (const image of selectedImages(block)) {
        lines.push([DCC.safeUrl(image.url), image.caption, image.credit].filter(Boolean).join(' — '));
      }
    }
    const pronunciation = options.pronunciation ? [entry.syllabification, entry.pronunciation].filter(Boolean).join(' ') : '';
    if (pronunciation) lines.push(pronunciation);

    entry.groups.forEach((group, gi) => {
      const senses = selectedSenses(block, group, gi);
      if (!senses.length) return;
      if (group.partOfSpeech) lines.push(group.partOfSpeech);
      senseLines(senses, options, '', lines);
      if (options.examples && group.examples && group.examples.length) {
        lines.push(group.examplesTitle ? group.examplesTitle + ':' : w.moreExamples, ...group.examples.map(example => `   ${example}`));
      }
    });

    if (options.expressions !== false && (entry.expressions || []).length) {
      lines.push(w.expressions);
      for (const expression of entry.expressions) {
        let line = `- ${expression.phrase}${expression.definition ? ': ' + expression.definition : ''}`;
        if (options.synonyms && expression.synonyms) line += ' = ' + expression.synonyms;
        if (options.synonyms && expression.antonyms) line += ' ≠ ' + expression.antonyms;
        lines.push(line);
        if (options.examples) for (const example of expression.examples) lines.push(`   ${example}`);
      }
    }
    if (options.expressions !== false && (entry.collocations || []).length) {
      lines.push(w.collocations);
      for (const c of entry.collocations) {
        const example = options.examples && c.example ? ': ' + c.example : '';
        lines.push(`- ${c.phrase}${example}${c.source ? ` (${c.source})` : ''}`);
      }
    }

    if (options.etymology && entry.etymology) lines.push(`${w.etymology} ${entry.etymology}`);
    if (options.inflections && entry.inflections) lines.push(entry.inflections);
    if (options.synonyms && entry.synonyms.length) lines.push(`${w.synonyms} ${entry.synonyms.join(', ')}`);
    if (options.synonyms && entry.antonyms.length) lines.push(`${w.antonyms} ${entry.antonyms.join(', ')}`);
    if (options.synonyms) {
      for (const { topic, words: list } of entry.relatedWords || []) lines.push(`${w.relatedWords} (${topic}): ${list.join(', ')}`);
    }
    if (options.related && entry.relatedLinks.length) {
      lines.push(`${w.related} ${entry.relatedLinks.map(link => link.word).join(', ')}`);
    }
    if (options.citation && opts.showCitation !== false) lines.push(citationText(entry));
    return lines.join('\n');
  };

  function senseLines(senses, options, indent, lines) {
    senses.forEach((sense, i) => {
      const label = sense.label || String(i + 1);
      let line = sense.definition;
      if (options.synonyms && sense.synonyms) line += ' = ' + sense.synonyms;
      if (options.synonyms && sense.antonyms) line += ' ≠ ' + sense.antonyms;
      lines.push(`${indent}${/^\w+$/.test(label) ? label + '.' : label} ${line}`.trimEnd());
      if (options.examples) for (const example of sense.examples) lines.push(`${indent}   ${example}`);
      senseLines(sense.children, options, indent + '   ', lines);
    });
  }
})();
