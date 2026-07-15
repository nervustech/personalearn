import { describe, expect, it } from "vitest";
import { normalizeMarkdown } from "@/lib/ai-hub/normalize-markdown";

describe("normalizeMarkdown", () => {
  it("splits concatenated table rows", () => {
    const input = "| 1 | answer | 2 || 2 | other | 1 |";
    const result = normalizeMarkdown(input);

    expect(result).toContain("| 1 | answer | 2 |");
    expect(result).toContain("| 2 | other | 1 |");
    expect(result).not.toContain("|| 2 |");
  });

  it("puts separator rows on their own line", () => {
    const input = "| Question | Answer ||------|-------|";
    const result = normalizeMarkdown(input);

    expect(result).toContain("|------|-------|");
    expect(result).not.toMatch(/\|\|------/);
  });

  it("converts inline LaTeX bracket delimiters to dollar math", () => {
    const input = "a) \\( \\frac{29}{6} = \\)";
    const result = normalizeMarkdown(input);

    expect(result).toContain("$\\frac{29}{6} =$");
    expect(result).not.toContain("\\(");
    expect(result).not.toContain("\\)");
  });

  it("converts block LaTeX bracket delimiters to dollar math", () => {
    const input = "\\[ \\frac{53}{11} = 4\\frac{9}{11} \\]";
    const result = normalizeMarkdown(input);

    expect(result).toContain("$$\\frac{53}{11} = 4\\frac{9}{11}$$");
    expect(result).not.toContain("\\[");
    expect(result).not.toContain("\\]");
  });
});
