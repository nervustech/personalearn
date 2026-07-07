/**
 * Repairs common LLM markdown issues so tables and lists render correctly.
 */
export function normalizeMarkdown(text: string): string {
  return (
    text
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
