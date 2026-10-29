// Injected into the dictionary tab after parsers/common.js and the site's parser.
(() => {
  const DCC = (globalThis.DCC = globalThis.DCC || {});
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Bigger images are left for Anki to download itself, to keep the saved draft small.
  DCC.MAX_IMAGE_BYTES = 1000000;

  // Fetches an image from the page itself, where the browser already has access to the site.
  // (Some sites refuse the same image when Anki asks for it directly.) Returns base64 data or null.
  DCC.imageData = async function (url, fetchFn = fetch) {
    try {
      const response = await fetchFn(url);
      const type = (response.headers.get('content-type') || '').split(';')[0].trim();
      if (!response.ok || !type.startsWith('image/')) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > DCC.MAX_IMAGE_BYTES) return null;
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { data: btoa(binary), type };
    } catch {
      return null;
    }
  };

  DCC.attachImageData = async function (entries, fetchFn = fetch) {
    for (const entry of entries) {
      for (const image of entry.images) Object.assign(image, await DCC.imageData(image.url, fetchFn));
    }
  };

  // Retries for a few seconds because some pages fill in their entry after loading.
  DCC.extractPage = async function (siteId) {
    const parse = DCC.parsers && DCC.parsers[siteId];
    if (!parse) return { ok: false, error: 'No reader is available for this site.' };
    let lastError = '';
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const entries = parse(document, location.href);
        if (entries.length) {
          await DCC.attachImageData(entries);
          return { ok: true, url: location.href, entries };
        }
      } catch (err) {
        lastError = err.message;
      }
      await sleep(500);
    }
    return {
      ok: false,
      error: lastError
        ? `Reading this page failed (${lastError}).`
        : "Couldn't find a dictionary entry on this page. The site's layout may have changed."
    };
  };
})();
