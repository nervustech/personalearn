import {
  hasIntegerQuestionGap,
  normalizeQuestionLabel,
} from "@/lib/evaluation/normalize-question";
import type { EvaluatedScriptPage } from "@/types/database";

function coerceLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeQuestionLabel(item))
    .filter((x): x is string => Boolean(x));
}

export function scriptHasMissingPageWarning(
  pageOrder: EvaluatedScriptPage[]
): boolean {
  return hasIntegerQuestionGap(
    pageOrder.flatMap((p) => coerceLabels(p.questionNumbers))
  );
}

export function scriptHasConflict(pageOrder: EvaluatedScriptPage[]): boolean {
  return pageOrder.some((p) => p.conflict);
}

export function scriptHasByteDuplicate(pageOrder: EvaluatedScriptPage[]): boolean {
  const hashes = new Map<string, number>();
  const paths = new Map<string, number>();
  for (const page of pageOrder) {
    if (page.duplicate) return true;
    if (page.contentHash) {
      hashes.set(page.contentHash, (hashes.get(page.contentHash) ?? 0) + 1);
    }
    paths.set(page.storagePath, (paths.get(page.storagePath) ?? 0) + 1);
  }
  return (
    [...hashes.values()].some((c) => c > 1) ||
    [...paths.values()].some((c) => c > 1)
  );
}
