import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { normalizeMarkdown } from "@/lib/ai-hub/normalize-markdown";

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const BODY_SIZE = 11;
const BODY_LEADING = 15;
const TITLE_SIZE = 18;
const CODE_SIZE = 9.5;
const CODE_LEADING = 12.5;

const TEXT_COLOR = rgb(0.12, 0.14, 0.18);
const MUTED_COLOR = rgb(0.35, 0.38, 0.42);
const RULE_COLOR = rgb(0.78, 0.8, 0.84);

/** Map common non-WinAnsi characters to safe approximations. */
const CHAR_MAP: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u2026": "...",
  "\u2022": "-",
  "\u00A0": " ",
  "\u00D7": "x",
  "\u00F7": "/",
  "\u2212": "-",
  "\u2264": "<=",
  "\u2265": ">=",
  "\u2248": "~=",
  "\u2260": "!=",
  "\u2192": "->",
  "\u221A": "sqrt",
  "\u03C0": "pi",
  "\u03B8": "theta",
  "\u00B0": " deg",
};

/** StandardFonts (Helvetica) only encode WinAnsi; drop anything else. */
export function toWinAnsi(text: string): string {
  let out = "";
  for (const ch of text) {
    if (CHAR_MAP[ch] !== undefined) {
      out += CHAR_MAP[ch];
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\t") out += "  ";
    else if (code === 10 || code === 13) out += ch;
    else if (code >= 32 && code <= 255) out += ch;
    else out += "?";
  }
  return out;
}

/** Flatten common LaTeX / math delimiters into readable plain text. */
export function flattenMath(text: string): string {
  let out = text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, expr: string) => ` ${flattenLatexExpr(expr)} `)
    .replace(/\$([^$\n]+?)\$/g, (_, expr: string) => flattenLatexExpr(expr))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, expr: string) => flattenLatexExpr(expr))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, expr: string) => ` ${flattenLatexExpr(expr)} `);

  return out.replace(/[ \t]{2,}/g, " ").trimEnd();
}

function flattenLatexExpr(expr: string): string {
  let s = expr.trim();
  // Nested-ish fractions (one level is enough for worksheets).
  for (let i = 0; i < 4; i++) {
    const next = s.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "($1)/($2)");
    if (next === s) break;
    s = next;
  }
  return s
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, "sqrt($1)")
    .replace(/\\sqrt\s*/g, "sqrt")
    .replace(/\\times/g, "x")
    .replace(/\\div/g, "/")
    .replace(/\\pm/g, "+/-")
    .replace(/\\cdot/g, ".")
    .replace(/\\leq/g, "<=")
    .replace(/\\geq/g, ">=")
    .replace(/\\neq/g, "!=")
    .replace(/\\approx/g, "~=")
    .replace(/\\rightarrow|\\to/g, "->")
    .replace(/\\left|\\right/g, "")
    .replace(/\\,/g, " ")
    .replace(/\\;/g, " ")
    .replace(/\\quad|\\qquad/g, "  ")
    .replace(/\\%/g, "%")
    .replace(/\\&/g, "&")
    .replace(/\\_/g, "_")
    .replace(/\\text\s*\{([^{}]+)\}/g, "$1")
    .replace(/\\mathrm\s*\{([^{}]+)\}/g, "$1")
    .replace(/\\mathbf\s*\{([^{}]+)\}/g, "$1")
    .replace(/\\[a-zA-Z]+\*?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip inline Markdown while keeping readable wording. */
export function stripInlineMarkdown(text: string): string {
  return flattenMath(text)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/^\s*#{1,6}\s+/, "")
    .trim();
}

type PdfBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "listItem"; ordered: boolean; index: number; depth: number; text: string }
  | { kind: "quote"; text: string }
  | { kind: "code"; lines: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "rule" }
  | { kind: "spacer"; em: number };

function isTableSeparator(line: string) {
  return /^\|?[\s:-]+\|[\s|:-]*$/.test(line.trim());
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => stripInlineMarkdown(cell.trim()));
}

function listMarker(line: string): { ordered: boolean; depth: number; text: string } | null {
  const match = /^(\s*)([-*+]|\d+[.)])\s+(.+)$/.exec(line);
  if (!match) return null;
  const indent = match[1].replace(/\t/g, "  ").length;
  const marker = match[2];
  return {
    ordered: /^\d/.test(marker),
    depth: Math.min(3, Math.floor(indent / 2)),
    text: match[3],
  };
}

