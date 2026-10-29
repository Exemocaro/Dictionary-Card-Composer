(() => {
  const DCC = (globalThis.DCC = globalThis.DCC || {});

  // Writes HTML and plain text in one item so Anki gets formatting; falls back to plain text.
  DCC.copyRich = async function (html, text) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      })]);
      return 'rich';
    } catch {
      await navigator.clipboard.writeText(text);
      return 'plain';
    }
  };

  DCC.copyText = text => navigator.clipboard.writeText(text);
})();
