// Helpers shared by every parser. Parsers return plain data, never page HTML.
(() => {
  const DCC = (globalThis.DCC = globalThis.DCC || {});
  DCC.parsers = DCC.parsers || {};

  DCC.clean = function (text) {
    return (text || '')
      .replace(/[\u00a0\u2007\u202f]/g, ' ')
      .replace(/[\u200b-\u200d\ufeff]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,;:!?)\]])/g, '$1')
      .replace(/([([])\s+/g, '$1')
      .trim();
  };

  // Text of an element, leaving out scripts and any descendant for which skip(el) is true.
  DCC.rawText = function (el, skip) {
    if (!el) return '';
    let out = '';
    for (const child of el.childNodes) {
      if (child.nodeType === 3) {
        out += child.nodeValue;
      } else if (child.nodeType === 1) {
        if (/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|SVG|AUDIO|VIDEO)$/i.test(child.tagName)) continue;
        if (skip && skip(child)) continue;
        const block = /^(BR|P|DIV|LI|UL|OL|H\d)$/i.test(child.tagName);
        out += (block ? ' ' : '') + DCC.rawText(child, skip) + (block ? ' ' : '');
      }
    }
    return out;
  };

  DCC.text = (el, skip) => DCC.clean(DCC.rawText(el, skip));

  DCC.absoluteUrl = function (href, base) {
    try {
      const url = new URL((href || '').trim(), base);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch {
      return '';
    }
  };

  DCC.newEntry = fields => Object.assign({
    headword: '',
    homograph: '',
    language: '',
    dictionary: '',
    site: '',
    sourceUrl: '',
    pronunciation: '',
    syllabification: '',
    groups: [],
    etymology: '',
    inflections: '',
    synonyms: [],
    antonyms: [],
    relatedLinks: [],
    images: [],
    expressions: [],
    relatedWords: [], // [{ topic, words }], e.g. Cambridge's "SMART Vocabulary"
    collocations: [], // [{ phrase, url, example, source }], e.g. Cambridge's "Collocations with …"
    citation: '',
    accessedAt: new Date().toISOString()
  }, fields);

  // A part of speech (or Cambridge guide word) with its meanings, plus examples not tied to one
  // meaning, shown under examplesTitle when the dictionary names them ("Examples of cat in a Sentence").
  DCC.newGroup = fields => Object.assign({ partOfSpeech: '', senses: [], examples: [], examplesTitle: '' }, fields);

  // Idioms and fixed expressions. Some dictionaries only list them as links, without a definition.
  DCC.newExpression = fields => Object.assign({
    phrase: '',
    definition: '',
    examples: [],
    synonyms: '',
    antonyms: '',
    url: ''
  }, fields);

  DCC.newSense = fields => Object.assign({
    label: '',
    definition: '',
    examples: [],
    synonyms: '',
    antonyms: '',
    children: []
  }, fields);

  DCC.addUnique = function (list, item, key) {
    if (item[key] && !list.some(existing => existing[key] === item[key])) list.push(item);
  };

  DCC.keepEntries = entries => entries.filter(e => e.headword && e.groups.some(g => g.senses.length));
})();
