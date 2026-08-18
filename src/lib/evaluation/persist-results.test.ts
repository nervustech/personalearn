import { describe, expect, it, vi } from "vitest";
import {
  resolveScriptIdentityOnUpsert,
  upsertScriptFromGroup,
} from "./persist-results";
import type { GroupedScript } from "./group-by-admission";

function group(overrides: Partial<GroupedScript> = {}): GroupedScript {
  return {
    groupKey: "ADM001",
    admissionNumber: "ADM001",
    studentId: "stu-1",
    matchConfidence: "high",
    status: "evaluating",
    hasAdmissionCollision: false,
    pages: [
      {
        pageId: "page-1",
        storagePath: "scans/a.jpg",
        fileName: "a.jpg",
        uploadIndex: 0,
        contentHash: "abc",
        index: {
          admission_number: "ADM001",
          admission_confidence: 0.95,
          page_number: 1,
          total_pages: 1,
          questions_found: ["1"],
        },
      },
    ],
    ...overrides,
  };
}

describe("upsertScriptFromGroup", () => {
  it("updates an existing script matched by admission number", async () => {
    const update = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    const insert = vi.fn();

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "evaluated_scripts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: "script-existing" },
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
            update,
            insert,
          };
        }
        return {
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }),
    };

    const id = await upsertScriptFromGroup(supabase as never, {
      batchId: "batch-1",
      group: group({ studentId: null }),
    });

    expect(id).toBe("script-existing");
    expect(insert).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
  });

  it("inserts when no matching script exists in the batch", async () => {
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: "script-new" },
          error: null,
        }),
      })),
    }));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "evaluated_scripts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: null,
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
            insert,
          };
        }
        return {
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }),
    };

    const id = await upsertScriptFromGroup(supabase as never, {
      batchId: "batch-1",
      group: group(),
    });

    expect(id).toBe("script-new");
    expect(insert).toHaveBeenCalled();
  });
});

describe("resolveScriptIdentityOnUpsert", () => {
  const unmatchedGroup = {
    studentId: null,
    status: "unmatched" as const,
    matchConfidence: null,
    admissionNumber: null,
  };

  it("keeps a settled student when regroup would drop identity", () => {
    const next = resolveScriptIdentityOnUpsert({
      existing: {
        student_id: "stu-1",
        status: "evaluating",
        match_confidence: "high",
        read_admission_number: "1196",
      },
      group: unmatchedGroup,
    });

    expect(next).toEqual({
      studentId: "stu-1",
      status: "evaluating",
      matchConfidence: "high",
      admissionNumber: "1196",
    });
  });

  it("upgrades unmatched to evaluating when the roster later matches", () => {
    const next = resolveScriptIdentityOnUpsert({
      existing: {
        student_id: null,
        status: "unmatched",
        match_confidence: null,
        read_admission_number: null,
      },
      group: {
        studentId: "stu-1",
        status: "evaluating",
        matchConfidence: "high",
        admissionNumber: "1196",
      },
    });

    expect(next.status).toBe("evaluating");
    expect(next.studentId).toBe("stu-1");
  });
});
