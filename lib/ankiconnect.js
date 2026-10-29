// Optional export to desktop Anki through the AnkiConnect add-on.
// ankiInvoke runs in the background worker; the helpers below take an `invoke` function.
(() => {
  const DCC = (globalThis.DCC = globalThis.DCC || {});

  DCC.ANKI_URL = 'http://127.0.0.1:8765';

  DCC.ankiInvoke = async function (action, params = {}) {
    let response;
    try {
      response = await fetch(DCC.ANKI_URL, { method: 'POST', body: JSON.stringify({ action, version: 6, params }) });
    } catch {
      throw new Error("Couldn't reach Anki. Is Anki running with the AnkiConnect add-on installed?");
    }
    if (!response.ok) {
      throw new Error(`Anki refused the request (HTTP ${response.status}). Try again and choose Yes when Anki asks to allow this extension.`);
    }
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  };

  DCC.mediaFilename = function (image, headword) {
    let path;
    try {
      path = new URL(image.url).pathname;
    } catch {
      return null;
    }
    // The type of fetched image data wins; some image addresses have no extension at all,
    // and Anki shows those fine when saved as .jpg.
    const fromType = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' }[image.type];
    const ext = (fromType || (path.match(/\.([a-z0-9]+)$/i) || [])[1] || 'jpg').toLowerCase();
    if (!/^(jpe?g|png|gif|webp|svg)$/.test(ext)) return null;
    const base = String(headword || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'image';
    return `dcc-${base}-${hash(image.url)}.${ext}`;
  };

  // Same URL, same name: re-sending an image reuses the file instead of piling up copies.
  function hash(text) {
    let h = 0;
    for (const char of text) h = (h * 31 + char.codePointAt(0)) >>> 0;
    return h.toString(36);
  }

  // Images fetched on the page are sent as data; otherwise Anki downloads them itself.
  // Returns { stored: { imageUrl: savedFilename }, failures: [...] }.
  DCC.storeImages = async function (invoke, images, headword) {
    const stored = {};
    const failures = [];
    for (const image of images) {
      let name = image.url.split('/').pop();
      try {
        name = decodeURIComponent(name);
      } catch {} // a broken %-escape: show the name as it is
      const filename = DCC.mediaFilename(image, headword);
      if (!filename) {
        failures.push(`${name}: unsupported image format`);
        continue;
      }
      try {
        stored[image.url] = await invoke('storeMediaFile', image.data ? { filename, data: image.data } : { filename, url: image.url });
      } catch (err) {
        failures.push(`${name}: ${err.message}`);
      }
    }
    return { stored, failures };
  };

  DCC.buildAnkiNote = (settings, front, back) => ({
    deckName: settings.deck,
    modelName: settings.model,
    fields: { [settings.frontField]: front, [settings.backField]: back },
    options: { allowDuplicate: false, duplicateScope: 'deck' },
    tags: []
  });

  DCC.checkAnkiNote = async function (invoke, settings, front) {
    const [canAdd] = await invoke('canAddNotes', { notes: [DCC.buildAnkiNote(settings, front, '-')] });
    if (!canAdd) throw new Error('Anki would not add this note: a card with the same Front is already in this deck, or the Front is empty.');
  };

  DCC.addAnkiNote = (invoke, settings, front, back) => invoke('addNote', { note: DCC.buildAnkiNote(settings, front, back) });

  // Built-in "Basic" note type in a few Anki languages; Cloze types can't take a plain Front/Back.
  const BASIC = ['Basic', 'Básico', 'Básica', 'Basique', 'Einfach', 'Base'];
  const CLOZE = /cloze|omiss|lacuna|lückentext|texte à trous/i;

  // Cards go to this deck until the user picks another one. It is created when first needed.
  DCC.DEFAULT_DECK = 'Dictionary Cards';

  // AnkiConnect has no API key unless the user sets one; this extension doesn't use one.
  DCC.ankiAllow = async function (invoke) {
    const permission = await invoke('requestPermission');
    if (permission.permission !== 'granted') throw new Error('Anki did not allow this extension. Try again and choose Yes in Anki.');
    if (permission.requireApikey) {
      throw new Error('Your AnkiConnect is set to require an API key, which this extension does not use. In Anki, open Tools → Add-ons → AnkiConnect → Config and set "apiKey" back to null.');
    }
  };

  // Keeps the chosen deck (recreated if it was deleted), and the saved note type and fields while
  // they still exist; otherwise picks a Basic-style note type with its first two fields.
  DCC.resolveAnkiSettings = async function (invoke, saved = {}) {
    const deck = saved.deck || DCC.DEFAULT_DECK;
    const models = await invoke('modelNames');
    const model = models.includes(saved.model) ? saved.model
      : models.find(name => BASIC.includes(name)) || models.find(name => !CLOZE.test(name)) || models[0];
    if (!model) throw new Error('Anki has no note type to add to.');

    const fields = await invoke('modelFieldNames', { modelName: model });
    if (fields.length < 2) throw new Error(`The note type "${model}" needs at least two fields. Choose another one in the detailed panel.`);
    const frontField = fields.includes(saved.frontField) ? saved.frontField : fields[0];
    const backField = fields.includes(saved.backField) && saved.backField !== frontField
      ? saved.backField
      : fields.find(field => field !== frontField);
    return { deck, model, frontField, backField };
  };

  DCC.replaceImageSources = function (html, stored) {
    const attr = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return Object.entries(stored).reduce((out, [url, name]) => out.split(`src="${attr(url)}"`).join(`src="${attr(name)}"`), html);
  };

  // Sends the whole card: checks duplicates first, then saves images, then adds the note.
  // An image that can't be saved is left out of the note and listed in `skipped`.
  DCC.uploadDraft = async function (invoke, saved, draft) {
    if (!draft.front.trim() || (!draft.blocks.length && !draft.backOverride)) throw new Error('The card is empty.');
    await DCC.ankiAllow(invoke);

    const settings = await DCC.resolveAnkiSettings(invoke, saved);
    await invoke('createDeck', { deck: settings.deck }); // does nothing if the deck exists
    const front = DCC.escapeHtml(draft.front);
    await DCC.checkAnkiNote(invoke, settings, front);

    const images = draft.blocks.flatMap(block =>
      block.options.images ? block.entry.images.filter(image => block.selectedImages.includes(image.url)) : []);
    const { stored, failures } = await DCC.storeImages(invoke, images, draft.front);
    const back = draft.backOverride
      ? DCC.replaceImageSources(draft.backOverride, stored)
      : DCC.renderBack(draft, { imageSrc: image => stored[image.url] });
    await DCC.addAnkiNote(invoke, settings, front, back);
    return { settings, skipped: failures };
  };
})();
