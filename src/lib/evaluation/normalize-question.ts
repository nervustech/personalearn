/**
 * Normalize question labels for compare/conflict/dedupe.
 * Examples: "1.a" / "1(a)" / "1A" / "Q1a" → "1a"; "2" → "2"; "a" → "a".
 */
export function normalizeQuestionLabel(raw: unknown): string | null {
  if (raw == null) return null;
  let s =
    typeof raw === "number" && Number.isFinite(raw)
      ? String(raw)
      : String(raw).trim();
  if (!s) return null;

  s = s.replace(/^q(uestion)?\s*/i, "").trim();
  if (!s) return null;

  // Strip decorative separators commonly used in Kenyan papers: 1.a, 1(a), 1-a, 1 a
  s = s
    .toLowerCase()
    .replace(/[()[\]{}]/g, "")
    .replace(/[\s._\-–—]+/g, "");

  if (!s) return null;
  // Must contain at least one letter or digit
  if (!/[a-z0-9]/.test(s)) return null;
  return s;
}

export function parseQuestionLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const labels = raw
    .map((item) => normalizeQuestionLabel(item))
    .filter((x): x is string => Boolean(x));
  return [...new Set(labels)].sort(compareQuestionLabels);
}

/**
 * Natural-ish order: numeric stem first, then letter parts (1 < 1a < 1b < 2 < a).
 */
export function compareQuestionLabels(a: string, b: string): number {
  const pa = splitQuestionLabel(a);
  const pb = splitQuestionLabel(b);
  if (pa.stem !== pb.stem) {
    if (pa.stem != null && pb.stem != null) return pa.stem - pb.stem;
    if (pa.stem != null) return -1;
    if (pb.stem != null) return 1;
  }
  return pa.rest.localeCompare(pb.rest, undefined, { numeric: true });
}

function splitQuestionLabel(label: string): {
  stem: number | null;
  rest: string;
} {
  const match = /^(\d+)(.*)$/.exec(label);
  if (!match) return { stem: null, rest: label };
  return {
    stem: Number.parseInt(match[1]!, 10),
    rest: match[2] ?? "",
  };
}

/** True when every label is a bare positive integer (gap checks are meaningful). */
export function allLabelsAreBareIntegers(labels: string[]): boolean {
  return (
    labels.length > 0 && labels.every((l) => /^\d+$/.test(l))
  );
}

/**
 * Gap warning only for pure integer sequences (1,2,4 → gap).
 * Mixed part/letter labels skip gap detection.
 */
export function hasIntegerQuestionGap(labels: string[]): boolean {
  if (!allLabelsAreBareIntegers(labels)) return false;
  const nums = [...new Set(labels.map((l) => Number.parseInt(l, 10)))].sort(
    (a, b) => a - b
  );
  if (nums.length < 2) return false;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i]! - nums[i - 1]! > 1) return true;
  }
  return false;
}
