/**
 * Turn model student_work / correct_reference JSON into readable review text.
 * Prefer common answer keys; never dump raw JSON when a human string exists.
 */
export function formatStructuredField(
  json: Record<string, unknown> | null | undefined,
  legacyText: string | null | undefined
): string | null {
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const fromObject = humanizeStructuredObject(json);
    if (fromObject) return fromObject;
  }

  const trimmed = legacyText?.trim();
  if (!trimmed) return null;

  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return (
          humanizeStructuredObject(parsed as Record<string, unknown>) ?? trimmed
        );
      }
    } catch {
      // keep legacy text
    }
  }

  return trimmed;
}

function humanizeStructuredObject(
  json: Record<string, unknown>
): string | null {
  if (Array.isArray(json.steps)) {
    const steps = json.steps.filter(
      (s): s is string => typeof s === "string" && s.trim().length > 0
    );
    if (steps.length > 0) {
      const body = steps.map((s, i) => `${i + 1}. ${s.trim()}`).join("\n");
      const answer =
        typeof json.answer === "string" && json.answer.trim()
          ? `\nAnswer: ${json.answer.trim()}`
          : "";
      return `${body}${answer}`;
    }
  }

  const preferredKeys = [
    "text",
    "expression",
    "formula",
    "answer",
    "working",
    "result",
    "value",
  ] as const;

  for (const key of preferredKeys) {
    const v = json[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }

  const lines: string[] = [];
  for (const [key, value] of Object.entries(json)) {
    if (value == null || value === "") continue;
    const label = key.replace(/_/g, " ");
    if (typeof value === "string" || typeof value === "number") {
      lines.push(`${label}: ${value}`);
    } else if (Array.isArray(value) && value.every((x) => typeof x === "string")) {
      lines.push(`${label}: ${value.join("; ")}`);
    }
  }
  return lines.length > 0 ? lines.join("\n") : null;
}
