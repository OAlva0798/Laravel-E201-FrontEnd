import { jsPDF } from "jspdf";
import gothicRegular from "../../assets/fonts/GOTHIC.TTF";
import gothicBold from "../../assets/fonts/GOTHICB.TTF";
import gothicItalic from "../../assets/fonts/GOTHICI.TTF";
import gothicBoldItalic from "../../assets/fonts/GOTHICBI.TTF";
import { API_BASE_URL } from "../../assets/js/appConfig";
import { PAGE, LETTER, LOGO_URL, BADGE_URL, getFooterMetrics, buildCertificate } from "./coeLayout";

/* ============================================================================
   The PDF is drawn from the SAME measurements and wording as the live preview
   (see coeLayout.js). To change how the certificate looks, edit coeLayout.js
   (PAGE / LETTER / buildCertificate) and both the preview and the PDF follow.
============================================================================ */

/* ============================================================================
   1. IMAGE LOADER
============================================================================ */

const loadImage = (() => {
  const cache = new Map();

  const drawToPng = (img) => {
    const width = img.naturalWidth || img.width || 400;
    const height = img.naturalHeight || img.height || 400;
    const scale = Math.min(1, 1600 / Math.max(width, height));

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext("2d");
    if (!context) return null;

    try {
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      return { dataUrl: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height };
    } catch (error) {
      console.error("Image conversion failed:", error);
      return null;
    }
  };

  const fromElement = (src, crossOrigin = true) =>
    new Promise((resolve) => {
      const img = new Image();
      if (crossOrigin) img.crossOrigin = "anonymous";
      img.onload = () => resolve(drawToPng(img));
      img.onerror = () => resolve(null);
      img.src = src;
    });

  const loadCandidate = async (url) => {
    if (!url) return null;
    if (/^data:image\//i.test(url)) return fromElement(url, false);

    for (const credentials of ["omit", "include"]) {
      try {
        const response = await fetch(url, { credentials });
        if (!response.ok) continue;

        const blob = await response.blob();
        if (!blob.type.startsWith("image/")) continue;

        const objectUrl = URL.createObjectURL(blob);
        try {
          const result = await fromElement(objectUrl, false);
          if (result) return result;
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      } catch {
        // Try the next loading method.
      }
    }
    return fromElement(url, true);
  };

  const candidatesFor = (value) => {
    if (!value) return [];
    const url = String(value).trim();
    const candidates = [url];

    if (!/^(https?:|data:|blob:|\/\/)/i.test(url)) {
      const path = url.startsWith("/") ? url : `/${url}`;
      candidates.push(path);
      if (typeof window !== "undefined") candidates.push(`${window.location.origin}${path}`);
      const base = String(API_BASE_URL || "").replace(/\/+$/, "");
      if (base) candidates.push(`${base}/${url.replace(/^\/+/, "")}`);
    }
    return [...new Set(candidates)];
  };

  return (url) => {
    if (!url) return Promise.resolve(null);
    if (cache.has(url)) return cache.get(url);

    const promise = (async () => {
      for (const candidate of candidatesFor(url)) {
        const result = await loadCandidate(candidate);
        if (result) return result;
      }
      console.warn("Image could not be loaded:", url);
      return null;
    })();

    cache.set(url, promise);
    promise.then((result) => {
      if (!result) cache.delete(url);
    });
    return promise;
  };
})();

/* ============================================================================
   2. FONT LOADER
============================================================================ */

const FONT_FAMILY = "CenturyGothic";
const FONT_FALLBACK = "helvetica";

const FONT_FILES = [
  { url: gothicRegular, name: "GOTHIC.TTF", style: "normal" },
  { url: gothicBold, name: "GOTHICB.TTF", style: "bold" },
  { url: gothicItalic, name: "GOTHICI.TTF", style: "italic" },
  { url: gothicBoldItalic, name: "GOTHICBI.TTF", style: "bolditalic" },
];

const fontCache = new Map();

const toBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

const loadFontFile = (file) => {
  if (!fontCache.has(file.url)) {
    const promise = fetch(file.url)
      .then((response) => {
        if (!response.ok) throw new Error(`Font request failed: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(toBase64)
      .catch((error) => {
        console.error(`Font loading failed: ${file.name}`, error);
        return null;
      });

    fontCache.set(file.url, promise);
    promise.then((result) => {
      if (!result) fontCache.delete(file.url);
    });
  }
  return fontCache.get(file.url);
};

const registerFont = async (doc) => {
  const loaded = await Promise.all(FONT_FILES.map(loadFontFile));

  if (loaded.some((font) => !font)) {
    console.warn("Century Gothic unavailable. Using Helvetica.");
    doc.fontMissing = true;
    return FONT_FALLBACK;
  }

  FONT_FILES.forEach((file, index) => {
    doc.addFileToVFS(file.name, loaded[index]);
    doc.addFont(file.name, FONT_FAMILY, file.style);
  });

  doc.fontMissing = false;
  return FONT_FAMILY;
};

/* ============================================================================
   3. UNIT HELPERS (preview px @ 96 dpi  ->  PDF mm / pt)
============================================================================ */

const mm = (px) => (px * 25.4) / 96;
const pt = (px) => px * 0.75;

const rgb = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * jsPDF draws text from its baseline; the browser centres text in its line box.
 * This returns the baseline (mm) for text of `sizePx` inside a line box that
 * starts at `top` (mm) and is `lineH` (mm) tall.
 */
const baseline = (top, lineH, sizePx, k = 0.39) => top + lineH / 2 + k * mm(sizePx);
const TIMES_K = 0.34;

/* ============================================================================
   4. CONTEXT
============================================================================ */

const createContext = (doc, FONT) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const footer = getFooterMetrics();

  return {
    doc,
    FONT,
    pageWidth,
    left: mm(PAGE.marginX),
    right: pageWidth - mm(PAGE.marginX),
    contentWidth: pageWidth - 2 * mm(PAGE.marginX),
    bottomLimit: mm(footer.top - PAGE.paragraphGap),
    lineHeight: mm(PAGE.bodySize * PAGE.lineHeight),
    y: 0,
  };
};

const setFont = (ctx, style = "normal", sizePx = PAGE.bodySize, hex = PAGE.colors.ink, family) => {
  ctx.doc.setFont(family || ctx.FONT, style);
  ctx.doc.setFontSize(pt(sizePx));
  ctx.doc.setTextColor(...rgb(hex));
};

const newPageIfNeeded = (ctx, height = 0) => {
  if (ctx.y + height > ctx.bottomLimit) {
    ctx.doc.addPage();
    ctx.y = mm(PAGE.continueTop);
  }
};

/* ============================================================================
   5. HEADER (letterhead logo image + rule + title)
============================================================================ */

const renderHeader = (ctx, logo) => {
  const { doc, FONT, pageWidth } = ctx;
  const top = mm(PAGE.marginTop);

  // The logo image already contains the school name and address.
  let logoH = mm(PAGE.logoHeight);
  let logoW = logo ? (logoH * logo.w) / logo.h : 0;
  if (logo && logoW > ctx.contentWidth) {
    logoW = ctx.contentWidth;
    logoH = (logoW * logo.h) / logo.w;
  }
  const rowH = logo ? logoH : mm(PAGE.logoHeight);

  if (logo) {
    try {
      doc.addImage(logo.dataUrl, "PNG", ctx.left + (ctx.contentWidth - logoW) / 2, top, logoW, logoH);
    } catch (error) {
      console.error("Logo rendering failed:", error);
      doc.logoMissing = true;
    }
  }

  // Rule under the header
  const ruleTop = top + rowH + mm(PAGE.headerPadBottom);
  doc.setDrawColor(...rgb(PAGE.colors.headerRule));
  doc.setLineWidth(mm(PAGE.headerRule));

  // Rule under the header
  // doc.line(ctx.left, ruleTop + mm(PAGE.headerRule) / 2, ctx.right, ruleTop + mm(PAGE.headerRule) / 2);
  // Title
  const titleTop = ruleTop + mm(PAGE.headerRule + PAGE.bodyPadTop);
  const titleLH = mm(PAGE.titleSize * PAGE.titleLineHeight);
  const spacing = mm(PAGE.titleSize * PAGE.titleSpacing);
  setFont(ctx, "bold", PAGE.titleSize);
  // CSS letter-spacing also adds space after the last letter, so centre including it
  const titleW = doc.getTextWidth(LETTER.title) + spacing * LETTER.title.length;
  const titleX = pageWidth / 2 - titleW / 2;
  const titleBaseline = baseline(titleTop, titleLH, PAGE.titleSize);

  doc.text(LETTER.title, titleX, titleBaseline, {
    charSpace: spacing,
  });
  
  // Underline
  const underlineOffset = mm(PAGE.titleSize * PAGE.titleUnderlineOffset);
  const underlineThickness = mm(PAGE.titleSize * PAGE.titleUnderlineThickness);
  const underlineY = titleBaseline + underlineOffset;
  const underlineW = titleW - spacing; // drop trailing letter-spacing

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(underlineThickness);
  doc.line(titleX, underlineY, titleX + underlineW, underlineY);

  ctx.y = titleTop + titleLH + mm(PAGE.titleMarginBottom);
};

/* ============================================================================
   6. BODY: justified rich paragraph
============================================================================ */

const renderRichParagraph = (ctx, segments) => {
  const { doc, FONT, contentWidth, left, lineHeight } = ctx;
  const tokens = [];
  let pendingSpace = false;

  segments.forEach((segment) => {
    const style = segment.type === "bold" || segment.type === "value" ? "bold" : "normal";
    const words = String(segment.text || "").match(/\s+|\S+/g) || [];

    words.forEach((part) => {
      if (/^\s+$/.test(part)) {
        pendingSpace = true;
        return;
      }
      setFont(ctx, style);
      tokens.push({
        text: part,
        style,
        width: doc.getTextWidth(part),
        spaceBefore: pendingSpace && tokens.length > 0,
      });
      pendingSpace = false;
    });
  });

  // Words joined without a space (e.g. "Name" + ".") stay together
  const chunks = [];
  tokens.forEach((token) => {
    if (!chunks.length || token.spaceBefore) {
      chunks.push({ tokens: [token], width: token.width });
    } else {
      const current = chunks[chunks.length - 1];
      current.tokens.push(token);
      current.width += token.width;
    }
  });

  setFont(ctx, "normal");
  const spaceW = doc.getTextWidth(" ");

  const lines = [];
  let line = [];
  let lineW = 0;
  chunks.forEach((chunk) => {
    const next = line.length ? lineW + spaceW + chunk.width : chunk.width;
    if (line.length && next > contentWidth) {
      lines.push(line);
      line = [chunk];
      lineW = chunk.width;
    } else {
      line.push(chunk);
      lineW = next;
    }
  });
  if (line.length) lines.push(line);

  lines.forEach((words, index) => {
    newPageIfNeeded(ctx, lineHeight);

    const isLast = index === lines.length - 1;
    const used = words.reduce((sum, c) => sum + c.width, 0);
    const gapW = !isLast && words.length > 1 ? Math.max(spaceW, (contentWidth - used) / (words.length - 1)) : spaceW;
    const y = baseline(ctx.y, lineHeight, PAGE.bodySize);

    let x = left;
    words.forEach((chunk, i) => {
      if (i > 0) x += gapW;
      chunk.tokens.forEach((token) => {
        setFont(ctx, token.style);
        doc.text(token.text, x, y);
        x += token.width;
      });
    });

    ctx.y += lineHeight;
  });
};

/* ============================================================================
   7. BODY: employment history table (two equal columns, like the preview)
============================================================================ */

const renderHistoryTable = (ctx, rows) => {
  const { doc, FONT, pageWidth } = ctx;
  const lh = mm(PAGE.bodySize * PAGE.tableLineHeight);
  const colGap = mm(PAGE.tableColumnGap);
  const rowGap = mm(PAGE.tableRowGap);
  const colW = (ctx.contentWidth - colGap) / 2;
  const x1 = ctx.left;
  const x2 = x1 + colW + colGap;

  const draw = (lines, x, style, startLine) => {
    setFont(ctx, style);
    lines.forEach((text, i) => doc.text(text, x, baseline(ctx.y + (startLine + i) * lh, lh, PAGE.bodySize)));
  };

  newPageIfNeeded(ctx, lh);
  draw(["Inclusive Dates"], x1, "bold", 0);
  draw(["Position"], x2, "bold", 0);
  ctx.y += lh;

  rows.forEach((row) => {
    setFont(ctx, "normal");
    const dateLines = doc.splitTextToSize(row.dates, colW);
    setFont(ctx, "bold");
    const positionLines = doc.splitTextToSize(row.position, colW);
    setFont(ctx, "normal");
    const departmentLines = row.department ? doc.splitTextToSize(row.department, colW) : [];

    const lineCount = Math.max(dateLines.length, positionLines.length + departmentLines.length);
    const rowHeight = lineCount * lh;

    newPageIfNeeded(ctx, rowGap + rowHeight);
    ctx.y += rowGap;

    draw(dateLines, x1, "normal", 0);
    draw(positionLines, x2, "bold", 0);
    draw(departmentLines, x2, "normal", positionLines.length);

    ctx.y += rowHeight;
  });
};

/* ============================================================================
   8. BODY: signatory
============================================================================ */

const renderSignatory = (ctx, cert) => {
  const { doc, left } = ctx;
  const lh = mm(PAGE.bodySize * PAGE.signatoryLineHeight);

  ctx.y += mm(PAGE.signatoryGap);
  newPageIfNeeded(ctx, lh * 2);

  setFont(ctx, "bold");
  doc.text(cert.signatory || "Authorized Signatory", left, baseline(ctx.y, lh, PAGE.bodySize));

  setFont(ctx, "normal");
  doc.text(cert.designation || "Authorized Signatory", left, baseline(ctx.y + lh, lh, PAGE.bodySize));

  ctx.y += lh * 2;
};

/* ============================================================================
   9. BODY: order of blocks (same order and spacing as the preview)
============================================================================ */

const renderBody = (ctx, cert) => {
  const gap = mm(PAGE.paragraphGap);
  let first = true;

  const block = (draw) => {
    if (!first) ctx.y += gap;
    first = false;
    draw();
  };

  block(() => renderRichParagraph(ctx, cert.intro));
  if (cert.table) block(() => renderHistoryTable(ctx, cert.table));
  if (cert.details) block(() => renderRichParagraph(ctx, cert.details));
  block(() => renderRichParagraph(ctx, cert.purpose));
  if (cert.remarks) block(() => renderRichParagraph(ctx, cert.remarks));
  block(() => renderRichParagraph(ctx, cert.issued));

  renderSignatory(ctx, cert);
};

/* ============================================================================
   10. FOOTER
============================================================================ */

const renderFooter = (ctx, badge, { showSeal, page, total }) => {
  const { doc, FONT } = ctx;
  const f = getFooterMetrics();
  const lineH = mm(PAGE.footerSize * PAGE.footerLineHeight);
  const noteLH = mm(PAGE.footerNoteSize * PAGE.footerLineHeight);

  // "(not valid without company seal)" - last page only
  if (showSeal) {
    setFont(ctx, "normal", PAGE.footerNoteSize);
    doc.text(
      LETTER.sealNote,
      ctx.right,
      baseline(mm(f.top), mm(f.sealHeight), PAGE.footerNoteSize),
      { align: "right" }
    );
  }

  // Rule
  const ruleTop = mm(f.top + f.sealHeight + PAGE.footerGap);
  doc.setDrawColor(...rgb(PAGE.colors.footerRule));
  doc.setLineWidth(mm(PAGE.footerRule));
  // doc.line(ctx.left, ruleTop + mm(PAGE.footerRule) / 2, ctx.right, ruleTop + mm(PAGE.footerRule) / 2);

  // Contact lines
  const contentTop = ruleTop + mm(PAGE.footerRule + PAGE.footerGap);
  const textTop = contentTop + (mm(f.contentHeight) - mm(f.textHeight)) / 2;
  const [tel, manila] = LETTER.contacts;

  const runs = (items, top) => {
    let x = ctx.left;
    const y = baseline(top, lineH, PAGE.footerSize);
    items.forEach(([text, bold]) => {
      setFont(ctx, bold ? "bold" : "normal", PAGE.footerSize, PAGE.colors.footer);
      doc.text(text, x, y);
      x += doc.getTextWidth(text);
    });
  };

  runs(
    [
      [tel[0], true],
      [` ${tel[1]}`, false],
      [manila[0], true],
      [` ${manila[1]}`, false],
    ],
    textTop
  );
  runs(
    [
      ["E-mail Address:", true],
      [` ${LETTER.email}`, false],
    ],
    textTop + lineH
  );
  runs(
    [
      ["Website:", true],
      [` ${LETTER.website}`, false],
    ],
    textTop + lineH * 2
  );

  setFont(ctx, "normal", PAGE.footerNoteSize, PAGE.colors.revision);
  doc.text(
    LETTER.revision,
    ctx.left,
    baseline(textTop + lineH * 3 + mm(PAGE.footerRevisionGap), noteLH, PAGE.footerNoteSize)
  );

  // Badge, right-aligned and vertically centred in the contact row
  if (badge) {
    const h = mm(PAGE.badgeHeight);
    const w = (h * badge.w) / badge.h;
    try {
      doc.addImage(badge.dataUrl, "PNG", ctx.right - w, contentTop + (mm(f.contentHeight) - h) / 2, w, h);
    } catch (error) {
      console.error("Badge rendering failed:", error);
    }
  }

  // Page number (only when there is more than one page)
  if (total > 1) {
    setFont(ctx, "normal", 9.3, PAGE.colors.ink);
    doc.text(`Page ${page} of ${total}`, ctx.right, mm(PAGE.pageNumberY), { align: "right" });
  }
};

/* ============================================================================
   11. MAIN PDF GENERATOR
============================================================================ */

export const generateCOEPdf = async (employee, form) => {
  if (!employee || !form) {
    throw new Error("Employee information and certificate form are required.");
  }

  const [logo, badge] = await Promise.all([
    loadImage(LOGO_URL),
    loadImage(BADGE_URL),
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.logoMissing = !logo;

  const FONT = await registerFont(doc);
  const ctx = createContext(doc, FONT);
  const cert = buildCertificate(employee, form);

  renderHeader(ctx, logo);
  renderBody(ctx, cert);

  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    renderFooter(ctx, badge, { showSeal: page === total, page, total });
  }

  return doc;
};
