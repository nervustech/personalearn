import { describe, expect, it } from "vitest";
import { groupPagesByAdmission } from "@/lib/evaluation/group-by-admission";
import type { PageWithIndex, RosterStudent } from "@/lib/evaluation/group-by-admission";
import type { IndexResult } from "@/lib/evaluation/index-schema";

const roster: RosterStudent[] = [
  { id: "stu-1", admission_number: "1196", full_name: "Ada" },
  { id: "stu-2", admission_number: "1990", full_name: "Ben" },
];

function page(
  id: string,
  admission: string | null,
  confidence: number,
  extra: Partial<PageWithIndex> = {}
): PageWithIndex {
  const index: IndexResult = {
    admission_number: admission,
    admission_confidence: confidence,
    page_number: extra.index?.page_number ?? 1,
    total_pages: 1,
    questions_found: extra.index?.questions_found ?? ["1"],
  };
  return {
    pageId: id,
    storagePath: `${id}.jpg`,
    fileName: extra.fileName ?? `${id}.jpg`,
    uploadIndex: extra.uploadIndex ?? 0,
    contentHash: id,
    index,
    ...extra,
  };
}

describe("groupPagesByAdmission", () => {
  it("auto-proceeds roster matches even when model confidence is low", () => {
    const groups = groupPagesByAdmission({
      pages: [page("p1", "1196", 0.4), page("p2", "1196", 0.55)],
      roster,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      studentId: "stu-1",
      status: "evaluating",
      matchConfidence: "high",
      admissionNumber: "1196",
    });
    expect(groups[0]!.pages.map((p) => p.pageId)).toEqual(["p1", "p2"]);
  });

  it("matches punctuation and ADM prefixes to the roster digit core", () => {
    const groups = groupPagesByAdmission({
      pages: [page("p1", "ADM-1196", 0.5)],
      roster,
    });

    expect(groups[0]).toMatchObject({
      studentId: "stu-1",
      status: "evaluating",
      matchConfidence: "high",
    });
  });

  it("flags unknown admission numbers amber with the read value", () => {
    const groups = groupPagesByAdmission({
      pages: [page("p1", "8888", 0.95)],
      roster,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      studentId: null,
      status: "identity_amber",
      matchConfidence: "low",
      admissionNumber: "8888",
    });
  });

  it("puts pages with no admission number in unmatched", () => {
    const groups = groupPagesByAdmission({
      pages: [page("p1", null, 0.2), page("p2", "  ", 0.9)],
      roster,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      status: "unmatched",
      studentId: null,
      admissionNumber: null,
    });
    expect(groups[0]!.pages).toHaveLength(2);
  });

  it("does not treat low confidence as unmatched when a number was read", () => {
    const groups = groupPagesByAdmission({
      pages: [page("p1", "1196", 0.2)],
      roster,
    });

    expect(groups.some((g) => g.status === "unmatched")).toBe(false);
    expect(groups[0]?.status).toBe("evaluating");
  });

  it("splits different students and auto-proceeds each roster hit", () => {
    const groups = groupPagesByAdmission({
      pages: [
        page("p1", "1196", 0.6, { uploadIndex: 0 }),
        page("p2", "1990", 0.61, { uploadIndex: 1 }),
      ],
      roster,
    });

    const byStudent = new Map(groups.map((g) => [g.studentId, g]));
    expect(byStudent.get("stu-1")?.status).toBe("evaluating");
    expect(byStudent.get("stu-2")?.status).toBe("evaluating");
  });
});
