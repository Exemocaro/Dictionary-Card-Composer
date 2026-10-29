importScripts('lib/render.js', 'lib/ankiconnect.js');

const fromExtensionPage = sender => (sender.url || '').startsWith(chrome.runtime.getURL(''));
const reply = (promise, sendResponse) => {
  promise.then(value => sendResponse({ ok: true, ...value }), err => sendResponse({ ok: false, error: err.message }));
  return true;
};

// Anki requests run here so they finish even if the popup or side panel closes.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!fromExtensionPage(sender)) return false;
  if (message.type === 'anki') {
    return reply(DCC.ankiInvoke(message.action, message.params).then(result => ({ result })), sendResponse);
  }
  if (message.type === 'upload') return reply(upload(message.draft), sendResponse);
  return false;
});

// Returns { settings, skipped }: the deck and fields used, and any images Anki couldn't save.
async function upload(draft) {
  const { ankiSettings = {} } = await chrome.storage.local.get('ankiSettings');
  const result = await DCC.uploadDraft(DCC.ankiInvoke, ankiSettings, draft);
  await chrome.storage.local.set({ ankiSettings: result.settings });
  return result;
}
