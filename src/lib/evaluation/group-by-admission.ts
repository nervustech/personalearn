import {
  admissionLookupKeys,
  compactAdmissionNumber,
  normalizeAdmissionNumber,
} from "@/lib/evaluation/normalize-admission";
import type { IndexResult } from "@/lib/evaluation/index-schema";
import { sheetPageFromFileName } from "@/lib/evaluation/page-images";
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

function buildRosterLookup(
  roster: RosterStudent[]
): (raw: string | null | undefined) => RosterStudent | null {
  const byKey = new Map<string, RosterStudent | "ambiguous">();

  for (const student of roster) {
    for (const key of admissionLookupKeys(student.admission_number)) {
      const existing = byKey.get(key);
      if (existing && existing !== student) {
        byKey.set(key, "ambiguous");
      } else if (!existing) {
        byKey.set(key, student);
      }
    }
  }

  return (raw) => {
    for (const key of admissionLookupKeys(raw)) {
      const hit = byKey.get(key);
      if (hit && hit !== "ambiguous") return hit;
    }
    return null;
  };
}

function sortPages(pages: PageWithIndex[]): PageWithIndex[] {
  return [...pages].sort((a, b) => {
    // Prefer filename sheet order (1196.1 before 1196.2) so evaluate packets
    // match booklet page numbers teachers expect in review.
    const fa = sheetPageFromFileName(a.fileName);
    const fb = sheetPageFromFileName(b.fileName);
    if (fa != null && fb != null && fa !== fb) return fa - fb;
    const pa = a.index.page_number ?? a.uploadIndex;
    const pb = b.index.page_number ?? b.uploadIndex;
    return pa - pb;
  });
}

/**
 * Group indexed pages by admission number.
 *
 * Roster hits auto-proceed to grading (PSL-108). Model-reported confidence is
 * not a teacher-confirm gate — amber only when the number is missing, not on
 * the roster, or collides across students.
 */
export function groupPagesByAdmission(input: {
  pages: PageWithIndex[];
  roster: RosterStudent[];
}): GroupedScript[] {
  const lookup = buildRosterLookup(input.roster);
  const byKey = new Map<string, PageWithIndex[]>();
  const studentByKey = new Map<string, RosterStudent | null>();
  const unmatched: PageWithIndex[] = [];

  for (const page of input.pages) {
    const raw = page.index.admission_number?.trim() ?? "";
    const normalized = normalizeAdmissionNumber(raw);
    if (!normalized) {
      unmatched.push(page);
      continue;
    }
    const student = lookup(raw);
    const groupKey =
      student?.id ?? compactAdmissionNumber(normalized) ?? normalized;
    const list = byKey.get(groupKey) ?? [];
    list.push(page);
    byKey.set(groupKey, list);
    if (!studentByKey.has(groupKey)) studentByKey.set(groupKey, student);
  }

  const groups: GroupedScript[] = [];

  for (const [groupKey, pages] of byKey.entries()) {
    const student = studentByKey.get(groupKey) ?? null;
    const sorted = sortPages(pages);
    const admissionNumber =
      normalizeAdmissionNumber(student?.admission_number) ??
      compactAdmissionNumber(sorted[0]?.index.admission_number) ??
      groupKey;

    groups.push({
      groupKey,
      admissionNumber,
      studentId: student?.id ?? null,
      matchConfidence: student ? "high" : "low",
      status: student ? "evaluating" : "identity_amber",
      pages: sorted,
      hasAdmissionCollision: false,
    });
  }

  const admissionCounts = new Map<string, number>();
  for (const g of groups) {
    if (!g.admissionNumber) continue;
    admissionCounts.set(
      g.admissionNumber,
      (admissionCounts.get(g.admissionNumber) ?? 0) + 1
    );
  }
  for (const g of groups) {
    if (!g.admissionNumber) continue;
    if ((admissionCounts.get(g.admissionNumber) ?? 0) > 1) {
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
