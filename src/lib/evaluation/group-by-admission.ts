import { normalizeAdmissionNumber } from "@/lib/evaluation/normalize-admission";
import { shouldEscalateAdmission } from "@/lib/evaluation/escalate";
import type { IndexResult } from "@/lib/evaluation/index-schema";
import type { EvaluatedScriptStatus } from "@/types/database";

export type RosterStudent = {
  id: string;
  admission_number: string | null;
  full_name: string;
};

export type PageWithIndex = {
  pageId: string;
  storagePath: string;
  fileName: string;
  uploadIndex: number;
  contentHash: string;
  index: IndexResult;
};

export type GroupedScript = {
  groupKey: string;
  admissionNumber: string | null;
  studentId: string | null;
  matchConfidence: "high" | "low" | null;
  status: Extract<
    EvaluatedScriptStatus,
    "identity_amber" | "evaluating" | "unmatched"
  >;
  pages: PageWithIndex[];
  hasAdmissionCollision: boolean;
};

function buildRosterMap(roster: RosterStudent[]): Map<string, RosterStudent> {
  const map = new Map<string, RosterStudent>();
  for (const student of roster) {
    const key = normalizeAdmissionNumber(student.admission_number);
    if (key) map.set(key, student);
  }
  return map;
}

function sortPages(pages: PageWithIndex[]): PageWithIndex[] {
  return [...pages].sort((a, b) => {
    const pa = a.index.page_number ?? a.uploadIndex;
    const pb = b.index.page_number ?? b.uploadIndex;
    return pa - pb;
  });
}

/**
 * Group indexed pages by admission number with amber/unmatched rules.
 */
export function groupPagesByAdmission(input: {
  pages: PageWithIndex[];
  roster: RosterStudent[];
}): GroupedScript[] {
  const rosterMap = buildRosterMap(input.roster);
  const byAdmission = new Map<string, PageWithIndex[]>();
  const unmatched: PageWithIndex[] = [];

  for (const page of input.pages) {
    const raw = page.index.admission_number?.trim() ?? "";
    const normalized = normalizeAdmissionNumber(raw);
    if (!normalized || shouldEscalateAdmission(page.index.admission_confidence)) {
      unmatched.push(page);
      continue;
    }
    const list = byAdmission.get(normalized) ?? [];
    list.push(page);
    byAdmission.set(normalized, list);
  }

  const groups: GroupedScript[] = [];

  for (const [admissionKey, pages] of byAdmission.entries()) {
    const student = rosterMap.get(admissionKey) ?? null;
    const sorted = sortPages(pages);
    const lowConfidence = sorted.some((p) =>
      shouldEscalateAdmission(p.index.admission_confidence)
    );

    groups.push({
      groupKey: admissionKey,
      admissionNumber: admissionKey,
      studentId: student?.id ?? null,
      matchConfidence: student ? (lowConfidence ? "low" : "high") : null,
      status: !student || lowConfidence ? "identity_amber" : "evaluating",
      pages: sorted,
      hasAdmissionCollision: false,
    });
  }

  // Detect duplicate admission groups (same number on unrelated uploads)
  const admissionCounts = new Map<string, number>();
  for (const g of groups) {
    admissionCounts.set(g.groupKey, (admissionCounts.get(g.groupKey) ?? 0) + 1);
  }
  for (const g of groups) {
    if ((admissionCounts.get(g.groupKey) ?? 0) > 1) {
      g.hasAdmissionCollision = true;
      g.status = "identity_amber";
      g.matchConfidence = "low";
    }
  }

  if (unmatched.length) {
    groups.push({
      groupKey: `unmatched:${unmatched[0]!.pageId}`,
      admissionNumber: null,
      studentId: null,
      matchConfidence: null,
      status: "unmatched",
      pages: sortPages(unmatched),
      hasAdmissionCollision: false,
    });
  }

  return groups;
}
