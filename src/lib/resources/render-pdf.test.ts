import { describe, expect, it } from "vitest";
import {
  computeTableColumnWidths,
  flattenMath,
  parseResourcePdfBlocks,
  pdfFileName,
  renderResourcePdf,
  shouldStackTable,
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

  it("stacks wide marking-scheme tables and keeps short ones as grids", () => {
    expect(
      shouldStackTable(
        ["Question", "Answer", "Marks"],
        [
          ["1", "56", "1"],
          ["2", "54", "1"],
        ]
      )
    ).toBe(false);

    expect(
      shouldStackTable(
        ["Question", "Working", "Answer", "Marks"],
        [
          [
            "6",
            "20 x 4 = 80, 3 x 4 = 12, 80 + 12 = 92",
            "92",
            "1 mark for method, 1 mark for correct answer",
          ],
        ]
      )
    ).toBe(true);
  });

  it("gives longer columns more width in compact grids", () => {
    const widths = computeTableColumnWidths(
      ["Q", "Answer", "Notes"],
      [
        ["1", "56", "short"],
        ["2", "54", "a much longer notes cell than the others"],
      ],
      3,
      480
    );
    expect(widths).toHaveLength(3);
    expect(widths[2]).toBeGreaterThan(widths[0]);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(480, 5);
  });

  it("builds a readable PDF for a marking-scheme with wide tables", async () => {
    const markdown = `# Marking Scheme

## Section A

| Question | Answer | Marks |
|----------|--------|-------|
| 1 | 56 | 1 |

## Section B

| Question | Working | Answer | Marks |
|----------|---------|--------|-------|
| 6 | \\( 20 \\times 4 = 80 \\), \\( 3 \\times 4 = 12 \\), \\( 80 + 12 = 92 \\) | 92 | 1 mark for method, 1 mark for correct answer |
`;
    const blocks = parseResourcePdfBlocks(markdown);
    const tables = blocks.filter((b) => b.kind === "table");
    expect(tables).toHaveLength(2);
    expect(shouldStackTable(tables[0].headers, tables[0].rows)).toBe(false);
    expect(shouldStackTable(tables[1].headers, tables[1].rows)).toBe(true);

    const bytes = await renderResourcePdf("Week 5 Marking Scheme", markdown);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
    expect(bytes.byteLength).toBeGreaterThan(800);
  });

  it("sanitizes download filenames", () => {
    expect(pdfFileName("Week 1 — Fractions!")).toBe("Week-1-Fractions.pdf");
  });
});
