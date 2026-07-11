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
  contentHash?: string;
  duplicate?: boolean;
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

/** Same admission + same question number on two pages (AC-5.12). */
function markQuestionConflicts(pages: EvaluatedScriptPage[]): boolean {
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
 * Byte-identical pages (shared contentHash or duplicate flag + same path).
 * Fires even when question numbers are empty.
 */
function markByteDuplicateConflicts(pages: EvaluatedScriptPage[]): boolean {
  const byHash = new Map<string, EvaluatedScriptPage[]>();
  const byPath = new Map<string, EvaluatedScriptPage[]>();

  for (const page of pages) {
    if (page.contentHash) {
      const list = byHash.get(page.contentHash) ?? [];
      list.push(page);
      byHash.set(page.contentHash, list);
    }
    const pathList = byPath.get(page.storagePath) ?? [];
    pathList.push(page);
    byPath.set(page.storagePath, pathList);
  }

  let hasConflict = false;

  for (const group of byHash.values()) {
    if (group.length < 2) continue;
    for (const page of group) {
      page.conflict = true;
      hasConflict = true;
    }
  }

  for (const group of byPath.values()) {
    if (group.length < 2) continue;
    for (const page of group) {
      page.conflict = true;
      hasConflict = true;
    }
  }

  // Explicit duplicate flag with at least one peer on the same path
  for (const page of pages) {
    if (!page.duplicate) continue;
    const peers = byPath.get(page.storagePath) ?? [];
    if (peers.length >= 2) {
      page.conflict = true;
      hasConflict = true;
    }
  }

  return hasConflict;
}

/**
 * Group vision-read pages by admission number against the class roster.
 * Physical upload order is ignored for grouping; pages within a group sort by question number.
 *
 * Byte-identical pages (same contentHash / storagePath) stay linked even when one
 * page lacks a readable admission number — they share a bucket and conflict.
 */
export function groupPagesByAdmission(
  pages: PageIdentityInput[],
  roster: RosterStudent[]
): GroupedScriptDraft[] {
  const rosterMap = buildRosterMap(roster);

  // Prefer an admission read from any sibling that shares hash/path (vision may
  // only succeed on one copy when paths differ, or when hashing links copies).
  const admissionByHash = new Map<string, string>();
  const admissionByPath = new Map<string, string>();
  for (const page of pages) {
    const normalized = normalizeAdmissionNumber(page.admissionNumber);
    if (!normalized) continue;
    if (page.contentHash && !admissionByHash.has(page.contentHash)) {
      admissionByHash.set(page.contentHash, normalized);
    }
    if (!admissionByPath.has(page.storagePath)) {
      admissionByPath.set(page.storagePath, normalized);
    }
  }

  const buckets = new Map<string, PageIdentityInput[]>();

  for (const page of pages) {
    const own = normalizeAdmissionNumber(page.admissionNumber);
    const inherited =
      own ??
      (page.contentHash ? admissionByHash.get(page.contentHash) : undefined) ??
      admissionByPath.get(page.storagePath) ??
      null;

    // Identical unmatched blobs share one bucket (not per-uploadIndex).
    const groupKey =
      inherited ??
      (page.contentHash
        ? `__unmatched_hash__:${page.contentHash}`
        : `__unmatched_path__:${page.storagePath}`);

    const list = buckets.get(groupKey) ?? [];
    list.push(page);
    buckets.set(groupKey, list);
  }

  const drafts: GroupedScriptDraft[] = [];

  for (const [groupKey, groupPages] of buckets) {
    const isUnmatched =
      groupKey.startsWith("__unmatched_hash__:") ||
      groupKey.startsWith("__unmatched_path__:");
    const readAdmission = isUnmatched
      ? null
      : normalizeAdmissionNumber(groupKey);
    const rosterHit = readAdmission ? rosterMap.get(readAdmission) : undefined;

    const pageOrder: EvaluatedScriptPage[] = groupPages.map((p) => ({
      storagePath: p.storagePath,
      fileName: p.fileName,
      uploadIndex: p.uploadIndex,
      contentHash: p.contentHash,
      duplicate: p.duplicate,
      questionNumbers: [...p.questionNumbers].sort((a, b) => a - b),
      readAdmissionNumber: normalizeAdmissionNumber(p.admissionNumber),
    }));

    pageOrder.sort((a, b) => {
      const qa = primaryQuestion(a);
      const qb = primaryQuestion(b);
      if (qa !== qb) return qa - qb;
      return a.uploadIndex - b.uploadIndex;
    });

    const qConflict = markQuestionConflicts(pageOrder);
    const byteConflict = markByteDuplicateConflicts(pageOrder);
    // Inherited admission onto a page that itself had none → treat as conflict
    // so teacher confirms (one copy lacked a readable ID).
    const inheritedConflict = pageOrder.some(
      (p) =>
        !normalizeAdmissionNumber(p.readAdmissionNumber) &&
        Boolean(readAdmission) &&
        pageOrder.length > 1
    );
    if (inheritedConflict) {
      for (const page of pageOrder) {
        page.conflict = true;
      }
    }
    const hasConflict = qConflict || byteConflict || inheritedConflict;
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

  // Cross-draft pass: same hash/path split across groups (defensive).
  markCrossDraftByteConflicts(drafts);

  drafts.sort((a, b) => {
    const aIdx = Math.min(...a.page_order.map((p) => p.uploadIndex));
    const bIdx = Math.min(...b.page_order.map((p) => p.uploadIndex));
    return aIdx - bIdx;
  });

  return drafts;
}

function markCrossDraftByteConflicts(drafts: GroupedScriptDraft[]): void {
  const hashDrafts = new Map<string, GroupedScriptDraft[]>();
  const pathDrafts = new Map<string, GroupedScriptDraft[]>();

  for (const draft of drafts) {
    const seenHash = new Set<string>();
    const seenPath = new Set<string>();
    for (const page of draft.page_order) {
      if (page.contentHash && !seenHash.has(page.contentHash)) {
        seenHash.add(page.contentHash);
        const list = hashDrafts.get(page.contentHash) ?? [];
        list.push(draft);
        hashDrafts.set(page.contentHash, list);
      }
      if (!seenPath.has(page.storagePath)) {
        seenPath.add(page.storagePath);
        const list = pathDrafts.get(page.storagePath) ?? [];
        list.push(draft);
        pathDrafts.set(page.storagePath, list);
      }
    }
  }

  const touch = (list: GroupedScriptDraft[], key: "contentHash" | "path", value: string) => {
    if (list.length < 2) return;
    for (const draft of list) {
      draft.hasConflict = true;
      draft.status = "identity_amber";
      draft.match_confidence = "low";
      draft.student_id = null;
      for (const page of draft.page_order) {
        if (
          (key === "contentHash" && page.contentHash === value) ||
          (key === "path" && page.storagePath === value)
        ) {
          page.conflict = true;
        }
      }
    }
  };

  for (const [hash, list] of hashDrafts) touch(list, "contentHash", hash);
  for (const [path, list] of pathDrafts) touch(list, "path", path);
}

export function scriptHasMissingPageWarning(
  pageOrder: EvaluatedScriptPage[]
): boolean {
  return hasQuestionGap(pageOrder.flatMap((p) => p.questionNumbers ?? []));
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
