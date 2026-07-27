import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mockRequireTeacherClass = vi.fn();
const mockListBatches = vi.fn();
const mockCreateBatch = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({})),
}));

vi.mock("@/lib/auth/require-teacher-class", () => ({
  requireTeacherClass: (...args: unknown[]) => mockRequireTeacherClass(...args),
}));

vi.mock("@/lib/evaluation/batches", () => ({
  listClassEvaluationBatches: (...args: unknown[]) => mockListBatches(...args),
  createEvaluationBatch: (...args: unknown[]) => mockCreateBatch(...args),
}));

describe("/api/evaluation-batches", () => {
  const classId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTeacherClass.mockResolvedValue({ id: "teacher-1" });
  });

  it("lists batches for an owned class", async () => {
    mockListBatches.mockResolvedValue([{ id: "batch-1", status: "draft" }]);

    const response = await GET(
      new Request(
        `http://localhost/api/evaluation-batches?classId=${classId}`
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.batches).toHaveLength(1);
    expect(mockRequireTeacherClass).toHaveBeenCalledWith({}, classId);
  });

  it("returns 403 when the teacher does not own the class", async () => {
    mockRequireTeacherClass.mockRejectedValue(new Error("Class not found"));

    const response = await POST(
      new Request("http://localhost/api/evaluation-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          assessmentId: "assess-1",
          proceedWithoutScheme: true,
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Class not found");
  });

  it("creates a batch", async () => {
    mockCreateBatch.mockResolvedValue({
      batch: {
        id: "batch-1",
        class_id: classId,
        status: "draft",
      },
      reused: false,
    });

    const response = await POST(
      new Request("http://localhost/api/evaluation-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          assessmentId: "assess-1",
          proceedWithoutScheme: true,
          studentId: "stu-1",
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.batch.id).toBe("batch-1");
    expect(payload.reused).toBe(false);
    expect(mockCreateBatch).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        classId,
        assessmentId: "assess-1",
        studentId: "stu-1",
        proceedWithoutScheme: true,
      })
    );
  });

  it("returns 409 when student was already evaluated", async () => {
    mockCreateBatch.mockRejectedValue(
      new Error("This student has already been evaluated for this assessment")
    );

    const response = await POST(
      new Request("http://localhost/api/evaluation-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          assessmentId: "assess-1",
          proceedWithoutScheme: true,
          studentId: "stu-1",
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toMatch(/already been evaluated/i);
  });
});
