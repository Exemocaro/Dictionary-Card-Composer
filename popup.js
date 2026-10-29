const $ = selector => document.querySelector(selector);
let tab = null;
let settings = {};
let deckError = ''; // why the deck list couldn't be loaded, shown when the dropdown is used

function setStatus(message, isError = false) {
  $('#status').textContent = message;
  $('#status').classList.toggle('error', isError);
}

const currentDeck = () => settings.deck || DCC.DEFAULT_DECK;

function skippedNote(skipped = []) {
  if (!skipped.length) return '';
  return ` ${skipped.length} image${skipped.length > 1 ? 's' : ''} could not be saved: ${skipped.join('; ')}`;
}

function showDecks(decks) {
  const names = [...new Set([DCC.DEFAULT_DECK, currentDeck(), ...decks])];
  $('#deck').replaceChildren(...names.map(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = `Deck: ${name}` + (name === DCC.DEFAULT_DECK ? ' (default)' : '');
    return option;
  }));
  $('#deck').value = currentDeck();
}

async function anki(action, params) {
  const response = await chrome.runtime.sendMessage({ type: 'anki', action, params, key: settings.key || undefined });
  if (!response || !response.ok) throw new Error((response && response.error) || 'Anki did not answer.');
  return response.result;
}

// Fills the dropdown with the decks in Anki. Without Anki it keeps showing the current deck.
async function loadDecks() {
  try {
    await DCC.ankiAllow(anki, settings.key);
    showDecks(await anki('deckNames'));
    deckError = '';
  } catch (err) {
    deckError = err.message;
  }
}

async function chooseDeck() {
  const { ankiSettings } = await chrome.storage.local.get('ankiSettings');
  settings = { ...ankiSettings, deck: $('#deck').value };
  await chrome.storage.local.set({ ankiSettings: settings });
  setStatus(`New cards will go to ${settings.deck}.`);
}

async function createAndUpload() {
  $('#create').disabled = true;
  try {
    setStatus('Reading the page…');
    const result = await DCC.readActiveTab();
    if (!result.ok) return setStatus(result.error, true);

    // A new word always starts a new card, replacing whatever the side panel showed. It holds every
    // entry on the page: all dictionaries, parts of speech and meanings.
    const draft = DCC.newDraft();
    for (const entry of result.entries) DCC.addBlock(draft, DCC.newBlock(entry));
    await DCC.saveDraft(draft, { quickCard: Date.now() });

    setStatus(`Sending "${draft.front}" to Anki…`);
    const response = await chrome.runtime.sendMessage({ type: 'upload', draft });
    if (response && response.ok) {
      settings = response.settings;
      showDecks([...$('#deck').options].map(option => option.value));
      setStatus(`Added "${draft.front}" to ${settings.deck}.` + skippedNote(response.skipped), Boolean(response.skipped && response.skipped.length));
    } else {
      setStatus(((response && response.error) || 'Sending failed.') + ' The card is in the detailed panel, where you can copy it instead.', true);
    }
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    $('#create').disabled = false;
  }
}

$('#deck').addEventListener('change', chooseDeck);
$('#deck').addEventListener('focus', () => {
  if (deckError) setStatus(`Can't list your Anki decks: ${deckError}`, true);
});
$('#create').addEventListener('click', createAndUpload);
$('#open-panel').addEventListener('click', () => {
  // Called straight from the click: Chrome only opens the side panel in response to one.
  chrome.sidePanel.open({ windowId: tab.windowId }).then(() => window.close());
});

(async () => {
  const stored = await chrome.storage.local.get('ankiSettings');
  settings = stored.ankiSettings || {};
  showDecks([]);
  loadDecks();
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !DCC.siteForUrl(tab.url)) {
    $('#create').disabled = true;
    setStatus('Open an entry in a supported dictionary: ' + DCC.sites.map(s => s.name).join(', ') + '.');
  }
})();