/** Parse markdown-ish resource text into layout blocks for PDF. */
export function parseResourcePdfBlocks(markdown: string): PdfBlock[] {
  const source = normalizeMarkdown(markdown || "").replace(/\r\n/g, "\n");
  const lines = source.split("\n");
  const blocks: PdfBlock[] = [];
  let i = 0;
  let orderedCounters = [0, 0, 0, 0];

  const pushParagraph = (parts: string[]) => {
    const text = parts.map((p) => stripInlineMarkdown(p)).filter(Boolean).join(" ");
    if (text) blocks.push({ kind: "paragraph", text });
  };

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code.
    if (/^```/.test(trimmed)) {
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ kind: "code", lines: codeLines.length ? codeLines : [""] });
      orderedCounters = [0, 0, 0, 0];
      continue;
    }

    // Horizontal rule.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: "rule" });
      orderedCounters = [0, 0, 0, 0];
      i += 1;
      continue;
    }

    // Heading.
    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const level = Math.min(3, heading[1].length) as 1 | 2 | 3;
      blocks.push({
        kind: "heading",
        level,
        text: stripInlineMarkdown(heading[2]),
      });
      orderedCounters = [0, 0, 0, 0];
      i += 1;
      continue;
    }

    // GFM table (header + separator + rows).
    if (
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const headers = splitTableRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes("|") && !isTableSeparator(lines[i])) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      blocks.push({ kind: "table", headers, rows });
      orderedCounters = [0, 0, 0, 0];
      continue;
    }

    // Blockquote (merge consecutive).
    if (/^>\s?/.test(trimmed)) {
      const quoteParts: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoteParts.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      const text = quoteParts
        .map((p) => stripInlineMarkdown(p))
        .filter(Boolean)
        .join(" ");
      if (text) blocks.push({ kind: "quote", text });
      orderedCounters = [0, 0, 0, 0];
      continue;
    }

    // List item.
    const list = listMarker(raw);
    if (list) {
      if (list.ordered) {
        orderedCounters[list.depth] += 1;
        for (let d = list.depth + 1; d < orderedCounters.length; d++) {
          orderedCounters[d] = 0;
        }
      } else {
        orderedCounters[list.depth] = 0;
      }
      blocks.push({
        kind: "listItem",
        ordered: list.ordered,
        index: orderedCounters[list.depth] || 1,
        depth: list.depth,
        text: stripInlineMarkdown(list.text),
      });
      i += 1;
      continue;
    }

    // Paragraph: soft-join wrapped lines until blank / structural.
    const parts: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = lines[i];
      const nextTrim = next.trim();
      if (!nextTrim) break;
      if (/^```/.test(nextTrim)) break;
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(nextTrim)) break;
      if (/^#{1,6}\s+/.test(nextTrim)) break;
      if (/^>\s?/.test(nextTrim)) break;
      if (listMarker(next)) break;
      if (
        nextTrim.includes("|") &&
        i + 1 < lines.length &&
        isTableSeparator(lines[i + 1])
      ) {
        break;
      }
      parts.push(nextTrim);
      i += 1;
    }
    pushParagraph(parts);
    orderedCounters = [0, 0, 0, 0];
  }

  return blocks;
}

type DrawCtx = {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
};

function ensureSpace(ctx: DrawCtx, needed: number) {
  if (ctx.y - needed < MARGIN) {
    ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.y = PAGE_HEIGHT - MARGIN;
  }
}

function drawWrappedLine(
  ctx: DrawCtx,
  text: string,
  opts: {
    x: number;
    maxWidth: number;
    size: number;
    leading: number;
    font: PDFFont;
    color?: ReturnType<typeof rgb>;
  }
) {
  const color = opts.color ?? TEXT_COLOR;
  const words = toWinAnsi(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    ctx.y -= opts.leading * 0.5;
    return;
  }

  // Break oversized tokens so they never clip past the page edge.
  const tokens: string[] = [];
  for (const word of words) {
    if (opts.font.widthOfTextAtSize(word, opts.size) <= opts.maxWidth) {
      tokens.push(word);
      continue;
    }
    let chunk = "";
    for (const ch of word) {
      const candidate = chunk + ch;
      if (opts.font.widthOfTextAtSize(candidate, opts.size) > opts.maxWidth && chunk) {
        tokens.push(chunk);
        chunk = ch;
      } else {
        chunk = candidate;
      }
    }
    if (chunk) tokens.push(chunk);
  }

  let current = "";
  const flush = () => {
    if (!current) return;
    ensureSpace(ctx, opts.leading);
    ctx.page.drawText(current, {
      x: opts.x,
      y: ctx.y,
      size: opts.size,
      font: opts.font,
      color,
    });
    ctx.y -= opts.leading;
    current = "";
  };

  for (const token of tokens) {
    const candidate = current ? `${current} ${token}` : token;
    if (opts.font.widthOfTextAtSize(candidate, opts.size) > opts.maxWidth) {
      flush();
      current = token;
    } else {
      current = candidate;
    }
  }
  flush();
}

