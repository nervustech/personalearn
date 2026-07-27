import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEvaluationBatch } from "./batches";
import { ALREADY_EVALUATED_MESSAGE } from "./assessment-eval-guard";

vi.mock("@/lib/evaluation/create-assessment-from-resource", () => ({
  ensureAssessmentForGradableResource: vi.fn(),
  ensureAssessmentsForClassGradableResources: vi.fn().mockResolvedValue(0),
  shouldPublishAssessment: vi.fn((type: string) =>
    ["assignment", "quiz", "examination"].includes(type)
  ),
}));

vi.mock("@/lib/evaluation/assessment-eval-guard", async () => {
  const actual = await vi.importActual<
    typeof import("./assessment-eval-guard")
  >("./assessment-eval-guard");
  return {
    ...actual,
    findOpenBatchForAssessment: vi.fn().mockResolvedValue(null),
    getStudentAssessmentEvalState: vi.fn().mockResolvedValue({
      hasSubmission: false,
      priorBatchId: null,
    }),
  };
});

import { ensureAssessmentForGradableResource } from "./create-assessment-from-resource";
import {
  findOpenBatchForAssessment,
  getStudentAssessmentEvalState,
} from "./assessment-eval-guard";

const mockEnsure = vi.mocked(ensureAssessmentForGradableResource);
const mockFindOpen = vi.mocked(findOpenBatchForAssessment);
const mockStudentState = vi.mocked(getStudentAssessmentEvalState);

describe("createEvaluationBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindOpen.mockResolvedValue(null);
    mockStudentState.mockResolvedValue({
      hasSubmission: false,
      priorBatchId: null,
    });
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

    const result = await createEvaluationBatch(supabase as never, {
      classId: "class-1",
      assessmentId: "assess-1",
      proceedWithoutScheme: true,
    });

    expect(result.batch.id).toBe("batch-1");
    expect(result.reused).toBe(false);
    expect(insert).toHaveBeenCalledWith({
      class_id: "class-1",
      assessment_id: "assess-1",
      marking_scheme_resource_id: null,
      scoped_student_id: null,
      status: "draft",
    });
    expect(mockEnsure).not.toHaveBeenCalled();
  });

  it("reuses an existing open batch for the same assessment", async () => {
    mockFindOpen.mockResolvedValue({
      id: "batch-open",
      class_id: "class-1",
      assessment_id: "assess-1",
      marking_scheme_resource_id: null,
      scoped_student_id: null,
      status: "in_review",
      created_at: "2026-07-25T00:00:00Z",
    });

    const insert = vi.fn();
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

    const result = await createEvaluationBatch(supabase as never, {
      classId: "class-1",
      assessmentId: "assess-1",
      proceedWithoutScheme: true,
    });

    expect(result.reused).toBe(true);
    expect(result.batch.id).toBe("batch-open");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects N=1 when the student was already evaluated", async () => {
    mockStudentState.mockResolvedValue({
      hasSubmission: true,
      priorBatchId: null,
    });

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
        if (table === "students") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "stu-1" },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        return {};
      }),
    };

    await expect(
      createEvaluationBatch(supabase as never, {
        classId: "class-1",
        assessmentId: "assess-1",
        proceedWithoutScheme: true,
        studentId: "stu-1",
      })
    ).rejects.toThrow(ALREADY_EVALUATED_MESSAGE);
  });

  it("stores scoped_student_id when student belongs to the class", async () => {
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "batch-2",
            class_id: "class-1",
            assessment_id: "assess-1",
            marking_scheme_resource_id: null,
            scoped_student_id: "stu-1",
            status: "draft",
            created_at: "2026-07-16T00:00:00Z",
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
        if (table === "students") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "stu-1" },
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

    const result = await createEvaluationBatch(supabase as never, {
      classId: "class-1",
      assessmentId: "assess-1",
      proceedWithoutScheme: true,
      studentId: "stu-1",
    });

    expect(result.batch.scoped_student_id).toBe("stu-1");
    expect(result.reused).toBe(false);
    expect(insert).toHaveBeenCalledWith({
      class_id: "class-1",
      assessment_id: "assess-1",
      marking_scheme_resource_id: null,
      scoped_student_id: "stu-1",
      status: "draft",
    });
  });

  it("rejects studentId from another class", async () => {
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
        return {
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
        };
      }),
    };

    await expect(
      createEvaluationBatch(supabase as never, {
        classId: "class-1",
        assessmentId: "assess-1",
        proceedWithoutScheme: true,
        studentId: "foreign-stu",
      })
    ).rejects.toThrow("Student not found in this class");
  });
});
