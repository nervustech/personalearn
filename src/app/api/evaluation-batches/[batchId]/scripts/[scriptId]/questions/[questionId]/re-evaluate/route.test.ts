import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockRequireTeacherClass = vi.fn();
const mockRequireBatch = vi.fn();
const mockReevaluate = vi.fn();

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

vi.mock("@/lib/evaluation/reevaluate-question", () => ({
  reevaluateScriptQuestion: (...args: unknown[]) => mockReevaluate(...args),
}));

describe("/api/.../questions/[questionId]/re-evaluate", () => {
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
    mockReevaluate.mockResolvedValue({
      question: { id: questionId, status: "reevaluated", awarded: 4, max: 5 },
      questions: [],
      totals: { awarded: 4, max: 5 },
      competencyPreview: { status: "developing" },
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireBatch.mockRejectedValue(new Error("Not authenticated"));

    const response = await POST(
      new Request("http://localhost/re-evaluate", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ batchId, scriptId, questionId }) }
    );

    expect(response.status).toBe(401);
    expect(mockReevaluate).not.toHaveBeenCalled();
  });

  it("returns 403 for non-owner", async () => {
    mockRequireTeacherClass.mockRejectedValue(new Error("Class not found"));

    const response = await POST(
      new Request("http://localhost/re-evaluate", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ batchId, scriptId, questionId }) }
    );

    expect(response.status).toBe(403);
  });

  it("passes instruction to re-eval", async () => {
    const response = await POST(
      new Request("http://localhost/re-evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: "award method marks" }),
      }),
      { params: Promise.resolve({ batchId, scriptId, questionId }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.question.status).toBe("reevaluated");
    expect(mockReevaluate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        batchId,
        scriptId,
        questionId,
        instruction: "award method marks",
      })
    );
  });
});
