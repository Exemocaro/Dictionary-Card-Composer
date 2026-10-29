// Cleans HTML from the hand-edited Back: simple formatting tags only, no styles, scripts or unsafe links.
(() => {
  const DCC = (globalThis.DCC = globalThis.DCC || {});

  const ALLOWED = {
    A: ['href'], B: [], BR: [], DIV: [], EM: [], HR: [], I: [], IMG: ['src', 'alt'], LI: ['value'],
    OL: ['type', 'start'], P: [], SMALL: [], SPAN: [], STRONG: [], SUB: [], SUP: [], U: [], UL: []
  };
  const DROP = /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|TEMPLATE|NOSCRIPT|SVG|MATH)$/i;
  const MEDIA_NAME = /^[\w.-]+$/;

  DCC.sanitizeHtml = function (html, doc = globalThis.document) {
    const template = doc.createElement('template');
    template.innerHTML = html;
    clean(template.content);
    return template.innerHTML;
  };

  function clean(node) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) continue;
      if (child.nodeType !== 1 || DROP.test(child.tagName)) {
        child.remove();
        continue;
      }
      clean(child);
      const allowed = ALLOWED[child.tagName.toUpperCase()];
      if (!allowed) {
        child.replaceWith(...child.childNodes);
        continue;
      }
      for (const attr of [...child.attributes]) {
        const isLink = attr.name === 'href' || attr.name === 'src';
        const ok = allowed.includes(attr.name) &&
          (!isLink || DCC.safeUrl(attr.value) || (attr.name === 'src' && MEDIA_NAME.test(attr.value)));
        if (!ok) child.removeAttribute(attr.name);
      }
    }
  }
})();
