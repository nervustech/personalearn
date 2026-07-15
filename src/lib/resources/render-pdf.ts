import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const BODY_SIZE = 11;
const BODY_LEADING = 16;
const TITLE_SIZE = 20;

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
};

/** StandardFonts (Helvetica) only encode WinAnsi; drop anything else. */
function toWinAnsi(text: string): string {
  let out = "";
  for (const ch of text) {
    if (CHAR_MAP[ch] !== undefined) {
      out += CHAR_MAP[ch];
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    // Tab -> spaces; keep printable Latin-1, replace the rest.
    if (ch === "\t") out += "  ";
    else if (code === 10 || code === 13) out += ch;
    else if (code >= 32 && code <= 255) out += ch;
    else out += "?";
  }
  return out;
}

/** Strip inline Markdown emphasis/code and math delimiters for flat text. */
function stripInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\$\$?([^$]+)\$\$?/g, "$1")
    .replace(/^\s*[-*]\s+/, "• ")
    .replace(/^\s*#{1,6}\s+/, "");
}

type Line = { text: string; size: number; bold: boolean; gapAfter: number };

function classify(raw: string): Line {
  const trimmed = raw.trimEnd();
  const heading = /^(#{1,6})\s+/.exec(trimmed);
  if (heading) {
    const level = heading[1].length;
    return {
      text: stripInline(trimmed),
      size: level <= 1 ? 15 : level === 2 ? 13 : 12,
      bold: true,
      gapAfter: 4,
    };
  }
  return {
    text: stripInline(trimmed),
    size: BODY_SIZE,
    bold: false,
    gapAfter: 0,
  };
}

/** Render resource text into a clean, paginated A4 PDF. */
export async function renderResourcePdf(
  title: string,
  text: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };

  const drawWrapped = (
    content: string,
    size: number,
    useBold: boolean,
    leading: number
  ) => {
    const activeFont = useBold ? bold : font;
    const words = toWinAnsi(content).split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      y -= leading;
      return;
    }
    let current = "";
    const flush = () => {
      if (!current) return;
      if (y < MARGIN + leading) newPage();
      page.drawText(current, {
        x: MARGIN,
        y,
        size,
        font: activeFont,
        color: rgb(0.1, 0.12, 0.16),
      });
      y -= leading;
      current = "";
    };
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (activeFont.widthOfTextAtSize(candidate, size) > CONTENT_WIDTH) {
        flush();
        current = word;
      } else {
        current = candidate;
      }
    }
    flush();
  };

  // Title.
  drawWrapped(title || "Resource", TITLE_SIZE, true, TITLE_SIZE + 6);
  y -= 8;

  const lines = (text || "").replace(/\r\n/g, "\n").split("\n");
  for (const raw of lines) {
    if (raw.trim() === "") {
      y -= BODY_LEADING * 0.6;
      if (y < MARGIN) newPage();
      continue;
    }
    const line = classify(raw);
    const leading = line.bold ? line.size + 5 : BODY_LEADING;
    drawWrapped(line.text, line.size, line.bold, leading);
    if (line.gapAfter) y -= line.gapAfter;
  }

  return doc.save();
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
