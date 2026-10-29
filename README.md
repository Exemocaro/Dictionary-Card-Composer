# Dictionary Card Composer

A Chrome extension that turns dictionary entries into clean Anki cards. On a dictionary page, one click creates the card (Front: the word, Back: everything the dictionary says about it) and adds it to Anki. A detailed panel lets you choose what goes on the card and combine several words or dictionaries.

No account, server, AI service or tracking. Everything runs in your browser and your own Anki.

## Supported dictionaries

| Dictionary | Pages |
| --- | --- |
| Oxford Learner's Dictionaries | `oxfordlearnersdictionaries.com/definition/english/…` and `/american_english/…` |
| Cambridge Dictionary | `dictionary.cambridge.org/dictionary/english/…`, also `/us/…` and translated site sections |
| Merriam-Webster | `merriam-webster.com/dictionary/…` |
| Priberam | `dicionario.priberam.org/…`, also `/pt-pt/…` and `/pt-br/…` |
| Infopédia | `infopedia.pt/dicionarios/lingua-portuguesa/…` |

### What gets saved

Every card has all the meanings on the page and a citation with a link back to the entry. On top of that:

| | Examples | Pronunciation | Etymology | Synonyms | Antonyms | Idioms & expressions | Collocations | Pictures | Inflections |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Oxford | ✓ | ✓ | ✓ | ✓ | – | ✓ | – | – | ✓ |
| Cambridge | ✓ | ✓ | – | ✓ | – | ✓ | ✓ | ✓ | ✓ |
| Merriam-Webster | ✓ | ✓ | ✓ | ✓ | – | ✓ | – | – | ✓ |
| Priberam | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ |
| Infopédia | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | – |

– means the dictionary doesn't show it, or the extension doesn't read it yet. Oxford has etymology on its British English pages only. Cambridge's "related words" count as synonyms, and its pages hold several dictionaries (Advanced Learner's, American, Business), which all go on the card, each with its own citation.

## Use

**One click.** Open an entry, click the extension icon and press **Create & upload card**. The dropdown above the button picks the Anki deck (**Dictionary Cards** until you change it). Each click makes a new card.

**Detailed panel.** Click the icon, then **Open detailed panel**:

1. **Read this page** shows the same entries the one-click button would save. Untick meanings or sections you don't want, or leave out (✕) a whole entry.
2. **Add to card**. Repeat on other words or dictionaries to put them on the same card.
3. Reorder (↑ ↓) or remove (✕) entries, or type straight into the Back.
4. **Send to Anki**, or **Copy Front** / **Copy Back** to paste into Anki yourself. **New card** clears it.

The extension only reads a tab after you click its icon there. **Allow on supported dictionaries** in the panel skips that click on dictionary pages.

### Anki setup

1. Install the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on in desktop Anki, restart Anki and keep it open while you make cards.
2. The first time, Anki asks whether to allow the extension. Choose Yes.
3. Cards use the **Basic** note type (first field = Front, second = Back). Change the deck, note type or fields under **Anki settings** in the detailed panel.

Duplicates (same Front in the same deck) are refused. Pictures are saved into Anki's media folder, so they sync to your other devices. If you paste with **Copy Back** instead, pictures are only web links; Anki keeps formatting with Ctrl+V (or Ctrl+Shift+V if you set Anki to strip formatting on paste).

## Development

```sh
npm install
npm test
```

Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose this folder. Click the extension's reload icon after changing the code. Chrome 116 or newer is required.

```text
manifest.json            Manifest V3
background.js            sends cards to Anki (AnkiConnect)
popup.html/.js/.css      toolbar popup: deck, Create & upload card, Open detailed panel
sidepanel.html/.js/.css  the detailed panel
extract-page.js          runs in the dictionary tab: the parser, plus fetching the entry's pictures
parsers/                 one parser per dictionary, plus shared helpers
lib/                     sites, card model, renderer, sanitizer, clipboard, AnkiConnect
tests/                   node:test tests and trimmed copies of real pages
scripts/                 zip.js builds the store package; try-page.js runs a parser on a saved page
```

Plain JavaScript, no framework and no build step. Each parser turns its page into the same data shape, and the renderer builds fresh, escaped HTML from it, so page HTML never reaches a card. The tests never contact Anki; AnkiConnect is replaced with fakes.

**When a dictionary changes its layout:** save the page from Chrome (**Ctrl+S → "Webpage, Complete"**) into `saved-pages/` (git-ignored), then run the parser on it:

```sh
npm run try -- "saved-pages/cat.html" https://www.merriam-webster.com/dictionary/cat
```

It prints the card as plain text (`--json` prints the extracted data).

**Trying Send to Anki safely:** create a separate Anki profile (*File → Switch Profile → Add*) and switch to it first. AnkiConnect only sees the open profile, so your real decks aren't touched.

## Publishing

`npm run zip` writes `dist/dictionary-card-composer-<version>.zip` with only the files the extension needs. Raise `version` in `manifest.json` before each upload. The store text is in [store-description.md](store-description.md).

For the store's privacy form:

- **Single purpose:** make Anki cards from dictionary entries.
- **Permissions:**
  - `activeTab`: read the dictionary entry in the tab where you clicked the icon.
  - `scripting`: run the page reader in that tab after you click "Create & upload card" or "Read this page".
  - `storage`: keep the card draft and Anki settings on your device.
  - `sidePanel`: show the detailed panel.
  - `clipboardWrite`: copy the Front and Back when you click Copy.
  - Host `http://127.0.0.1:8765`: send cards to the AnkiConnect add-on on your own computer.
  - Optional hosts: the supported dictionary sites, only if you click "Allow on supported dictionaries".
- **Remote code:** none.
- **Privacy policy:** https://github.com/Exemocaro/Dictionary-Card-Composer/blob/main/PRIVACY.md
- **Test instructions for reviewers:** no account needed. Open https://dictionary.cambridge.org/dictionary/english/cat, click the extension icon, then "Open detailed panel" → "Read this page" → "Add to card" → "Copy Back". "Create & upload card" needs desktop Anki with the AnkiConnect add-on.

The extension reads pages only in your browser and doesn't bundle dictionary content.

## License

The code is under the [MIT License](LICENSE). The dictionary excerpts in `tests/fixtures/` belong to their publishers and are not covered by it; they are kept only so the tests can check the parsers.
