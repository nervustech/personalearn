import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const mockRequireTeacherClass = vi.fn();
const mockRequireBatch = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({})),
}));

vi.mock("@/lib/auth/require-teacher-class", () => ({
  requireTeacherClass: (...args: unknown[]) => mockRequireTeacherClass(...args),
}));

vi.mock("@/lib/evaluation/batches", () => ({
  requireTeacherEvaluationBatch: (...args: unknown[]) =>
    mockRequireBatch(...args),
}));

vi.mock("@/lib/evaluation/update-question", () => ({
  updateQuestionEvaluation: (...args: unknown[]) => mockUpdate(...args),
}));

describe("/api/.../questions/[questionId] PATCH", () => {
  const classId = "11111111-1111-4111-8111-111111111111";
  const batchId = "22222222-2222-4222-8222-222222222222";
  const scriptId = "33333333-3333-4333-8333-333333333333";
  const questionId = "44444444-4444-4444-8444-444444444444";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTeacherClass.mockResolvedValue({ id: "teacher-1" });
    mockRequireBatch.mockResolvedValue({
      id: batchId,
      class_id: classId,
      status: "in_review",
    });
    mockUpdate.mockResolvedValue({
      question: { id: questionId, status: "teacher_edited", awarded: 4 },
      questions: [],
      totals: { awarded: 4, max: 5 },
      competencyPreview: { status: "developing" },
      unchanged: false,
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireBatch.mockRejectedValue(new Error("Not authenticated"));

    const response = await PATCH(
      new Request("http://localhost/questions", {
        method: "PATCH",
        body: JSON.stringify({ awarded: 4 }),
      }),
      { params: Promise.resolve({ batchId, scriptId, questionId }) }
    );

    expect(response.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 403 for non-owner", async () => {
    mockRequireTeacherClass.mockRejectedValue(new Error("Class not found"));

    const response = await PATCH(
      new Request("http://localhost/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awarded: 4 }),
      }),
      { params: Promise.resolve({ batchId, scriptId, questionId }) }
    );

    expect(response.status).toBe(403);
  });

  it("passes patch body to updateQuestionEvaluation", async () => {
    const response = await PATCH(
      new Request("http://localhost/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awarded: 4, feedback: "better" }),
      }),
      { params: Promise.resolve({ batchId, scriptId, questionId }) }
    );

    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        batchId,
        scriptId,
        questionId,
        awarded: 4,
        feedback: "better",
      })
    );
  });

  it("returns 400 for invalid mark values", async () => {
    mockUpdate.mockRejectedValue(new Error("Invalid awarded"));

    const response = await PATCH(
      new Request("http://localhost/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awarded: "nope" }),
      }),
      { params: Promise.resolve({ batchId, scriptId, questionId }) }
    );

    expect(response.status).toBe(400);
  });
});
