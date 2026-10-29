# Chrome Web Store listing

Text to paste into the Chrome Web Store Developer Dashboard. The store shows the description as plain text (no markdown), so copy what is inside the box.

**Name:** Dictionary Card Composer

**Summary:** comes from `description` in `manifest.json` (132 characters at most):

> Make Anki cards from Oxford, Cambridge, Merriam-Webster, Priberam and Infopédia entries in one click, or compose them in detail.

**Category:** Education

**Description:**

```text
Turn dictionary entries into clean Anki cards in one click.

Open a word in a supported dictionary, click the extension and press "Create & upload card". The card gets the word on the Front and everything the dictionary says about it on the Back, and goes straight into your Anki deck.

SUPPORTED DICTIONARIES
• Oxford Learner's Dictionaries
• Cambridge Dictionary
• Merriam-Webster
• Priberam (Portuguese)
• Infopédia (Portuguese)

WHAT GOES ON THE CARD
• Every meaning, numbered as in the dictionary
• Examples, pronunciation and etymology
• Synonyms and antonyms
• Idioms, expressions and collocations
• Pictures, saved into Anki so they sync to your other devices
• A citation with a link back to the entry

MORE CONTROL WHEN YOU WANT IT
The detailed panel lets you untick meanings, combine several words or dictionaries on one card, edit the result, or copy it and paste it into Anki yourself.

GOOD TO KNOW
• Sending cards needs desktop Anki with the free AnkiConnect add-on. Copying works without it.
• Cards go to a "Dictionary Cards" deck, or any deck you choose.
• Simple formatting that looks right in Anki's dark mode.

PRIVACY
No account, no tracking, no servers. The extension reads only the dictionary page you click it on, and sends cards only to Anki on your own computer.

Open source (MIT): https://github.com/Exemocaro/Dictionary-Card-Composer

Not affiliated with Anki or with any of the dictionaries.
```

# Privacy tab

Answers for the Privacy tab of the dashboard. Each box fits the form's character limit.

**Single purpose description:**

```text
Makes Anki flashcards from dictionary entries. On a supported dictionary page (Oxford Learner's, Cambridge, Merriam-Webster, Priberam, Infopédia), the user clicks the extension to turn the entry into a card: the word on the front and its meanings, examples and related information on the back. The card is sent to the user's own desktop Anki through the AnkiConnect add-on, or copied to paste into Anki.
```

**activeTab justification:**

```text
Lets the extension read the dictionary entry in the tab where the user clicked its toolbar icon, and only that tab. It is used when the user presses "Create & upload card" or "Read this page". No other tabs or pages are accessed.
```

**scripting justification:**

```text
Runs the extension's own bundled page reader in the dictionary tab the user clicked on, to extract the entry's text (headword, meanings, examples, etymology) and its pictures. It runs only after the user presses "Create & upload card" or "Read this page", and only on the supported dictionary sites.
```

**storage justification:**

```text
Keeps the card the user is building (so it survives a browser restart) and the user's Anki settings (deck, note type and field names) in chrome.storage.local on the user's device. Nothing is synced or sent anywhere.
```

**sidePanel justification:**

```text
Shows the detailed card editor in Chrome's side panel, where the user picks meanings, combines several words on one card, edits the result and sends or copies it. It stays open while the user moves between dictionary pages.
```

**clipboardWrite justification:**

```text
Copies the card's front and back to the clipboard when the user clicks the "Copy Front" or "Copy Back" buttons, so it can be pasted into Anki without the AnkiConnect add-on. The extension never reads the clipboard.
```

**Host permission justification:**

```text
http://127.0.0.1:8765/* is the AnkiConnect add-on running inside desktop Anki on the user's own computer (a loopback address, never the internet). The extension sends the finished card there so it is added to the user's Anki deck. The supported dictionary sites (oxfordlearnersdictionaries.com, dictionary.cambridge.org, merriam-webster.com, dicionario.priberam.org, infopedia.pt) are optional permissions, requested only if the user clicks "Allow on supported dictionaries" so they don't have to click the toolbar icon on each page.
```

**Are you using remote code?** No, I am not using remote code. All code is in the package.

**What user data do you plan to collect?** Tick **Website content** only. The extension reads the text and pictures of the dictionary page you click on, keeps them in the draft on your device and sends them to your own Anki. The store's FAQ says data handled only on the user's device must still be declared. Nothing else applies: there are no accounts, no tracking of pages or clicks, and no data leaves the computer.

**Certify all three disclosures:** yes, all three are true.

**Privacy policy URL:**

```text
https://github.com/Exemocaro/Dictionary-Card-Composer/blob/main/PRIVACY.md
```

# Test instructions

**Username / Password:** leave empty (no login).

**Additional instructions:**

```text
No account needed. 1) Open https://dictionary.cambridge.org/dictionary/english/cat 2) Click the extension icon, then "Open detailed panel" and "Read this page". 3) Click "Add to card", then "Copy Back" and paste into any rich-text editor. "Create & upload card" sends the card to desktop Anki: it needs Anki running with the free AnkiConnect add-on (ankiweb.net/shared/info/2055492159). Without it, the extension shows an error and keeps the card in the panel.
```
