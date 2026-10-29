# Dictionary Card Composer

A Chrome extension that turns dictionary entries into clean, consistently formatted Anki cards.
On a dictionary page, one click creates the card (Front: the word, Back: its meanings) and adds it
to Anki. For more control, a side panel lets you pick meanings and sections, combine several words
or dictionaries on one card, and copy or send the result.

Supported dictionaries:

| Dictionary | Pages | Status |
| --- | --- | --- |
| Priberam | `https://dicionario.priberam.org/<word>`, also under `/pt-pt/` and `/pt-br/` | Tested against current pages |
| Oxford Learner's Dictionaries | `/definition/english/…` and `/definition/american_english/…` | Tested against current pages |
| Cambridge Dictionary | `https://dictionary.cambridge.org/dictionary/english/<word>`, also `/us/…` and translated site sections | Tested against current pages |
| Merriam-Webster | `https://www.merriam-webster.com/dictionary/<word>` | Tested against pages saved from a browser |
| Infopédia | `https://www.infopedia.pt/dicionarios/lingua-portuguesa/<word>` | Tested against a page saved from a browser |

Merriam-Webster and Infopédia block automated downloads, so they were checked with pages saved from
a browser (see [Testing a dictionary page](#testing-a-dictionary-page)). Do the same if a site changes
its layout and an entry stops reading.

No account, server, AI service or tracking is involved. Everything runs in your browser.

## Install for development

1. Run `npm install` once (only needed for the tests).
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose this folder.
3. Pin the extension. After you edit the code, click the reload icon on its card.

Chrome 116 or newer is required.

## Use

### One click

Open a supported dictionary entry, click the extension icon, then **Create & upload card**. The card
gets the word as its Front. The Back gets everything the page has for that word: every entry and part of
speech (Cambridge's guide words such as *noun (PAYMENT)* and *noun (FOOD)* included), all meanings and
examples, idioms and expressions (*aqui há gato*, *let the cat out of the bag*…), synonyms/antonyms,
etymology, pronunciation, inflections, pictures and the citation. Cambridge pages show several dictionaries
(Advanced Learner's, American, Business): all of them go on the card, each separated and cited, along with
its "SMART Vocabulary" related words and its "Collocations with …" (each with its example and source).
Merriam-Webster's "Examples of … in a Sentence" keep that heading. Pictures always come first, right
under the word. Pictures are fetched by the browser from the
page itself and handed to Anki, so sites that refuse direct downloads still work. It goes straight to Anki
(see [Anki setup](#anki-setup)). Each click starts a new card, which also replaces whatever the
detailed panel was showing. If Anki isn't reachable, the card is still in the panel, ready to copy.

The deck dropdown above the button shows where the card will go: **Dictionary Cards** unless you
change it. The extension creates that deck the first time. To use another deck, pick it from the dropdown
(it lists your Anki decks while Anki is open). Your choice stays until you change it again.

### Detailed panel

1. Click the extension icon, then **Open detailed panel**.
2. Click **Read this page**. Choose the entry if the page has several (homographs), tick the meanings
   you want and the optional sections (pronunciation, examples, etymology, synonyms, inflections,
   expressions, related words, images, citation).
3. Click **Add to card**, or **Add all N entries** to take every entry on the page (all dictionaries). The first entry fills in
   the Front. Later entries never change it.
4. Open another dictionary or a related word, click the icon again, then **Read this page** → **Add to card**.
   Each entry becomes its own block on the same Back, with its own citation.
5. Reorder (↑ ↓) or remove (✕) blocks, and change meanings or sections in each block.
   You can also type straight into the Back preview. Your edits are kept until you discard them.
6. Click **Send to Anki**, or **Copy Front** and **Copy Back** to paste into Anki's fields yourself.
7. Click **New card** (twice, to confirm) when you're done. The draft survives browser restarts until then.

**Copy this entry** copies a single entry without adding it to the card.

The extension only reads a tab after you click its icon there. To skip that click on every page, use
**Allow on supported dictionaries**. It asks Chrome for access to the supported dictionary sites only.

### Pasting into Anki

Anki keeps formatting when you paste with Ctrl+V. If you turned on *Preferences → Editing → Paste without
shift key strips formatting*, paste with Ctrl+Shift+V instead. Each copy fills one field. A single paste
can't fill both Front and Back.

The card uses only simple tags (`b`, `i`, `p`, `ol`, `li`, `a`, `hr`, `img`, `small`) and no colours,
so it looks right in Anki's dark mode.

### Anki setup

1. Install the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on in desktop Anki and restart Anki.
   Keep Anki open while you make cards.
2. The first time you send a card, Anki asks whether to allow the extension. Choose Yes.
3. Cards go to the **Dictionary Cards** deck with the **Basic** note type (first field = Front, second = Back).
   Change the deck with the dropdown in the popup. Change the deck, note type or fields under **Anki settings**
   in the detailed panel. Your choices are remembered.

Duplicates (same Front in the same deck) are refused before anything is saved.

Selected images are saved into Anki's media folder (Anki downloads them itself) and the note refers to the
saved files, so they sync to your other devices. Copy Back can only paste images as web links, which Anki
may not keep. For reliable images, use Send to Anki or save the image and attach it yourself.

You don't need to change AnkiConnect's security settings or expose it to your network.

## Development

```text
manifest.json          Manifest V3
background.js          sends cards to Anki (AnkiConnect requests)
popup.html/.js/.css    toolbar popup: Create & upload card, Open detailed panel
sidepanel.html/.js/.css  the detailed card composer
extract-page.js        injected into the dictionary tab; runs the parser
parsers/               one parser per dictionary, plus shared helpers
lib/                   sites, draft model, renderer, sanitizer, clipboard, AnkiConnect
icons/
tests/                 node:test tests and trimmed HTML fixtures
scripts/zip.js         builds the store package
scripts/try-page.js    runs a parser on a page you saved
```

Plain JavaScript, no framework and no build step. Every parser turns the page into the same
data shape. The renderer builds fresh, escaped HTML from that data, so page HTML never reaches
the card.

### Tests

```sh
npm install
npm test
```

The tests use trimmed copies of real pages from all five dictionaries (`tests/fixtures/`). The popup
and side panel are loaded in jsdom with a fake `chrome` API. Nothing contacts Anki: AnkiConnect is
replaced with fakes.

### Testing a dictionary page

To check a parser against the live site without publishing anything:

1. Open the entry in Chrome and save it with **Ctrl+S → "Webpage, Complete"** into a `saved-pages/`
   folder in this repo. That folder is git-ignored, because full pages are the publisher's content.
2. Run the matching parser on it:

   ```sh
   npm run try -- saved-pages/language.html https://www.merriam-webster.com/dictionary/language
   ```

   It prints the card Back as plain text (`--json` prints the extracted data). "No entries found"
   means the selectors don't match the page.

Then do a real run: load the unpacked extension, open a few entries on each site, click **Read this page**,
and paste the result into Anki (see below).

### Trying Send to Anki without touching your real collection

Create a separate Anki profile (*File → Switch Profile → Add*, e.g. "Test") and switch to it before
sending anything. AnkiConnect only sees the open profile, so your real decks are never touched.
Don't log in to AnkiWeb in that profile, so nothing syncs. Delete the profile when you're done.

Things to check by hand: pasting into Anki, numbering, dark mode, a long Back built from several blocks,
and images after closing the browser and syncing to another device.

## Packaging and publishing

```sh
npm run zip
```

This writes `dist/dictionary-card-composer-<version>.zip` with `manifest.json` at its root and only the
files the extension needs: no tests, fixtures or scripts. Bump `version` in `manifest.json` for every upload.

Notes for the Chrome Web Store listing:

- **Single purpose:** make Anki cards from dictionary entries.
- **Permissions:**
  - `activeTab`: read the dictionary entry in the tab where you clicked the icon.
  - `scripting`: run the page reader in that tab after you click "Create & upload card" or "Read this page".
  - `storage`: keep the card draft and Anki settings on your device.
  - `sidePanel`: show the detailed card composer.
  - `clipboardWrite`: copy the Front and Back when you click Copy.
  - Host `http://127.0.0.1:8765`: send cards to the AnkiConnect add-on on your own computer. Nothing leaves the device.
  - Optional hosts: the supported dictionary sites, only if you click "Allow on supported dictionaries".
- **Remote code:** none. All code ships in the package.
- **Privacy policy:** [PRIVACY.md](PRIVACY.md).
- **Test instructions for reviewers:** no account needed. Open
  https://dicionario.priberam.org/acrisolado, https://www.oxfordlearnersdictionaries.com/definition/english/language
  or https://dictionary.cambridge.org/dictionary/english/language, click the extension icon, then
  "Open detailed panel" → "Read this page" → "Add to card" → "Copy Back". "Create & upload card" needs
  desktop Anki with the AnkiConnect add-on.

The extension reads pages only in your own browser and doesn't bundle dictionary content. Attribution
isn't a licence, so check each publisher's terms before publishing. The test fixtures are short excerpts
kept for regression tests.

## License

The code is under the [MIT License](LICENSE). The dictionary excerpts in `tests/fixtures/` belong to
their publishers and are not covered by it; they are kept only so the tests can check the parsers.
