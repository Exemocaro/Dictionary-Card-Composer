// Reads the dictionary entry in the active tab. Used by the popup and the side panel.
(() => {
  const DCC = (globalThis.DCC = globalThis.DCC || {});

  DCC.readActiveTab = async function () {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      return { ok: false, error: 'No access to this tab. Open a supported dictionary entry and click the extension icon on that page.' };
    }
    const site = DCC.siteForUrl(tab.url);
    if (!site) {
      return { ok: false, error: 'This page is not a supported dictionary entry. Supported: ' + DCC.sites.map(s => s.name).join(', ') + '.' };
    }
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['parsers/common.js', site.parser, 'extract-page.js'] });
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: siteId => globalThis.DCC.extractPage(siteId),
        args: [site.id]
      });
      return result || { ok: false, error: 'Reading this page failed.' };
    } catch {
      return { ok: false, error: 'Chrome did not allow reading this tab. Click the extension icon on the dictionary page, then try again.' };
    }
  };
})();
