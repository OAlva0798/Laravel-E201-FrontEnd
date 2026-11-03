// Allow-list HTML sanitizer for admin-written rich text (Quill output).
// Anything not listed is removed. Scripts, event handlers, styles,
// javascript: links and iframes can never get through.
const TAGS = new Set(["P","BR","STRONG","B","EM","I","U","S","SPAN","DIV","H1","H2","H3","H4","H5","H6",
  "UL","OL","LI","A","BLOCKQUOTE","HR","CODE","PRE","SUB","SUP"]);
const SAFE_HREF = /^(https?:|mailto:|tel:|\/(?!\/)|#)/i;

export function sanitizeHtml(dirty = "") {
  if (!dirty) return "";
  const doc = new DOMParser().parseFromString(`<body>${String(dirty)}</body>`, "text/html");
  const walk = (node) => {
    [...node.childNodes].forEach((el) => {
      if (el.nodeType === 8) return el.remove();            // comments
      if (el.nodeType !== 1) return;                         // text is safe
      if (!TAGS.has(el.tagName)) {
        // drop dangerous containers entirely, unwrap harmless unknown tags
        if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|SVG|MATH|FORM|LINK|META)$/.test(el.tagName)) return el.remove();
        walk(el); el.replaceWith(...el.childNodes); return;
      }
      [...el.attributes].forEach((a) => {
        const n = a.name.toLowerCase();
        const ok = (n === "class" && /^(ql-[\w-]+\s?)+$/.test(a.value)) ||
          (el.tagName === "A" && ((n === "href" && SAFE_HREF.test(a.value.trim())) || n === "target"));
        if (!ok) el.removeAttribute(a.name);
      });
      if (el.tagName === "A") { el.setAttribute("rel", "noopener noreferrer"); el.setAttribute("target", "_blank"); }
      walk(el);
    });
  };
  walk(doc.body);
  return doc.body.innerHTML;
}
