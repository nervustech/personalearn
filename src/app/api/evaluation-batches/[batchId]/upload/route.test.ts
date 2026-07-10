import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockRequireTeacherClass = vi.fn();
const mockRequireBatch = vi.fn();
const mockUpload = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    storage: {
      from: vi.fn(() => ({
        upload: (...args: unknown[]) => mockUpload(...args),
      })),
    },
    from: vi.fn(() => ({
      insert: (...args: unknown[]) => mockInsert(...args),
    })),
  })),
}));

vi.mock("@/lib/auth/require-teacher-class", () => ({
  requireTeacherClass: (...args: unknown[]) => mockRequireTeacherClass(...args),
}));

vi.mock("@/lib/evaluation/batches", () => ({
  requireTeacherEvaluationBatch: (...args: unknown[]) =>
    mockRequireBatch(...args),
}));

describe("/api/evaluation-batches/[batchId]/upload", () => {
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
    mockUpload.mockResolvedValue({ error: null });
    mockInsert.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: "script-1" },
          error: null,
        }),
      })),
    });
  });

  it("returns 403 when the teacher does not own the batch class", async () => {
    mockRequireTeacherClass.mockRejectedValue(new Error("Class not found"));

    const formData = new FormData();
    formData.append(
      "files",
      new File([new Uint8Array([1, 2, 3])], "page.jpg", {
        type: "image/jpeg",
      })
    );

    const response = await POST(
      new Request(`http://localhost/api/evaluation-batches/${batchId}/upload`, {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ batchId }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Class not found");
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("rejects non-image uploads", async () => {
    const formData = new FormData();
    formData.append(
      "files",
      new File(["not-an-image"], "notes.pdf", { type: "application/pdf" })
    );

    const response = await POST(
      new Request(`http://localhost/api/evaluation-batches/${batchId}/upload`, {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ batchId }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Unsupported file type");
  });

  it("uploads images and queues a pending script", async () => {
    const formData = new FormData();
    formData.append(
      "files",
      new File([new Uint8Array([1, 2, 3])], "page-a.jpg", {
        type: "image/jpeg",
      })
    );
    formData.append(
      "files",
      new File([new Uint8Array([4, 5, 6])], "page-b.png", {
        type: "image/png",
      })
    );

    const response = await POST(
      new Request(`http://localhost/api/evaluation-batches/${batchId}/upload`, {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ batchId }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.queued).toBe(true);
    expect(payload.pageCount).toBe(2);
    expect(payload.scriptId).toBe("script-1");
    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(mockRequireTeacherClass).toHaveBeenCalledWith(
      expect.anything(),
      classId
    );
  });
});
