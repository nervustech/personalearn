import { normalizeQuestionLabel } from "@/lib/evaluation/normalize-question";

/** Minimal question shape for identity (avoids import cycle with evaluate-schema). */
export type QuestionIdentityInput = {
  question_number: string;
  section?: string | null;
  page_number?: number | null;
  vertical_bounds?: {
    top_percent: number;
    bottom_percent: number;
  } | null;
};

/** Normalize section headings: "Section A", "A", "PART B" → "A" / "B" / "PARTB". */
export function normalizeSectionLabel(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  let s = String(value).trim();
  if (!s) return null;
  s = s
    .replace(/^(section|part|paper)\s+/i, "")
    .replace(/[:.\-–—]+$/g, "")
    .trim();
  if (!s) return null;
  // Single letter/roman-ish tokens stay uppercase; longer names collapse.
  if (/^[a-z]$/i.test(s) || /^[ivxlcdm]+$/i.test(s)) {
    return s.toUpperCase();
  }
  return s.replace(/\s+/g, "").toUpperCase();
}

/**
 * Stable unique key for a question within a script.
 * Prefers section+number; falls back to bare number; collision suffixes use ~n.
 */
export function buildCanonicalQuestionKey(input: {
  section?: string | null;
  questionNumber: string;
  collisionIndex?: number;
}): string | null {
  const number = normalizeQuestionLabel(input.questionNumber);
  if (!number) return null;
  const section = normalizeSectionLabel(input.section);
  const base = section ? `${section}:${number}` : number;
  const n = input.collisionIndex ?? 1;
  return n > 1 ? `${base}~${n}` : base;
}

/** Teacher-facing label: "A.1" or "1". */
export function formatQuestionDisplayLabel(input: {
  section?: string | null;
  questionNumber: string;
}): string {
  const number =
    normalizeQuestionLabel(input.questionNumber) ??
    String(input.questionNumber).trim();
  const section = normalizeSectionLabel(input.section);
  return section ? `${section}.${number}` : number;
}

function sortKey(q: QuestionIdentityInput): number {
  const page = q.page_number ?? 999;
  const top = q.vertical_bounds?.top_percent ?? 1;
  return page * 1000 + top;
}

/** Review UI order: sheet page → vertical position → section → number. */
export function compareQuestionsForReview(
  a: QuestionIdentityInput,
  b: QuestionIdentityInput
): number {
  const bySheet = sortKey(a) - sortKey(b);
  if (bySheet !== 0) return bySheet;
  const sa = normalizeSectionLabel(a.section) ?? "";
  const sb = normalizeSectionLabel(b.section) ?? "";
  if (sa !== sb) return sa.localeCompare(sb);
  const na = normalizeQuestionLabel(a.question_number) ?? a.question_number;
  const nb = normalizeQuestionLabel(b.question_number) ?? b.question_number;
  return na.localeCompare(nb, undefined, { numeric: true });
}

/**
 * Ensure each graded question has a unique canonical identity.
 * - Keeps model section when present
 * - When bare numbers collide (sectioned paper without headers), assigns
 *   synthetic blocks BLK1, BLK2… in page/vertical order
 */
export function canonicalizeEvaluateQuestions<T extends QuestionIdentityInput>(
  questions: T[]
): Array<T & { section: string | null; canonical_key: string }> {
  const ordered = [...questions].sort((a, b) => sortKey(a) - sortKey(b));

  // First pass: provisional keys from model section + number.
  const provisional = ordered.map((q) => {
    const questionNumber =
      normalizeQuestionLabel(q.question_number) ?? q.question_number.trim();
    const section = normalizeSectionLabel(q.section ?? null);
    return { q, questionNumber, section };
  });

  const bareCounts = new Map<string, number>();
  for (const row of provisional) {
    if (row.section) continue;
    bareCounts.set(row.questionNumber, (bareCounts.get(row.questionNumber) ?? 0) + 1);
  }
  const hasBareCollision = [...bareCounts.values()].some((c) => c > 1);

  // When numbering restarts with no section labels, chunk into blocks each time
  // a number is ≤ previous number (restart heuristic).
  let block = 1;
  let prevStem: number | null = null;
  const blockOf = new Map<T, number>();
  if (hasBareCollision) {
    for (const row of provisional) {
      if (row.section) continue;
      const stem = /^(\d+)/.exec(row.questionNumber);
      const n = stem ? Number.parseInt(stem[1]!, 10) : null;
      if (n != null && prevStem != null && n <= prevStem) {
        block += 1;
      }
      if (n != null) prevStem = n;
      blockOf.set(row.q, block);
    }
  }

  const used = new Map<string, number>();
  const out: Array<T & { section: string | null; canonical_key: string }> = [];

  for (const row of provisional) {
    let section = row.section;
    if (!section && hasBareCollision) {
      const b = blockOf.get(row.q);
      if (b != null) section = `BLK${b}`;
    }

    const baseKey =
      buildCanonicalQuestionKey({
        section,
        questionNumber: row.questionNumber,
      }) ?? row.questionNumber;

    const next = (used.get(baseKey) ?? 0) + 1;
    used.set(baseKey, next);
    const canonical_key =
      buildCanonicalQuestionKey({
        section,
        questionNumber: row.questionNumber,
        collisionIndex: next,
      }) ?? `${baseKey}~${next}`;

    out.push({
      ...row.q,
      question_number: row.questionNumber,
      section,
      canonical_key,
    });
  }

  return out;
}