function drawRule(ctx: DrawCtx) {
  ensureSpace(ctx, 16);
  ctx.y -= 6;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.y },
    thickness: 0.75,
    color: RULE_COLOR,
  });
  ctx.y -= 10;
}

function cellAt(row: string[], col: number) {
  return row[col] ?? "";
}

/**
 * Wide / narrative tables (marking schemes, rubrics) read poorly as equal-width
 * columns. Stack those as labeled rows; keep compact grids for short tables.
 */
export function shouldStackTable(headers: string[], rows: string[][]) {
  const cols = Math.max(headers.length, ...rows.map((r) => r.length), 1);
  if (cols >= 4) return true;
  const samples = [...headers, ...rows.flatMap((r) => r)];
  const maxLen = Math.max(0, ...samples.map((s) => s.length));
  if (cols >= 3 && maxLen > 55) return true;
  return false;
}

/** Content-weighted column widths (sqrt dampens one huge Working column). */
export function computeTableColumnWidths(
  headers: string[],
  rows: string[][],
  cols: number,
  totalWidth: number
) {
  const weights = Array.from({ length: cols }, (_, col) => {
    let maxChars = (headers[col] ?? "").length;
    for (const row of rows) {
      maxChars = Math.max(maxChars, cellAt(row, col).length);
    }
    return Math.max(3, Math.sqrt(maxChars));
  });
  const sum = weights.reduce((a, b) => a + b, 0) || cols;
  const raw = weights.map((w) => (w / sum) * totalWidth);
  // Enforce a readable minimum so Answer / Marks don't collapse.
  const minWidth = Math.min(56, totalWidth / cols);
  const floored = raw.map((w) => Math.max(minWidth, w));
  const floorSum = floored.reduce((a, b) => a + b, 0);
  return floored.map((w) => (w / floorSum) * totalWidth);
}

function countWrappedLines(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const words = toWinAnsi(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  let lines = 1;
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines += 1;
      current = word;
    } else {
      current = candidate;
    }
  }
  return lines;
}

/** Labeled stacked rows — best for marking-scheme Working / Marks columns. */
function formatStackedFieldValue(header: string, value: string) {
  // Break long working chains onto separate lines for readability.
  if (/^working$/i.test(header.trim())) {
    return value
      .replace(/\s*,\s*/g, "\n")
      .replace(/\s*;\s*/g, "\n")
      .trim();
  }
  return value;
}

function drawStackedMultiline(
  ctx: DrawCtx,
  text: string,
  opts: {
    x: number;
    maxWidth: number;
    size: number;
    leading: number;
    font: PDFFont;
    color?: ReturnType<typeof rgb>;
  }
) {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      ctx.y -= opts.leading * 0.45;
      continue;
    }
    drawWrappedLine(ctx, trimmed, opts);
  }
}

