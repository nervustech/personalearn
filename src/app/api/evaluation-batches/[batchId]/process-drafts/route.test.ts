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

vi.mock("@/lib/evaluation/drafts", () => ({
  processBatchDrafts: (...args: unknown[]) => mockProcess(...args),
}));

describe("/api/evaluation-batches/[batchId]/process-drafts", () => {
  const classId = "11111111-1111-4111-8111-111111111111";
  const batchId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTeacherClass.mockResolvedValue({ id: "teacher-1" });
    mockRequireBatch.mockResolvedValue({
      id: batchId,
      class_id: classId,
      status: "draft",
      marking_scheme_resource_id: null,
    });
    mockProcess.mockResolvedValue({
      drafted: 1,
      skippedAmber: 1,
      skippedPending: 0,
      skippedAlreadyDrafted: 0,
      skippedOther: 0,
      errors: [],
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireBatch.mockRejectedValue(new Error("Not authenticated"));

    const response = await POST(
      new Request(
        `http://localhost/api/evaluation-batches/${batchId}/process-drafts`,
        { method: "POST" }
      ),
      { params: Promise.resolve({ batchId }) }
    );

    expect(response.status).toBe(401);
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it("returns 403 when the teacher does not own the batch class", async () => {
    mockRequireTeacherClass.mockRejectedValue(new Error("Class not found"));

    const response = await POST(
      new Request(
        `http://localhost/api/evaluation-batches/${batchId}/process-drafts`,
        { method: "POST" }
      ),
      { params: Promise.resolve({ batchId }) }
    );

    expect(response.status).toBe(403);
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it("returns draft summary including skipped amber scripts", async () => {
    const response = await POST(
      new Request(
        `http://localhost/api/evaluation-batches/${batchId}/process-drafts`,
        { method: "POST" }
      ),
      { params: Promise.resolve({ batchId }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.summary.drafted).toBe(1);
    expect(payload.summary.skippedAmber).toBe(1);
    expect(mockProcess).toHaveBeenCalledWith(expect.anything(), batchId);
  });
});
