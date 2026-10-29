# Privacy policy: Dictionary Card Composer

*Last updated: 28 October 2026*

Dictionary Card Composer doesn't collect, sell or share personal data. It has no accounts, analytics, ads or servers of its own.

## What the extension reads

- **Dictionary pages you choose.** When you click "Create & upload card" or "Read this page" on a supported dictionary page, the extension reads that page's entry (headword, meanings, examples, expressions, etymology, citation and pictures) inside your browser. It reads no other pages or tabs.

## What it stores

- **Your card draft** (Front, the entries you added and your choices) and **Send to Anki settings** (deck, note type and field names). These are kept in Chrome's local extension storage on your device, so the draft survives a restart. Click "New card" to clear the draft. Uninstalling the extension removes everything.
- The entry's pictures (up to 1 MB each) are kept with the draft so they can be saved to Anki. If they don't fit in the extension's storage, only their web addresses are kept.

## Network requests

- **Pictures:** when the extension reads an entry, it downloads that entry's pictures from the same dictionary website, from within the page you have open. The side panel also loads them from that website to show a preview.
- **Anki:** when you click "Create & upload card" or "Send to Anki", the extension talks to the AnkiConnect add-on at `http://127.0.0.1:8765`, which is on your own computer. Pictures are handed to Anki directly; a picture that couldn't be read from the page is downloaded by Anki from the dictionary's website instead.
- Nothing is sent to the extension's developer or to any third party.

## Clipboard

The extension writes to your clipboard only when you click a Copy button. It never reads your clipboard.

## Permissions

Chrome permissions are used only for the features above: `activeTab` and `scripting` (read the page you choose), `storage` (draft and settings), `sidePanel` (the composer), `clipboardWrite` (Copy buttons), access to `127.0.0.1:8765` (AnkiConnect on your computer), and optional access to the supported dictionary sites, requested only when you ask for it.

## Contact

Questions or problems: open an issue at https://github.com/Exemocaro/Dictionary-Card-Composer/issues
