const $ = selector => document.querySelector(selector);

let draft = DCC.newDraft();
let settings = { deck: '', model: '', frontField: '', backField: '', key: '' };
let pending = null; // { entries, block } read from the current page, not yet on the card
const expanded = new Set(); // ids of blocks whose details are open

// ---------- helpers ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function setStatus(target, message, isError = false) {
  target.textContent = message;
  target.classList.toggle('error', isError);
}

function siteName(id) {
  const site = DCC.sites.find(s => s.id === id);
  return site ? site.name : id;
}

function saveDraft() {
  DCC.saveDraft(draft).catch(err => setStatus($('#card-status'), "Couldn't save the card: " + err.message, true));
}

function saveSettings() {
  chrome.storage.local.set({ ankiSettings: settings });
}

function changed() {
  saveDraft();
  renderPreview();
}

// ---------- block editor (used for the page entry and for blocks on the card) ----------

function blockEditor(block, controls) {
  const { entry } = block;
  const box = el('div', 'block');

  const title = el('div', 'block-title');
  const name = el('span', 'grow');
  name.append(el('strong', '', entry.headword + (entry.homograph ? ` (${entry.homograph})` : '')), el('span', 'muted', ' — ' + siteName(entry.site)));
  title.append(name);
  if (controls) title.append(...controls);
  box.append(title);

  const hasExamples = entry.groups.some(g => g.senses.some(s => s.examples.length));
  const hasSynonyms = entry.synonyms.length || entry.antonyms.length || (entry.relatedWords || []).length ||
    entry.groups.some(g => g.senses.some(s => s.synonyms || s.antonyms));
  const options = el('div', 'options');
  for (const [key, label, available] of [
    ['pronunciation', 'Pronunciation', entry.pronunciation || entry.syllabification],
    ['examples', 'Examples', hasExamples],
    ['etymology', 'Etymology', entry.etymology],
    ['synonyms', 'Synonyms/antonyms', hasSynonyms],
    ['inflections', 'Inflections', entry.inflections],
    ['expressions', 'Expressions, idioms & collocations', (entry.expressions || []).length + (entry.collocations || []).length],
    ['related', 'Related words', entry.relatedLinks.length],
    ['images', 'Images', entry.images.length],
    ['citation', 'Citation', true]
  ]) {
    const input = el('input');
    input.type = 'checkbox';
    input.checked = block.options[key] && Boolean(available);
    input.disabled = !available;
    input.addEventListener('change', () => {
      block.options[key] = input.checked;
      if (key === 'images') refresh();
      else changed();
    });
    const option = el('label', available ? '' : 'absent');
    option.append(input, ' ' + label + (available ? '' : ' (none)'));
    options.append(option);
  }
  box.append(options);
  box.append(senseChooser(block));
  if (block.options.images && entry.images.length) box.append(imageChooser(block));
  return box;
}

function senseChooser(block) {
  const details = el('details', 'senses');
  details.open = !controlsFor(block) || expanded.has(block.id);
  details.addEventListener('toggle', () => (details.open ? expanded.add(block.id) : expanded.delete(block.id)));
  const total = DCC.senseKeys(block.entry).length;
  details.append(el('summary', '', `Meanings (${block.selected.length} of ${total})`));

  const row = el('div', 'row');
  for (const [label, keys] of [['All', () => DCC.senseKeys(block.entry)], ['None', () => []]]) {
    const button = el('button', 'secondary small', label);
    button.addEventListener('click', () => {
      block.selected = keys();
      refresh();
    });
    row.append(button);
  }
  details.append(row);

  block.entry.groups.forEach((group, gi) => {
    if (group.partOfSpeech) details.append(el('div', 'pos', group.partOfSpeech));
    group.senses.forEach((sense, si) => {
      const key = `${gi}.${si}`;
      const input = el('input');
      input.type = 'checkbox';
      input.checked = block.selected.includes(key);
      input.addEventListener('change', () => {
        block.selected = DCC.senseKeys(block.entry).filter(k => (k === key ? input.checked : block.selected.includes(k)));
        details.querySelector('summary').textContent = `Meanings (${block.selected.length} of ${total})`;
        changed();
      });
      const text = sense.definition || sense.children.map(c => c.definition).join(' / ');
      const label = el('label');
      label.append(input, ` ${sense.label ? sense.label + '. ' : ''}${text.length > 90 ? text.slice(0, 90) + '…' : text}`);
      details.append(label);
    });
  });
  return details;
}

