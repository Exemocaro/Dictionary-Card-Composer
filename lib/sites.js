(() => {
  const DCC = (globalThis.DCC = globalThis.DCC || {});

  DCC.sites = [
    {
      id: 'oxford',
      name: "Oxford Learner's Dictionaries",
      parser: 'parsers/oxford.js',
      origin: 'https://www.oxfordlearnersdictionaries.com/*',
      matches: u => u.hostname === 'www.oxfordlearnersdictionaries.com' && /^\/definition\/(english|american_english)\/./.test(u.pathname)
    },
    {
      id: 'merriam-webster',
      name: 'Merriam-Webster',
      parser: 'parsers/merriam-webster.js',
      origin: 'https://www.merriam-webster.com/*',
      matches: u => u.hostname === 'www.merriam-webster.com' && /^\/dictionary\/./.test(u.pathname)
    },
    {
      id: 'cambridge',
      name: 'Cambridge Dictionary',
      parser: 'parsers/cambridge.js',
      origin: 'https://dictionary.cambridge.org/*',
      // English entries, also under the US and translated site sections, e.g. /pt/dicionario/ingles/<word>.
      matches: u => u.hostname === 'dictionary.cambridge.org' &&
        /^\/(?:[a-z]{2}(?:-[a-z]{2,4})?\/)?(?:dictionary|dicionario|diccionario|dictionnaire|worterbuch|dizionario)\/(?:english|ingles|anglais|englisch|inglese)\/[^/]+/.test(u.pathname)
    },
    {
      id: 'priberam',
      name: 'Priberam',
      parser: 'parsers/priberam.js',
      origin: 'https://dicionario.priberam.org/*',
      // Entries are /<word>, /pt-pt/<word> or /pt-br/<word>; other sections use subfolders.
      matches: u => u.hostname === 'dicionario.priberam.org' && /^\/(?:pt-(?:pt|br)\/)?(?!pt-(?:pt|br)$)[^/]+$/.test(u.pathname)
    },
    {
      id: 'infopedia',
      name: 'Infopédia',
      parser: 'parsers/infopedia.js',
      origin: 'https://www.infopedia.pt/*',
      matches: u => u.hostname === 'www.infopedia.pt' && /^\/dicionarios\/lingua-portuguesa\/./.test(u.pathname)
    }
  ];

  DCC.siteForUrl = function (url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (parsed.protocol !== 'https:') return null;
    return DCC.sites.find(site => site.matches(parsed)) || null;
  };
})();
