import { normalizeAdmissionNumber } from "@/lib/evaluation/normalize-admission";
import type {
  EvaluatedScriptPage,
  EvaluatedScriptStatus,
} from "@/types/database";

export type RosterStudent = {
  id: string;
  admission_number: string | null;
  full_name: string;
};

export type PageIdentityInput = {
  storagePath: string;
  fileName: string;
  uploadIndex: number;
  admissionNumber: string | null;
  questionNumbers: number[];
};

export type GroupedScriptDraft = {
  /** Stable key for grouping (normalized admission or unmatched:<uploadIndex>). */
  groupKey: string;
  student_id: string | null;
  read_admission_number: string | null;
  match_confidence: "high" | "low";
  status: Extract<EvaluatedScriptStatus, "identity_amber" | "identity_cleared">;
  page_order: EvaluatedScriptPage[];
  missingPageWarning: boolean;
  hasConflict: boolean;
};

function buildRosterMap(roster: RosterStudent[]): Map<string, RosterStudent> {
  const map = new Map<string, RosterStudent>();
  for (const student of roster) {
    const key = normalizeAdmissionNumber(student.admission_number);
    if (key) map.set(key, student);
  }
  return map;
}

function primaryQuestion(page: EvaluatedScriptPage): number {
  const nums = page.questionNumbers ?? [];
  return nums.length ? Math.min(...nums) : Number.POSITIVE_INFINITY;
}

function hasQuestionGap(questionNumbers: number[]): boolean {
  const unique = [...new Set(questionNumbers)].sort((a, b) => a - b);
  if (unique.length < 2) return false;
  for (let i = 1; i < unique.length; i++) {
    if (unique[i]! - unique[i - 1]! > 1) return true;
  }
  return false;
}

function markConflicts(pages: EvaluatedScriptPage[]): boolean {
  const seen = new Map<number, number>();
  let hasConflict = false;
  for (const page of pages) {
    for (const q of page.questionNumbers ?? []) {
      seen.set(q, (seen.get(q) ?? 0) + 1);
    }
  }
  const conflictQuestions = new Set(
    [...seen.entries()].filter(([, count]) => count > 1).map(([q]) => q)
  );
  if (conflictQuestions.size === 0) return false;

  for (const page of pages) {
    if ((page.questionNumbers ?? []).some((q) => conflictQuestions.has(q))) {
      page.conflict = true;
      hasConflict = true;
    }
  }
  return hasConflict;
}

/**
 * Group vision-read pages by admission number against the class roster.
 * Physical upload order is ignored for grouping; pages within a group sort by question number.
 */
export function groupPagesByAdmission(
  pages: PageIdentityInput[],
  roster: RosterStudent[]
): GroupedScriptDraft[] {
  const rosterMap = buildRosterMap(roster);
  const buckets = new Map<string, PageIdentityInput[]>();

  for (const page of pages) {
    const normalized = normalizeAdmissionNumber(page.admissionNumber);
    const groupKey = normalized ?? `__unmatched__:${page.uploadIndex}`;
    const list = buckets.get(groupKey) ?? [];
    list.push(page);
    buckets.set(groupKey, list);
  }

  const drafts: GroupedScriptDraft[] = [];

  for (const [groupKey, groupPages] of buckets) {
    const isUnmatched = groupKey.startsWith("__unmatched__:");
    const readAdmission = isUnmatched
      ? null
      : normalizeAdmissionNumber(groupPages[0]?.admissionNumber);
    const rosterHit = readAdmission ? rosterMap.get(readAdmission) : undefined;

    const pageOrder: EvaluatedScriptPage[] = groupPages.map((p) => ({
      storagePath: p.storagePath,
      fileName: p.fileName,
      uploadIndex: p.uploadIndex,
      questionNumbers: [...p.questionNumbers].sort((a, b) => a - b),
      readAdmissionNumber: normalizeAdmissionNumber(p.admissionNumber),
    }));

    pageOrder.sort((a, b) => {
      const qa = primaryQuestion(a);
      const qb = primaryQuestion(b);
      if (qa !== qb) return qa - qb;
      return a.uploadIndex - b.uploadIndex;
    });

    const hasConflict = markConflicts(pageOrder);
    const allQuestions = pageOrder.flatMap((p) => p.questionNumbers ?? []);
    const missingPageWarning = hasQuestionGap(allQuestions);

    const highMatch = Boolean(rosterHit) && !hasConflict && !isUnmatched;
    drafts.push({
      groupKey,
      student_id: highMatch ? rosterHit!.id : null,
      read_admission_number: readAdmission,
      match_confidence: highMatch ? "high" : "low",
      status: highMatch ? "identity_cleared" : "identity_amber",
      page_order: pageOrder,
      missingPageWarning,
      hasConflict,
    });
  }

  drafts.sort((a, b) => {
    const aIdx = Math.min(...a.page_order.map((p) => p.uploadIndex));
    const bIdx = Math.min(...b.page_order.map((p) => p.uploadIndex));
    return aIdx - bIdx;
  });

  return drafts;
}

export function scriptHasMissingPageWarning(
  pageOrder: EvaluatedScriptPage[]
): boolean {
  return hasQuestionGap(pageOrder.flatMap((p) => p.questionNumbers ?? []));
}

export function scriptHasConflict(pageOrder: EvaluatedScriptPage[]): boolean {
  return pageOrder.some((p) => p.conflict);
}
