import { beforeEach, describe, expect, it, vi } from "vitest";
import { signOffScript } from "./sign-off";

describe("signOffScript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes submission and competency for a drafted script", async () => {
    const updates: { table: string; payload: unknown }[] = [];
    const inserts: { table: string; payload: unknown }[] = [];
    const upserts: { table: string; payload: unknown }[] = [];

    const supabase = {
      from(table: string) {
        const api: Record<string, unknown> = {};
        api.select = () => api;
        api.eq = () => api;
        api.maybeSingle = async () => {
          if (table === "evaluation_batches") {
            return {
              data: {
                id: "batch-1",
                class_id: "class-1",
                assessment_id: "assess-1",
                status: "in_review",
              },
              error: null,
            };
          }
          if (table === "evaluated_scripts") {
            return {
              data: {
                id: "script-1",
                batch_id: "batch-1",
                student_id: "stu-1",
                status: "drafted",
              },
              error: null,
            };
          }
          if (table === "assessments") {
            return {
              data: { linked_strand: null, linked_sub_strand: null },
              error: null,
            };
          }
          if (table === "classes") {
            return {
              data: { subject: "Mathematics" },
              error: null,
            };
          }
          if (table === "competency_progress") {
            return { data: null, error: null };
          }
          return { data: null, error: null };
        };
        // question list: select().eq() returns thenable
        const listBuilder = {
          eq: () => listBuilder,
          then(
            resolve: (v: { data: unknown; error: null }) => unknown
          ) {
            if (table === "question_evaluations") {
              return Promise.resolve(
                resolve({
                  data: [
                    {
                      id: "q1",
                      question_number: "1",
                      awarded: 8,
                      max: 10,
                      feedback: "strong",
                      status: "ai_draft",
                    },
                  ],
                  error: null,
                })
              );
            }
            if (table === "evaluated_scripts") {
              return Promise.resolve(
                resolve({
                  data: [{ id: "script-1", status: "signed_off" }],
                  error: null,
                })
              );
            }
            return Promise.resolve(resolve({ data: [], error: null }));
          },
        };
        api.select = () => {
          if (table === "question_evaluations") return listBuilder;
          return api;
        };
        // After script status update, list batch scripts uses select().eq without maybeSingle
        const originalSelect = api.select as () => unknown;
        api.select = (cols?: string) => {
          if (table === "evaluated_scripts" && cols === "id, status") {
            return {
              eq: () => ({
                then(
                  resolve: (v: { data: unknown; error: null }) => unknown
                ) {
                  return Promise.resolve(
                    resolve({
                      data: [{ id: "script-1", status: "signed_off" }],
                      error: null,
                    })
                  );
                },
              }),
            };
          }
          if (table === "question_evaluations") return listBuilder;
          return originalSelect();
        };

        api.upsert = (payload: unknown) => {
          upserts.push({ table, payload });
          if (table === "competency_progress") {
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: "comp-1",
                    student_id: "stu-1",
                    class_id: "class-1",
                    strand: "Mathematics",
                    status: "mastered",
                    evidence_count: 1,
                    ...(payload as object),
                  },
                  error: null,
                }),
              }),
            };
          }
          return {
            select: () => ({
              single: async () => ({
                data: {
                  id: "sub-1",
                  assessment_id: "assess-1",
                  student_id: "stu-1",
                  ...(payload as object),
                },
                error: null,
              }),
            }),
          };
        };
        api.insert = (payload: unknown) => {
          inserts.push({ table, payload });
          return {
            select: () => ({
              single: async () => ({
                data: {
                  id: "comp-1",
                  student_id: "stu-1",
                  class_id: "class-1",
                  strand: "Mathematics",
                  status: "mastered",
                  evidence_count: 1,
                  ...(payload as object),
                },
                error: null,
              }),
            }),
          };
        };
        api.update = (payload: unknown) => {
          updates.push({ table, payload });
          return {
            eq: () => ({
              eq: () => ({
                then(
                  resolve: (v: { data: null; error: null }) => unknown
                ) {
                  return Promise.resolve(resolve({ data: null, error: null }));
                },
              }),
              then(
                resolve: (v: { data: null; error: null }) => unknown
              ) {
                return Promise.resolve(resolve({ data: null, error: null }));
              },
            }),
          };
        };
        return api;
      },
    };

    const result = await signOffScript(supabase as never, {
      batchId: "batch-1",
      scriptId: "script-1",
    });

    expect(upserts.some((u) => u.table === "student_submissions")).toBe(true);
    expect(upserts.some((u) => u.table === "competency_progress")).toBe(true);
    expect(inserts.some((i) => i.table === "competency_progress")).toBe(false);
    expect(result.submission.student_id).toBe("stu-1");
    expect(result.competency.status).toBe("mastered");
    expect(result.alreadySignedOff).toBe(false);
    expect(result.totals).toEqual({ awarded: 8, max: 10 });
  });

  it("rejects when batch has no assessment", async () => {
    const supabase = {
      from(table: string) {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data:
                  table === "evaluation_batches"
                    ? {
                        id: "batch-1",
                        class_id: "class-1",
                        assessment_id: null,
                      }
                    : null,
                error: null,
              }),
            }),
          }),
        };
      },
    };

    await expect(
      signOffScript(supabase as never, {
        batchId: "batch-1",
        scriptId: "script-1",
      })
    ).rejects.toThrow(/no assessment/i);
  });
});
