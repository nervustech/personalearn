import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDraftQuestion = vi.fn();
const mockListQuestions = vi.fn();
const mockLoadScheme = vi.fn();

vi.mock("@/lib/evaluation/draft-question", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/evaluation/draft-question")
  >("@/lib/evaluation/draft-question");
  return {
    ...actual,
    draftQuestionFromImages: (...args: unknown[]) => mockDraftQuestion(...args),
    listQuestionsFromImages: (...args: unknown[]) => mockListQuestions(...args),
  };
});

vi.mock("@/lib/evaluation/load-marking-scheme", () => ({
  loadMarkingSchemeText: (...args: unknown[]) => mockLoadScheme(...args),
}));

import { processBatchDrafts } from "./drafts";

function mockSupabase(scripts: unknown[]) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const deleteEq = vi.fn().mockResolvedValue({ error: null });
  const updateEq = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });

  const from = vi.fn((table: string) => {
    if (table === "evaluation_batches") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "batch-1",
                marking_scheme_resource_id: null,
                status: "draft",
              },
              error: null,
            }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      };
    }
    if (table === "evaluated_scripts") {
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({ data: scripts, error: null }),
          }),
        }),
        update: () => ({
          eq: () => updateEq(),
        }),
      };
    }
    if (table === "question_evaluations") {
      return {
        delete: () => ({
          eq: deleteEq,
        }),
        insert,
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  const download = vi.fn().mockResolvedValue({
    data: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    error: null,
  });

  return {
    from,
    storage: { from: () => ({ download }) },
    _insert: insert,
    _deleteEq: deleteEq,
  };
}

describe("processBatchDrafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadScheme.mockResolvedValue(null);
    mockDraftQuestion.mockResolvedValue({
      awarded: 2,
      max: 5,
      feedback: "Estimate",
      student_answer: "wrote 2",
      expected_answer: null,
    });
    mockListQuestions.mockResolvedValue([]);
  });

  it("skips amber scripts and drafts identity_cleared with ai_estimate when no scheme", async () => {
    const supabase = mockSupabase([
      {
        id: "amber-1",
        batch_id: "batch-1",
        status: "identity_amber",
        page_order: [],
      },
      {
        id: "cleared-1",
        batch_id: "batch-1",
        status: "identity_cleared",
        page_order: [
          {
            storagePath: "c/b/p1.jpg",
            fileName: "p1.jpg",
            uploadIndex: 0,
            questionNumbers: ["1"],
          },
        ],
      },
      {
        id: "drafted-1",
        batch_id: "batch-1",
        status: "drafted",
        page_order: [],
      },
    ]);

    const summary = await processBatchDrafts(
      supabase as never,
      "batch-1"
    );

    expect(summary.skippedAmber).toBe(1);
    expect(summary.skippedAlreadyDrafted).toBe(1);
    expect(summary.drafted).toBe(1);
    expect(summary.errors).toEqual([]);
    expect(mockDraftQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        questionLabel: "1",
        schemeText: null,
      })
    );
    expect(supabase._insert).toHaveBeenCalledWith([
      expect.objectContaining({
        script_id: "cleared-1",
        question_number: "1",
        status: "ai_estimate",
        awarded: 2,
        max: 5,
      }),
    ]);
  });

  it("drafts part labels like 1a", async () => {
    const supabase = mockSupabase([
      {
        id: "cleared-1",
        batch_id: "batch-1",
        status: "identity_cleared",
        page_order: [
          {
            storagePath: "c/b/p1.jpg",
            fileName: "p1.jpg",
            uploadIndex: 0,
            questionNumbers: ["1.a", "1b"],
          },
        ],
      },
    ]);

    const summary = await processBatchDrafts(supabase as never, "batch-1");

    expect(summary.drafted).toBe(1);
    expect(mockDraftQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ questionLabel: "1a" })
    );
    expect(mockDraftQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ questionLabel: "1b" })
    );
    expect(supabase._insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ question_number: "1a" }),
        expect.objectContaining({ question_number: "1b" }),
      ])
    );
  });

  it("uses ai_draft when scheme text is present", async () => {
    mockLoadScheme.mockResolvedValue("Q1: award 5 marks for correct answer");
    const supabase = mockSupabase([
      {
        id: "cleared-1",
        batch_id: "batch-1",
        status: "identity_cleared",
        page_order: [
          {
            storagePath: "c/b/p1.jpg",
            fileName: "p1.jpg",
            uploadIndex: 0,
            questionNumbers: ["1"],
          },
        ],
      },
    ]);

    await processBatchDrafts(supabase as never, "batch-1");

    expect(supabase._insert).toHaveBeenCalledWith([
      expect.objectContaining({
        status: "ai_draft",
      }),
    ]);
  });
});
