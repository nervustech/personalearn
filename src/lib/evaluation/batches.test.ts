import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEvaluationBatch } from "./batches";

vi.mock("@/lib/evaluation/create-assessment-from-resource", () => ({
  ensureAssessmentForGradableResource: vi.fn(),
  shouldPublishAssessment: vi.fn((type: string) =>
    ["assignment", "quiz", "examination"].includes(type)
  ),
}));

import { ensureAssessmentForGradableResource } from "./create-assessment-from-resource";

const mockEnsure = vi.mocked(ensureAssessmentForGradableResource);

describe("createEvaluationBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects assessmentId that does not belong to the class", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          })),
        })),
      })),
    };

    await expect(
      createEvaluationBatch(supabase as never, {
        classId: "class-1",
        assessmentId: "foreign-assess",
        proceedWithoutScheme: true,
      })
    ).rejects.toThrow("Assessment not found");
  });

  it("creates a draft batch when assessment belongs to the class", async () => {
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "batch-1",
            class_id: "class-1",
            assessment_id: "assess-1",
            marking_scheme_resource_id: null,
            status: "draft",
            created_at: "2026-07-09T00:00:00Z",
          },
          error: null,
        }),
      })),
    }));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "assessments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "assess-1" },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        return { insert };
      }),
    };

    const batch = await createEvaluationBatch(supabase as never, {
      classId: "class-1",
      assessmentId: "assess-1",
      proceedWithoutScheme: true,
    });

    expect(batch.id).toBe("batch-1");
    expect(insert).toHaveBeenCalledWith({
      class_id: "class-1",
      assessment_id: "assess-1",
      marking_scheme_resource_id: null,
      status: "draft",
    });
    expect(mockEnsure).not.toHaveBeenCalled();
  });
});
