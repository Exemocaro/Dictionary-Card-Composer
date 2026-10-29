const $ = selector => document.querySelector(selector);

let draft = DCC.newDraft();
let settings = { deck: '', model: '', frontField: '', backField: '' };
let pending = null; // { blocks } read from the current page, not yet on the card
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
  details.open = expanded.has(block.id);
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

// ---------- rendering ----------

function refresh() {
  renderPending();
  renderBlocks();
  renderPreview();
  saveDraft();
}

// Every entry read from the page, as Create & upload would save them; each can be left out.
function renderPending() {
  $('#pending').hidden = !pending;
  if (!pending) return;
  $('#pending-editor').replaceChildren(...pending.blocks.map((block, index) => {
    const leaveOut = el('button', 'secondary small', '✕');
    leaveOut.title = 'Leave out';
    leaveOut.addEventListener('click', () => {
      pending.blocks.splice(index, 1);
      if (!pending.blocks.length) pending = null;
      renderPending();
    });
    const editor = blockEditor(block, [leaveOut]);
    const pos = block.entry.groups.map(g => g.partOfSpeech).filter(Boolean).join(', ');
    editor.querySelector('.grow').append(el('div', 'muted', [pos, block.entry.dictionary].filter(Boolean).join(' · ')));
    return editor;
  }));
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
  pending = { blocks: result.entries.map(DCC.newBlock) };
  if (pending.blocks.length === 1) expanded.add(pending.blocks[0].id);
  setStatus(status, pending.blocks.length > 1
    ? `Found ${pending.blocks.length} entries on this page. Untick meanings or leave out (✕) what you don't want.`
    : '');
  renderPending();
}

function addPending() {
  if (!pending) return;
  let added = 0;
  for (const block of pending.blocks) {
    if (DCC.isDuplicate(draft, block.entry)) continue;
    DCC.addBlock(draft, block);
    if (draft.backOverride) draft.backOverride += '<hr>' + DCC.renderBlock(block, { showHeadword: true });
    added++;
  }
  if (!added) return setStatus($('#read-status'), 'This is already on the card.', true);
  setStatus($('#read-status'), `Added "${pending.blocks[0].entry.headword}" to the card.`);
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
  const page = { front: pending.blocks[0].entry.headword, blocks: pending.blocks };
  copy($('#read-status'), DCC.renderBack(page), DCC.renderBackText(page));
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
  const response = await chrome.runtime.sendMessage({ type: 'anki', action, params });
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
    await DCC.ankiAllow(anki);
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
$('#add').addEventListener('click', addPending);
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
  $('#allow-sites').hidden = await chrome.permissions.contains({ origins: DCC.sites.map(s => s.origin) });
  refresh();
})();
