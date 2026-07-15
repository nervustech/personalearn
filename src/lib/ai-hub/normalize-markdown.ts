/**
 * Repairs common LLM markdown issues so tables and lists render correctly.
 *
 * Also converts LaTeX bracket delimiters (`\( ... \)`, `\[ ... \]`) to the
 * dollar delimiters `remark-math` understands. Many models emit bracket math;
 * Markdown otherwise strips the backslashes, leaving raw `( \frac{1}{2} )`.
 */
export function normalizeMarkdown(text: string): string {
  return (
    text
      // Block math: \[ ... \] -> $$ ... $$ (before inline so brackets win).
      .replace(/\\\[([\s\S]+?)\\\]/g, (_, expr) => `$$${expr.trim()}$$`)
      // Inline math: \( ... \) -> $ ... $
      .replace(/\\\(([\s\S]+?)\\\)/g, (_, expr) => `$${expr.trim()}$`)
      // Split concatenated table rows: "| 2 | ... || 3 | ..." -> newline between rows
      .replace(/\|\s*\|(?=\s*[^|\s-])/g, "|\n|")
      // Split header row from separator when stuck together: "... ||------|"
      .replace(/\|\s*\|(?=-)/g, "|\n|")
      // Trim trailing whitespace on each line
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
  );
}
