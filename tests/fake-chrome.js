// A fake `chrome` API for loading the popup and side panel in jsdom. No browser or Anki involved.
const path = require('path');
const { pathToFileURL } = require('url');
const { JSDOM } = require('jsdom');
const { DCC, loadFixture } = require('./helpers');

const PAGES = {
  'https://dicionario.priberam.org/languidez': ['priberam', 'priberam-languidez.html'],
  'https://dicionario.priberam.org/langor': ['priberam', 'priberam-langor.html'],
  'https://dictionary.cambridge.org/dictionary/english/language': ['cambridge', 'cambridge-language.html'],
  'https://dictionary.cambridge.org/dictionary/english/fare': ['cambridge', 'cambridge-fare.html']
};

const copy = value => JSON.parse(JSON.stringify(value));

// state.tabUrl: the active tab; state.reply(message): what the background answers.
function fakeChrome(state) {
  state.storage = state.storage || {};
  state.messages = [];
  const listeners = [];
  return {
    storage: {
      local: {
        get: async () => copy(state.storage),
        set: async values => {
          const changes = {};
          for (const [key, value] of Object.entries(values)) {
            state.storage[key] = copy(value);
            changes[key] = { newValue: copy(value) };
          }
          for (const listener of listeners) setTimeout(() => listener(changes, 'local'));
        }
      },
      onChanged: { addListener: listener => listeners.push(listener) }
    },
    tabs: { query: async () => [{ id: 7, windowId: 3, url: state.tabUrl }] },
    permissions: { contains: async () => false, request: async () => true },
    sidePanel: { open: async options => { state.openedPanel = options; } },
    runtime: {
      sendMessage: async message => {
        state.messages.push(copy(message));
        return state.reply ? state.reply(message) : { ok: false, error: 'no reply' };
      }
    },
    scripting: {
      executeScript: async ({ files }) => {
        if (files) return [];
        const [siteId, fixture] = PAGES[state.tabUrl];
        const entries = DCC.parsers[siteId](loadFixture(fixture, state.tabUrl), state.tabUrl);
        return [{ result: { ok: true, url: state.tabUrl, entries: copy(entries) } }];
      }
    }
  };
}

async function openPage(file, chrome, state) {
  const full = path.join(__dirname, '..', file);
  const dom = await JSDOM.fromFile(full, {
    url: pathToFileURL(full).href,
    runScripts: 'dangerously',
    resources: 'usable',
    beforeParse(window) {
      window.chrome = chrome;
      window.close = () => { state.closed = true; };
      window.ClipboardItem = class { constructor(items) { this.items = items; } };
      Object.defineProperty(window.navigator, 'clipboard', {
        value: {
          write: async ([item]) => { state.clipboard = Object.keys(item.items); },
          writeText: async text => { state.clipboard = text; }
        }
      });
    }
  });
  await new Promise(resolve => dom.window.addEventListener('load', resolve));
  await new Promise(resolve => setTimeout(resolve, 20)); // let start-up code finish
  return { window: dom.window, $: selector => dom.window.document.querySelector(selector) };
}

async function waitFor(check) {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('timed out waiting');
}

module.exports = { fakeChrome, openPage, waitFor };
