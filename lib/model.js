// The card draft: an editable Front plus an ordered list of source blocks for the Back.
(() => {
  const DCC = (globalThis.DCC = globalThis.DCC || {});

  DCC.DRAFT_VERSION = 1;

  DCC.newDraft = () => ({ version: DCC.DRAFT_VERSION, front: '', blocks: [], backOverride: '' });

  DCC.defaultOptions = () => ({
    pronunciation: true,
    examples: true,
    etymology: true,
    synonyms: true,
    inflections: true,
    expressions: true,
    related: false,
    images: true,
    citation: true
  });

  // Meanings are selected by "group.sense" keys, e.g. "1.0" is the first sense of the second group.
  DCC.senseKeys = entry => entry.groups.flatMap((group, gi) => group.senses.map((_, si) => `${gi}.${si}`));

  DCC.newBlock = entry => ({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    entry,
    selected: DCC.senseKeys(entry),
    selectedImages: entry.images.map(image => image.url),
    options: DCC.defaultOptions()
  });

  // One page can hold several entries for the same word (noun, verb…), so they differ by part of speech too.
  const entryKey = entry => [entry.sourceUrl, entry.dictionary, entry.headword, entry.homograph,
    ...entry.groups.map(group => group.partOfSpeech)].join('\n');

  DCC.isDuplicate = (draft, entry) => draft.blocks.some(block => entryKey(block.entry) === entryKey(entry));

  // Only an empty Front is filled in; a Front the user already has is never rewritten.
  DCC.addBlock = function (draft, block) {
    if (!draft.front.trim()) draft.front = block.entry.headword;
    draft.blocks.push(block);
    return draft;
  };

  DCC.moveBlock = function (draft, index, delta) {
    const target = index + delta;
    if (target < 0 || target >= draft.blocks.length) return draft;
    const [block] = draft.blocks.splice(index, 1);
    draft.blocks.splice(target, 0, block);
    return draft;
  };

  DCC.removeBlock = function (draft, index) {
    draft.blocks.splice(index, 1);
    return draft;
  };

  DCC.withoutImageData = draft => ({
    ...draft,
    blocks: draft.blocks.map(block => ({
      ...block,
      entry: { ...block.entry, images: block.entry.images.map(({ data, type, ...image }) => image) }
    }))
  });

  // Pictures read from the page are kept with the draft. If that doesn't fit in the extension's
  // storage, the draft is saved without them and Anki downloads those pictures itself instead.
  DCC.saveDraft = async function (draft, extra = {}) {
    try {
      await chrome.storage.local.set({ draft, ...extra });
    } catch {
      await chrome.storage.local.set({ draft: DCC.withoutImageData(draft), ...extra });
    }
  };

  DCC.loadDraft = function (stored) {
    if (!stored || stored.version !== DCC.DRAFT_VERSION || !Array.isArray(stored.blocks)) return DCC.newDraft();
    return Object.assign(DCC.newDraft(), stored);
  };
})();