function imageChooser(block) {
  const list = el('div', 'images');
  for (const image of block.entry.images) {
    const input = el('input');
    input.type = 'checkbox';
    input.checked = block.selectedImages.includes(image.url);
    input.addEventListener('change', () => {
      block.selectedImages = block.entry.images.map(i => i.url)
        .filter(url => (url === image.url ? input.checked : block.selectedImages.includes(url)));
      changed();
    });
    const img = el('img');
    img.src = image.url;
    img.alt = image.alt || '';
    const label = el('label');
    label.append(img, input, ' ' + (image.caption || 'Image'));
    list.append(label);
  }
  return list;
}

function controlsFor(block) {
  return draft.blocks.includes(block);
}

// ---------- rendering ----------

function refresh() {
  renderPending();
  renderBlocks();
  renderPreview();
  saveDraft();
}

function renderPending() {
  $('#pending').hidden = !pending;
  if (!pending) return;
  const picker = $('#entry-picker');
  picker.hidden = pending.entries.length < 2;
  const severalDictionaries = new Set(pending.entries.map(e => e.dictionary)).size > 1;
  picker.replaceChildren(...pending.entries.map((entry, i) => {
    const pos = entry.groups.map(g => g.partOfSpeech).filter(Boolean).join(', ');
    const option = el('option', '', `${entry.headword}${entry.homograph ? ' (' + entry.homograph + ')' : ''}${pos ? ' — ' + pos : ''}` +
      (severalDictionaries ? ` (${entry.dictionary})` : ''));
    option.value = i;
    return option;
  }));
  picker.value = pending.entries.indexOf(pending.block.entry);
  $('#add-all').hidden = pending.entries.length < 2;
  $('#add-all').textContent = `Add all ${pending.entries.length} entries`;
  $('#pending-editor').replaceChildren(blockEditor(pending.block));
}

function renderBlocks() {
  $('#blocks').replaceChildren(...draft.blocks.map((block, index) => {
    const buttons = [['↑', 'Move up', () => DCC.moveBlock(draft, index, -1)], ['↓', 'Move down', () => DCC.moveBlock(draft, index, 1)], ['✕', 'Remove', () => DCC.removeBlock(draft, index)]]
      .map(([text, title, action]) => {
        const button = el('button', 'secondary small', text);
        button.title = title;
        button.addEventListener('click', () => {
          action();
          refresh();
        });
        return button;
      });
    return blockEditor(block, buttons);
  }));
  if (document.activeElement !== $('#front')) $('#front').value = draft.front;
}

function selectedImageCount() {
  return draft.blocks.reduce((n, b) => n + (b.options.images ? b.selectedImages.length : 0), 0);
}

function renderPreview() {
  const preview = $('#preview');
  if (document.activeElement !== preview) preview.innerHTML = draft.backOverride || DCC.renderBack(draft);
  $('#override-note').hidden = !draft.backOverride;
  $('#image-note').hidden = !selectedImageCount();
}

// ---------- reading the dictionary page ----------

async function readPage() {
  const status = $('#read-status');
  setStatus(status, 'Reading…');
  const result = await DCC.readActiveTab();
  if (!result.ok) {
    setStatus(status, result.error + ' Your card is unchanged. You can still type into the Back.', true);
    return;
  }
  pending = { entries: result.entries, block: DCC.newBlock(result.entries[0]) };
  setStatus(status, result.entries.length > 1 ? `Found ${result.entries.length} entries on this page. Pick one below.` : '');
  renderPending();
}

