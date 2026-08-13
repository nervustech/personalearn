import { beforeEach, describe, expect, it, vi } from "vitest";
import { reevaluateScriptQuestion } from "./reevaluate-question";
import { computeScriptTotal } from "./script-totals";

const mockSyncEvaluate = vi.fn();
const mockLoadScheme = vi.fn();

vi.mock("@/lib/evaluation/sync-client", () => ({
  syncEvaluateScript: (...args: unknown[]) => mockSyncEvaluate(...args),
}));

vi.mock("@/lib/evaluation/load-marking-scheme", () => ({
  loadMarkingSchemeText: (...args: unknown[]) => mockLoadScheme(...args),
}));

vi.mock("@/lib/evaluation/page-images", () => ({
  asScriptPages: (pageOrder: unknown) =>
    Array.isArray(pageOrder) ? pageOrder : [],
  pagesForQuestion: (pages: unknown[]) => pages,
  mimeFromStoragePath: () => "image/jpeg",
  downloadPageBytes: vi.fn(async () => ({
    bytes: new Uint8Array([1]),
    mimeType: "image/jpeg",
  })),
}));

describe("reevaluateScriptQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadScheme.mockResolvedValue("scheme text");
    mockSyncEvaluate.mockResolvedValue({
      result: {
        questions: [
          {
            question_number: "1",
            awarded: 4,
            max: 5,
            suggested_feedback: "revised",
            student_work: { text: "student revised answer" },
            correct_reference: { text: "correct answer" },
            status: "correct",
            confidence: 0.9,
          },
        ],
      },
      modelId: "gemini-test",
    });
  });

  it("updates only the target question and recomputes total", async () => {
    const questionsAfter = [
      {
        id: "q1",
        script_id: "script-1",
        question_number: "1",
        awarded: 4,
        max: 5,
        feedback: "revised",
        status: "reevaluated",
      },
      {
        id: "q2",
        script_id: "script-1",
        question_number: "2",
        awarded: 3,
        max: 5,
        feedback: "good",
        status: "ai_draft",
      },
    ];

    const existingQuestion = {
      id: "q1",
      script_id: "script-1",
      question_number: "1",
      awarded: 2,
      max: 5,
      feedback: "ok",
      status: "ai_draft",
    };

    const supabase = {
      from(table: string) {
        if (table === "evaluated_scripts") {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        maybeSingle: async () => ({
                          data: {
                            id: "script-1",
                            batch_id: "batch-1",
                            status: "ready",
                            page_order: [
                              {
                                storagePath: "a/b.jpg",
                                fileName: "a.jpg",
                                uploadIndex: 0,
                                questionNumbers: ["1", "2"],
                              },
                            ],
                          },
                          error: null,
                        }),
                      };
                    },
                  };
                },
              };
            },
          };
        }

        if (table === "question_evaluations") {
          return {
            select(_cols?: string) {
              const filter: {
                _mode: "one" | "all";
                eq: (col: string, val: string) => typeof filter;
                maybeSingle: () => Promise<{ data: unknown; error: null }>;
                then: (
                  resolve: (v: { data: unknown; error: null }) => unknown
                ) => Promise<unknown>;
              } = {
                _mode: "all",
                eq(_col: string, _val: string) {
                  if (_col === "id") filter._mode = "one";
                  return filter;
                },
                maybeSingle: async () => ({
                  data: existingQuestion,
                  error: null,
                }),
                then(resolve) {
                  return Promise.resolve(
                    resolve({
                      data: filter._mode === "one" ? existingQuestion : questionsAfter,
                      error: null,
                    })
                  );
                },
              };
              return filter;
            },
            update() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        select() {
                          return {
                            single: async () => ({
                              data: questionsAfter[0],
                              error: null,
                            }),
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }

        if (table === "evaluation_batches") {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({
                      data: {
                        id: "batch-1",
                        class_id: "class-1",
                        assessment_id: "assess-1",
                        marking_scheme_resource_id: "scheme-1",
                      },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        }

        if (table === "assessments") {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({
                      data: {
                        linked_strand: "Numbers",
                        linked_sub_strand: null,
                      },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        }

        if (table === "classes") {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({
                      data: { subject: "Mathematics" },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    };

    const result = await reevaluateScriptQuestion(supabase as never, {
      batchId: "batch-1",
      scriptId: "script-1",
      questionId: "q1",
      instruction: "award method marks",
    });

    expect(mockSyncEvaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        questionFocus: "1",
        markingScheme: expect.stringContaining("award method marks"),
      })
    );
    expect(result.question.status).toBe("reevaluated");
    expect(result.question.awarded).toBe(4);
    expect(result.questions).toHaveLength(2);
    expect(result.questions.find((q) => q.id === "q2")?.status).toBe(
      "ai_draft"
    );
    expect(result.totals).toEqual(computeScriptTotal(questionsAfter));
    expect(result.competencyPreview?.status).toBe("developing");
  });

  it("rejects signed_off scripts", async () => {
    const supabase = {
      from(table: string) {
        if (table === "evaluated_scripts") {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        maybeSingle: async () => ({
                          data: {
                            id: "script-1",
                            batch_id: "batch-1",
                            status: "signed_off",
                            page_order: [],
                          },
                          error: null,
                        }),
                      };
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error(table);
      },
    };

    await expect(
      reevaluateScriptQuestion(supabase as never, {
        batchId: "batch-1",
        scriptId: "script-1",
        questionId: "q1",
      })
    ).rejects.toThrow(/signed off/i);
    expect(mockSyncEvaluate).not.toHaveBeenCalled();
  });
});