function drawStackedTable(ctx: DrawCtx, headers: string[], rows: string[][]) {
  const cols = Math.max(headers.length, ...rows.map((r) => r.length), 1);
  const labelSize = 9;
  const valueSize = 11;
  const leading = 15;
  const labelWidth = Math.min(
    120,
    Math.max(
      72,
      ...headers.map(
        (h) => ctx.bold.widthOfTextAtSize(toWinAnsi(`${h}:`), labelSize) + 10
      )
    )
  );

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    let est = 14;
    for (let col = 0; col < cols; col++) {
      const header = (headers[col] ?? `Col ${col + 1}`).trim() || `Col ${col + 1}`;
      const value = formatStackedFieldValue(header, cellAt(row, col).trim());
      if (!value) continue;
      if (col === 0 && /^(question|q\.?|#|item|no\.?)$/i.test(header)) {
        est += leading + 6;
        continue;
      }
      for (const line of value.split("\n")) {
        est +=
          countWrappedLines(
            line.trim() || " ",
            ctx.font,
            valueSize,
            CONTENT_WIDTH - labelWidth - 8
          ) * leading;
      }
      est += 4;
    }
    ensureSpace(ctx, Math.min(est, PAGE_HEIGHT - MARGIN * 2));

    for (let col = 0; col < cols; col++) {
      const header =
        (headers[col] ?? `Col ${col + 1}`).trim() || `Col ${col + 1}`;
      const value = formatStackedFieldValue(header, cellAt(row, col).trim());
      if (!value) continue;

      if (col === 0 && /^(question|q\.?|#|item|no\.?)$/i.test(header)) {
        drawWrappedLine(ctx, `${header} ${value}`, {
          x: MARGIN,
          maxWidth: CONTENT_WIDTH,
          size: 12,
          leading: 16,
          font: ctx.bold,
        });
        ctx.y -= 4;
        continue;
      }

      const label = `${header}:`;
      ensureSpace(ctx, leading);
      const labelY = ctx.y;
      ctx.page.drawText(toWinAnsi(label), {
        x: MARGIN,
        y: labelY,
        size: labelSize,
        font: ctx.bold,
        color: MUTED_COLOR,
      });
      drawStackedMultiline(ctx, value, {
        x: MARGIN + labelWidth,
        maxWidth: CONTENT_WIDTH - labelWidth,
        size: valueSize,
        leading,
        font: ctx.font,
      });
      ctx.y -= 3;
    }

    if (ri < rows.length - 1) {
      ctx.y -= 4;
      ctx.page.drawLine({
        start: { x: MARGIN, y: ctx.y },
        end: { x: PAGE_WIDTH - MARGIN, y: ctx.y },
        thickness: 0.6,
        color: RULE_COLOR,
      });
      ctx.y -= 12;
    }
  }
  ctx.y -= 10;
}

function drawGridTable(ctx: DrawCtx, headers: string[], rows: string[][]) {
  const cols = Math.max(headers.length, ...rows.map((r) => r.length), 1);
  const widths = computeTableColumnWidths(headers, rows, cols, CONTENT_WIDTH);
  const pad = 5;
  const size = 10;
  const leading = 13;

  const drawRow = (row: string[], useBold: boolean) => {
    const lineCounts = Array.from({ length: cols }, (_, col) =>
      countWrappedLines(
        cellAt(row, col),
        useBold ? ctx.bold : ctx.font,
        size,
        Math.max(20, widths[col] - pad * 2)
      )
    );
    const rowHeight = Math.max(...lineCounts) * leading + 8;
    ensureSpace(ctx, rowHeight);

    const top = ctx.y;
    let x = MARGIN;
    for (let col = 0; col < cols; col++) {
      const savedY = ctx.y;
      drawWrappedLine(ctx, cellAt(row, col), {
        x: x + pad,
        maxWidth: Math.max(20, widths[col] - pad * 2),
        size,
        leading,
        font: useBold ? ctx.bold : ctx.font,
        color: useBold ? TEXT_COLOR : MUTED_COLOR,
      });
      ctx.y = savedY;
      x += widths[col];
    }
    ctx.y = top - rowHeight;
  };

  if (headers.some(Boolean)) {
    drawRow(headers, true);
    ctx.page.drawLine({
      start: { x: MARGIN, y: ctx.y + 3 },
      end: { x: PAGE_WIDTH - MARGIN, y: ctx.y + 3 },
      thickness: 0.8,
      color: RULE_COLOR,
    });
    ctx.y -= 2;
  }
  for (let ri = 0; ri < rows.length; ri++) {
    drawRow(rows[ri], false);
    if (ri < rows.length - 1) {
      ctx.page.drawLine({
        start: { x: MARGIN, y: ctx.y + 3 },
        end: { x: PAGE_WIDTH - MARGIN, y: ctx.y + 3 },
        thickness: 0.4,
        color: RULE_COLOR,
      });
    }
  }
  ctx.y -= 8;
}

function drawTable(ctx: DrawCtx, headers: string[], rows: string[][]) {
  if (shouldStackTable(headers, rows)) {
    drawStackedTable(ctx, headers, rows);
    return;
  }
  drawGridTable(ctx, headers, rows);
}

/**
 * Render resource markdown/text into a clean, paginated A4 PDF.
 * Headings, lists, tables, quotes, and code are laid out for reading —
 * not dumped as raw markdown.
 */
export async function renderResourcePdf(
  title: string,
  text: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const ctx: DrawCtx = {
    doc,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN,
    font,
    bold,
    mono,
  };

  drawWrappedLine(ctx, title || "Resource", {
    x: MARGIN,
    maxWidth: CONTENT_WIDTH,
    size: TITLE_SIZE,
    leading: TITLE_SIZE + 6,
    font: bold,
  });
  ctx.y -= 4;
  drawRule(ctx);
  ctx.y -= 4;

  drawBlocks(ctx, parseResourcePdfBlocks(text));

  return doc.save();
}

function drawCodeBlock(ctx: DrawCtx, lines: string[]) {
  ctx.y -= 6;
  const padY = 8;
  const contentHeight = Math.max(1, lines.length) * CODE_LEADING;
  ensureSpace(ctx, contentHeight + padY * 2 + 8);
  const top = ctx.y + 2;
  const bottom = top - contentHeight - padY * 2;

  ctx.page.drawRectangle({
    x: MARGIN,
    y: bottom,
    width: CONTENT_WIDTH,
    height: top - bottom,
    color: rgb(0.96, 0.97, 0.98),
    borderColor: RULE_COLOR,
    borderWidth: 0.75,
  });

  ctx.y = top - padY - CODE_SIZE;
  for (const line of lines) {
    drawWrappedLine(ctx, line.length ? line : " ", {
      x: MARGIN + 8,
      maxWidth: CONTENT_WIDTH - 16,
      size: CODE_SIZE,
      leading: CODE_LEADING,
      font: ctx.mono,
      color: MUTED_COLOR,
    });
  }
  ctx.y = Math.min(ctx.y, bottom) - 8;
}

function drawBlocks(ctx: DrawCtx, blocks: PdfBlock[]) {
  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    const prev = blocks[bi - 1];

    switch (block.kind) {
      case "spacer": {
        ctx.y -= BODY_LEADING * block.em;
        break;
      }
      case "heading": {
        const sizes = { 1: 15, 2: 13, 3: 12 } as const;
        const size = sizes[block.level];
        const gapBefore = prev ? (block.level === 1 ? 14 : 10) : 0;
        if (gapBefore) {
          ensureSpace(ctx, gapBefore + size + 8);
          ctx.y -= gapBefore;
        }
        drawWrappedLine(ctx, block.text, {
          x: MARGIN,
          maxWidth: CONTENT_WIDTH,
          size,
          leading: size + 4,
          font: ctx.bold,
        });
        ctx.y -= 4;
        break;
      }
      case "paragraph": {
        if (prev && (prev.kind === "paragraph" || prev.kind === "listItem")) {
          ctx.y -= 4;
        }
        drawWrappedLine(ctx, block.text, {
          x: MARGIN,
          maxWidth: CONTENT_WIDTH,
          size: BODY_SIZE,
          leading: BODY_LEADING,
          font: ctx.font,
        });
        ctx.y -= 4;
        break;
      }
      case "listItem": {
        const indent = MARGIN + block.depth * 16;
        const bullet = block.ordered ? `${block.index}.` : "-";
        const bulletWidth = ctx.font.widthOfTextAtSize(`${bullet}  `, BODY_SIZE);
        ensureSpace(ctx, BODY_LEADING);
        ctx.page.drawText(toWinAnsi(bullet), {
          x: indent,
          y: ctx.y,
          size: BODY_SIZE,
          font: ctx.font,
          color: TEXT_COLOR,
        });
        drawWrappedLine(ctx, block.text, {
          x: indent + bulletWidth,
          maxWidth: PAGE_WIDTH - MARGIN - (indent + bulletWidth),
          size: BODY_SIZE,
          leading: BODY_LEADING,
          font: ctx.font,
        });
        ctx.y -= 2;
        break;
      }
      case "quote": {
        ctx.y -= 4;
        const quoteX = MARGIN + 12;
        ensureSpace(ctx, BODY_LEADING * 2);
        const quoteStartY = ctx.y + BODY_SIZE;
        drawWrappedLine(ctx, block.text, {
          x: quoteX,
          maxWidth: CONTENT_WIDTH - 12,
          size: BODY_SIZE,
          leading: BODY_LEADING,
          font: ctx.font,
          color: MUTED_COLOR,
        });
        ctx.page.drawLine({
          start: { x: MARGIN + 2, y: quoteStartY },
          end: { x: MARGIN + 2, y: ctx.y + 4 },
          thickness: 2,
          color: RULE_COLOR,
        });
        ctx.y -= 6;
        break;
      }
      case "code": {
        drawCodeBlock(ctx, block.lines);
        break;
      }
      case "table": {
        ctx.y -= 6;
        drawTable(ctx, block.headers, block.rows);
        break;
      }
      case "rule": {
        drawRule(ctx);
        break;
      }
    }
  }
}

/** Safe ASCII-ish filename stem for Content-Disposition. */
export function pdfFileName(title: string): string {
  const stem =
    title
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "resource";
  return `${stem}.pdf`;
}
