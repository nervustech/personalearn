import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockRequireTeacherClass = vi.fn();
const mockRequireBatch = vi.fn();
const mockProcess = vi.fn();

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
  processBatchIdentity: (...args: unknown[]) => mockProcess(...args),
}));

describe("/api/evaluation-batches/[batchId]/process-identity", () => {
  const classId = "11111111-1111-4111-8111-111111111111";
  const batchId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTeacherClass.mockResolvedValue({ id: "teacher-1" });
    mockRequireBatch.mockResolvedValue({
      id: batchId,
      class_id: classId,
      status: "draft",
    });
    mockProcess.mockResolvedValue([
      {
        id: "script-1",
        status: "identity_cleared",
        student_id: "s1",
        page_order: [],
      },
    ]);
  });

  it("returns 403 when the teacher does not own the batch class", async () => {
    mockRequireTeacherClass.mockRejectedValue(new Error("Class not found"));

    const response = await POST(
      new Request(
        `http://localhost/api/evaluation-batches/${batchId}/process-identity`,
        { method: "POST" }
      ),
      { params: Promise.resolve({ batchId }) }
    );

    expect(response.status).toBe(403);
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it("returns grouped scripts from processBatchIdentity", async () => {
    const response = await POST(
      new Request(
        `http://localhost/api/evaluation-batches/${batchId}/process-identity`,
        { method: "POST" }
      ),
      { params: Promise.resolve({ batchId }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.scripts).toHaveLength(1);
    expect(mockProcess).toHaveBeenCalled();
  });

  it("returns 400 when identity was already processed", async () => {
    mockProcess.mockRejectedValue(
      new Error(
        "Identity already processed for this batch. Open the review page to confirm amber matches."
      )
    );

    const response = await POST(
      new Request(
        `http://localhost/api/evaluation-batches/${batchId}/process-identity`,
        { method: "POST" }
      ),
      { params: Promise.resolve({ batchId }) }
    );

    expect(response.status).toBe(400);
  });
});
