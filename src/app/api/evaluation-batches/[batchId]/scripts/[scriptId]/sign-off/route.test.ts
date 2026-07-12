import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockRequireTeacherClass = vi.fn();
const mockRequireBatch = vi.fn();
const mockSignOff = vi.fn();

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

vi.mock("@/lib/evaluation/sign-off", () => ({
  signOffScript: (...args: unknown[]) => mockSignOff(...args),
}));

describe("/api/evaluation-batches/[batchId]/scripts/[scriptId]/sign-off", () => {
  const classId = "11111111-1111-4111-8111-111111111111";
  const batchId = "22222222-2222-4222-8222-222222222222";
  const scriptId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTeacherClass.mockResolvedValue({ id: "teacher-1" });
    mockRequireBatch.mockResolvedValue({
      id: batchId,
      class_id: classId,
      status: "in_review",
      assessment_id: "assess-1",
    });
    mockSignOff.mockResolvedValue({
      scriptId,
      submission: { id: "sub-1", assessment_id: "assess-1", student_id: "stu-1" },
      competency: { id: "comp-1", status: "developing" },
      totals: { awarded: 7, max: 10 },
      alreadySignedOff: false,
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireBatch.mockRejectedValue(new Error("Not authenticated"));

    const response = await POST(
      new Request(
        `http://localhost/api/evaluation-batches/${batchId}/scripts/${scriptId}/sign-off`,
        { method: "POST" }
      ),
      { params: Promise.resolve({ batchId, scriptId }) }
    );

    expect(response.status).toBe(401);
    expect(mockSignOff).not.toHaveBeenCalled();
  });

  it("returns 403 when the teacher does not own the batch class", async () => {
    mockRequireTeacherClass.mockRejectedValue(new Error("Class not found"));

    const response = await POST(
      new Request(
        `http://localhost/api/evaluation-batches/${batchId}/scripts/${scriptId}/sign-off`,
        { method: "POST" }
      ),
      { params: Promise.resolve({ batchId, scriptId }) }
    );

    expect(response.status).toBe(403);
    expect(mockSignOff).not.toHaveBeenCalled();
  });

  it("returns sign-off payload when successful", async () => {
    const response = await POST(
      new Request(
        `http://localhost/api/evaluation-batches/${batchId}/scripts/${scriptId}/sign-off`,
        { method: "POST" }
      ),
      { params: Promise.resolve({ batchId, scriptId }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.submission.id).toBe("sub-1");
    expect(payload.competency.status).toBe("developing");
    expect(mockSignOff).toHaveBeenCalledWith(expect.anything(), {
      batchId,
      scriptId,
    });
  });
});
