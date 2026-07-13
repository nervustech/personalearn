import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateQuestionEvaluation } from "./update-question";

type QuestionRow = {
  id: string;
  script_id: string;
  question_number: string;
  awarded: number | null;
  max: number | null;
  feedback: string | null;
  status: string;
};

function makeSupabase(opts: {
  existing: QuestionRow;
  questionsAfter?: QuestionRow[];
  updates: unknown[];
  touchedTables?: string[];
  assessment?: { linked_strand: string | null; linked_sub_strand: string | null } | null;
  classSubject?: string;
}) {
  const {
    existing,
    updates,
    touchedTables,
    assessment = {
      linked_strand: "Numbers",
      linked_sub_strand: "Fractions",
    },
    classSubject = "Mathematics",
  } = opts;
  const questionsAfter = opts.questionsAfter ?? [existing];

  return {
    from(table: string) {
      touchedTables?.push(table);
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = async () => {
        if (table === "evaluated_scripts") {
          return {
            data: {
              id: "script-1",
              batch_id: "batch-1",
              status: "drafted",
            },
            error: null,
          };
        }
        if (table === "question_evaluations") {
          return { data: existing, error: null };
        }
        if (table === "evaluation_batches") {
          return {
            data: {
              class_id: "class-1",
              assessment_id: assessment ? "assess-1" : null,
            },
            error: null,
          };
        }
        if (table === "assessments") {
          return { data: assessment, error: null };
        }
        if (table === "classes") {
          return { data: { subject: classSubject }, error: null };
        }
        return { data: null, error: null };
      };
      chain.update = (payload: unknown) => {
        updates.push(payload);
        return {
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: { ...existing, ...(payload as object) },
                  error: null,
                }),
              }),
            }),
          }),
        };
      };
      // Thenable list: select().eq() without maybeSingle
      chain.then = (
        resolve: (v: { data: unknown; error: null }) => unknown
      ) => {
        if (table === "question_evaluations") {
          return Promise.resolve(
            resolve({ data: questionsAfter, error: null })
          );
        }
        return Promise.resolve(resolve({ data: [], error: null }));
      };
      return chain;
    },
  };
}

describe("updateQuestionEvaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates changed fields and sets teacher_edited", async () => {
    const updates: unknown[] = [];
    const existing: QuestionRow = {
      id: "q1",
      script_id: "script-1",
      question_number: "1",
      awarded: 2,
      max: 5,
      feedback: "ok",
      status: "ai_draft",
    };
    const questionsAfter: QuestionRow[] = [
      { ...existing, awarded: 4, status: "teacher_edited" },
    ];

    const result = await updateQuestionEvaluation(
      makeSupabase({ existing, questionsAfter, updates }) as never,
      {
        batchId: "batch-1",
        scriptId: "script-1",
        questionId: "q1",
        awarded: 4,
      }
    );

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      awarded: 4,
      status: "teacher_edited",
    });
    expect(result.unchanged).toBe(false);
    expect(result.totals).toEqual({ awarded: 4, max: 5 });
    expect(result.competencyPreview?.strand).toBe("Numbers");
    expect(result.question.status).toBe("teacher_edited");
  });

  it("skips write when values are unchanged", async () => {
    const updates: unknown[] = [];
    const existing: QuestionRow = {
      id: "q1",
      script_id: "script-1",
      question_number: "1",
      awarded: 2,
      max: 5,
      feedback: "ok",
      status: "ai_draft",
    };

    const result = await updateQuestionEvaluation(
      makeSupabase({ existing, updates, assessment: null }) as never,
      {
        batchId: "batch-1",
        scriptId: "script-1",
        questionId: "q1",
        awarded: 2,
        max: 5,
        feedback: "ok",
      }
    );

    expect(updates).toHaveLength(0);
    expect(result.unchanged).toBe(true);
    expect(result.question.status).toBe("ai_draft");
  });

  it("does not write student_submissions", async () => {
    const updates: unknown[] = [];
    const touchedTables: string[] = [];
    const existing: QuestionRow = {
      id: "q1",
      script_id: "script-1",
      question_number: "1",
      awarded: 2,
      max: 5,
      feedback: "ok",
      status: "ai_draft",
    };

    await updateQuestionEvaluation(
      makeSupabase({
        existing,
        questionsAfter: [
          { ...existing, awarded: 3, status: "teacher_edited" },
        ],
        updates,
        touchedTables,
        assessment: null,
      }) as never,
      {
        batchId: "batch-1",
        scriptId: "script-1",
        questionId: "q1",
        awarded: 3,
      }
    );

    expect(touchedTables).not.toContain("student_submissions");
    expect(touchedTables).not.toContain("competency_progress");
  });

  it("rejects signed-off scripts", async () => {
    const supabase = {
      from() {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "script-1",
                    batch_id: "batch-1",
                    status: "signed_off",
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      },
    };

    await expect(
      updateQuestionEvaluation(supabase as never, {
        batchId: "batch-1",
        scriptId: "script-1",
        questionId: "q1",
        awarded: 1,
      })
    ).rejects.toThrow(/already signed off/i);
  });
});
