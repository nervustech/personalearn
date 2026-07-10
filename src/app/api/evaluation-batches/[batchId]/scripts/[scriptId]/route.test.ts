import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const mockRequireTeacherClass = vi.fn();
const mockRequireBatch = vi.fn();
const mockAssign = vi.fn();

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

vi.mock("@/lib/evaluation/identity", () => ({
  assignScriptStudent: (...args: unknown[]) => mockAssign(...args),
}));

describe("PATCH /api/evaluation-batches/[batchId]/scripts/[scriptId]", () => {
  const classId = "11111111-1111-4111-8111-111111111111";
  const batchId = "22222222-2222-4222-8222-222222222222";
  const scriptId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTeacherClass.mockResolvedValue({ id: "teacher-1" });
    mockRequireBatch.mockResolvedValue({
      id: batchId,
      class_id: classId,
      status: "draft",
    });
    mockAssign.mockResolvedValue({
      id: scriptId,
      status: "identity_cleared",
      student_id: "s1",
      match_confidence: "high",
    });
  });

  it("returns 403 for non-owner", async () => {
    mockRequireTeacherClass.mockRejectedValue(new Error("Class not found"));

    const response = await PATCH(
      new Request(
        `http://localhost/api/evaluation-batches/${batchId}/scripts/${scriptId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: "s1" }),
        }
      ),
      { params: Promise.resolve({ batchId, scriptId }) }
    );

    expect(response.status).toBe(403);
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it("assigns student and clears amber", async () => {
    const response = await PATCH(
      new Request(
        `http://localhost/api/evaluation-batches/${batchId}/scripts/${scriptId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: "s1" }),
        }
      ),
      { params: Promise.resolve({ batchId, scriptId }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.script.status).toBe("identity_cleared");
    expect(mockAssign).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ studentId: "s1", scriptId, batchId })
    );
  });
});
