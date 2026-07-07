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
});