function addPending() {
  if (!pending) return;
  const { block } = pending;
  if (DCC.isDuplicate(draft, block.entry)) {
    setStatus($('#read-status'), 'This entry is already on the card.', true);
    return;
  }
  DCC.addBlock(draft, block);
  if (draft.backOverride) draft.backOverride += '<hr>' + DCC.renderBlock(block, { showHeadword: true });
  setStatus($('#read-status'), `Added "${block.entry.headword}" to the card.`);
  pending = null;
  refresh();
}

// Adds every entry on the page; the one on screen keeps the choices made for it.
function addAllPending() {
  if (!pending) return;
  let added = 0;
  for (const entry of pending.entries) {
    if (DCC.isDuplicate(draft, entry)) continue;
    const block = entry === pending.block.entry ? pending.block : DCC.newBlock(entry);
    DCC.addBlock(draft, block);
    if (draft.backOverride) draft.backOverride += '<hr>' + DCC.renderBlock(block, { showHeadword: true });
    added++;
  }
  setStatus($('#read-status'), added ? `Added ${added} entr${added > 1 ? 'ies' : 'y'} to the card.` : 'These entries are already on the card.', !added);
  pending = null;
  refresh();
}

// ---------- copying ----------

async function copy(target, html, text) {
  try {
    const kind = await DCC.copyRich(html, text);
    setStatus(target, kind === 'rich' ? 'Copied. Paste it into Anki with Ctrl+V.' : 'Copied as plain text only (formatted copy failed).');
  } catch (err) {
    setStatus(target, 'Copy failed: ' + err.message, true);
  }
}

async function copyBack() {
  if (!draft.blocks.length && !draft.backOverride) return setStatus($('#card-status'), 'The Back is empty.', true);
  const html = draft.backOverride || DCC.renderBack(draft);
  const text = draft.backOverride ? $('#preview').innerText : DCC.renderBackText(draft);
  await copy($('#card-status'), html, text);
}

async function copyFront() {
  try {
    await DCC.copyText(draft.front);
    setStatus($('#card-status'), 'Front copied.');
  } catch (err) {
    setStatus($('#card-status'), 'Copy failed: ' + err.message, true);
  }
}

function copyEntry() {
  if (!pending) return;
  const single = { front: pending.block.entry.headword, blocks: [pending.block] };
  copy($('#read-status'), DCC.renderBack(single), DCC.renderBackText(single));
}

let clearArmed = false;
function newCard() {
  const button = $('#new-card');
  if (!clearArmed) {
    clearArmed = true;
    button.textContent = 'Click again to clear';
    setTimeout(() => {
      clearArmed = false;
      button.textContent = 'New card';
    }, 3000);
    return;
  }
  clearArmed = false;
  button.textContent = 'New card';
  draft = DCC.newDraft();
  setStatus($('#card-status'), 'Started a new card.');
  refresh();
}

// ---------- Anki ----------

async function anki(action, params) {
  const response = await chrome.runtime.sendMessage({ type: 'anki', action, params, key: settings.key || undefined });
  if (!response) throw new Error('The extension background did not answer. Try again.');
  if (!response.ok) throw new Error(response.error);
  return response.result;
}

function fillSelect(select, values, current) {
  select.replaceChildren(...values.map(value => el('option', '', value)));
  if (values.includes(current)) select.value = current;
}

async function loadFields() {
  const fields = await anki('modelFieldNames', { modelName: $('#anki-model').value });
  fillSelect($('#anki-front'), fields, settings.frontField || fields[0]);
  fillSelect($('#anki-back'), fields, settings.backField || fields[1] || fields[0]);
  readAnkiSelects();
}

function readAnkiSelects() {
  settings.deck = $('#anki-deck').value;
  settings.model = $('#anki-model').value;
  settings.frontField = $('#anki-front').value;
  settings.backField = $('#anki-back').value;
  saveSettings();
}

