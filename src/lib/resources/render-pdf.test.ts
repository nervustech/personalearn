import { describe, expect, it } from "vitest";
import {
  flattenMath,
  parseResourcePdfBlocks,
  pdfFileName,
  renderResourcePdf,
  stripInlineMarkdown,
  toWinAnsi,
} from "./render-pdf";

describe("render-pdf helpers", () => {
  it("flattens latex fractions and symbols for plain reading", () => {
    expect(flattenMath("Solve $\\frac{3}{4} + \\frac{1}{2}$")).toContain(
      "(3)/(4)"
    );
    expect(flattenMath("Area $$\\times$$ width")).toContain("x");
  });

  it("strips markdown chrome while keeping words", () => {
    expect(stripInlineMarkdown("**Bold** and [link](https://x.test)")).toBe(
      "Bold and link"
    );
    expect(stripInlineMarkdown("`code` and *emph*")).toBe("code and emph");
  });

  it("maps curly quotes to WinAnsi-safe ASCII", () => {
    expect(toWinAnsi("It’s “fine” — really…")).toBe("It's \"fine\" - really...");
  });

  it("parses headings, lists, and tables into layout blocks", () => {
    const blocks = parseResourcePdfBlocks(`# Week 1

Intro paragraph.

## Objectives

- Know fractions
- Apply addition

| Topic | Marks |
| --- | --- |
| Fractions | 10 |
| Decimals | 5 |

1. First
2. Second
`);

    expect(blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "heading", level: 1, text: "Week 1" }),
        expect.objectContaining({
          kind: "paragraph",
          text: "Intro paragraph.",
        }),
        expect.objectContaining({
          kind: "heading",
          level: 2,
          text: "Objectives",
        }),
        expect.objectContaining({
          kind: "listItem",
          ordered: false,
          text: "Know fractions",
        }),
        expect.objectContaining({
          kind: "table",
          headers: ["Topic", "Marks"],
          rows: [
            ["Fractions", "10"],
            ["Decimals", "5"],
          ],
        }),
        expect.objectContaining({
          kind: "listItem",
          ordered: true,
          index: 1,
          text: "First",
        }),
        expect.objectContaining({
          kind: "listItem",
          ordered: true,
          index: 2,
          text: "Second",
        }),
      ])
    );

    // Raw markdown markers should not remain in heading/list text.
    const heading = blocks.find((b) => b.kind === "heading" && b.level === 1);
    expect(heading && "text" in heading ? heading.text : "").not.toMatch(/#/);
  });

  it("builds a PDF that starts with the %PDF signature", async () => {
    const bytes = await renderResourcePdf(
      "Fractions worksheet",
      "# Question 1\n\nSolve $\\frac{3}{4} + \\frac{1}{2}$.\n\n- Show working\n- Box the answer\n"
    );
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
    expect(bytes.byteLength).toBeGreaterThan(500);
  });

  it("sanitizes download filenames", () => {
    expect(pdfFileName("Week 1 — Fractions!")).toBe("Week-1-Fractions.pdf");
  });
});