async function connectAnki() {
  const status = $('#anki-status');
  try {
    setStatus(status, 'Connecting… If Anki asks whether to allow this extension, choose Yes.');
    await DCC.ankiAllow(anki, settings.key);
    const [decks, models] = await Promise.all([anki('deckNames'), anki('modelNames')]);
    const deck = settings.deck || DCC.DEFAULT_DECK;
    fillSelect($('#anki-deck'), [...new Set([DCC.DEFAULT_DECK, deck, ...decks])], deck);
    fillSelect($('#anki-model'), models, settings.model);
    await loadFields();
    $('#anki-fields').hidden = false;
    setStatus(status, 'Connected.');
  } catch (err) {
    setStatus(status, err.message, true);
  }
}

async function sendToAnki() {
  const status = $('#card-status');
  if (!draft.front.trim() || (!draft.blocks.length && !draft.backOverride)) {
    return setStatus(status, 'Fill in the Front and add at least one entry first.', true);
  }
  setStatus(status, 'Sending…');
  let response;
  try {
    response = await chrome.runtime.sendMessage({ type: 'upload', draft });
  } catch (err) {
    return setStatus(status, err.message, true);
  }
  if (response && response.ok) {
    const skipped = response.skipped || [];
    setStatus(status, `Added "${draft.front}" to ${response.settings.deck}. The card stays here until you click New card.` +
      (skipped.length ? `\nImages that could not be saved: ${skipped.join('; ')}` : ''), skipped.length > 0);
  } else {
    setStatus(status, (response && response.error) || 'Sending failed.', true);
  }
}

// ---------- wiring ----------

$('#read').addEventListener('click', readPage);
$('#allow-sites').addEventListener('click', async () => {
  const granted = await chrome.permissions.request({ origins: DCC.sites.map(s => s.origin) });
  $('#allow-sites').hidden = granted;
  setStatus($('#read-status'), granted ? 'Done. You no longer need to click the icon on each dictionary page.' : 'Access was not granted.', !granted);
});
$('#entry-picker').addEventListener('change', event => {
  pending.block = DCC.newBlock(pending.entries[Number(event.target.value)]);
  renderPending();
});
$('#add').addEventListener('click', addPending);
$('#add-all').addEventListener('click', addAllPending);
$('#copy-entry').addEventListener('click', copyEntry);
$('#front').addEventListener('input', event => {
  draft.front = event.target.value;
  changed();
});
$('#preview').addEventListener('input', () => {
  draft.backOverride = DCC.sanitizeHtml($('#preview').innerHTML);
  saveDraft();
  $('#override-note').hidden = false;
});
$('#preview').addEventListener('blur', renderPreview);
$('#discard-edits').addEventListener('click', () => {
  draft.backOverride = '';
  changed();
});
$('#copy-front').addEventListener('click', copyFront);
$('#copy-back').addEventListener('click', copyBack);
$('#new-card').addEventListener('click', newCard);
$('#anki-key').addEventListener('change', event => {
  settings.key = event.target.value;
  saveSettings();
});
$('#anki-connect').addEventListener('click', connectAnki);
$('#anki-model').addEventListener('change', () => {
  settings.frontField = settings.backField = '';
  loadFields().catch(err => setStatus($('#anki-status'), err.message, true));
});
for (const id of ['#anki-deck', '#anki-front', '#anki-back']) $(id).addEventListener('change', readAnkiSelects);
$('#anki-send').addEventListener('click', sendToAnki);

// "Create & upload" in the popup replaces the card; show the new one here too.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.ankiSettings) {
    Object.assign(settings, changes.ankiSettings.newValue);
    if ([...$('#anki-deck').options].some(option => option.value === settings.deck)) $('#anki-deck').value = settings.deck;
  }
  if (changes.quickCard) {
    draft = DCC.loadDraft(changes.draft && changes.draft.newValue);
    pending = null;
    setStatus($('#read-status'), '');
    setStatus($('#card-status'), `New card for "${draft.front}" from the toolbar button.`);
    refresh();
  }
});

(async () => {
  const stored = await chrome.storage.local.get(['draft', 'ankiSettings']);
  draft = DCC.loadDraft(stored.draft);
  settings = Object.assign(settings, stored.ankiSettings);
  $('#anki-key').value = settings.key;
  $('#allow-sites').hidden = await chrome.permissions.contains({ origins: DCC.sites.map(s => s.origin) });
  refresh();
})();
