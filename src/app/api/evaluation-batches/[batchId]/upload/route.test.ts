/** @vitest-environment node */
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
    const file = new File([new Uint8Array([1, 2, 3])], "page.jpg", {
      type: "image/jpeg",
    });
    formData.append("files", file, "page.jpg");

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
      new File(["not-an-image"], "notes.pdf", { type: "application/pdf" }),
      "notes.pdf"
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
      new File(["page-a-bytes"], "page-a.jpg", { type: "image/jpeg" }),
      "page-a.jpg"
    );
    formData.append(
      "files",
      new File(["page-b-bytes"], "page-b.png", { type: "image/png" }),
      "page-b.png"
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
    expect(payload.warnings).toEqual([]);
    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(mockRequireTeacherClass).toHaveBeenCalledWith(
      expect.anything(),
      classId
    );
  });

  it("stores identical bytes once and keeps two page_order rows with a warning", async () => {
    const formData = new FormData();
    formData.append(
      "files",
      new File(["identical-scan-bytes"], "scan-a.jpg", {
        type: "image/jpeg",
      }),
      "scan-a.jpg"
    );
    formData.append(
      "files",
      new File(["identical-scan-bytes"], "scan-a-copy.jpg", {
        type: "image/jpeg",
      }),
      "scan-a-copy.jpg"
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
    expect(payload.pageCount).toBe(2);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(payload.pages).toHaveLength(2);
    expect(payload.pages[0].storagePath).toBe(payload.pages[1].storagePath);
    expect(payload.pages[1].duplicate).toBe(true);
    expect(payload.warnings).toHaveLength(1);
    expect(payload.warnings[0].fileName).toBe("scan-a-copy.jpg");
    expect(payload.warnings[0].duplicateOfFileName).toBe("scan-a.jpg");

    const insertArg = mockInsert.mock.calls[0]?.[0] as {
      page_order: {
        storagePath: string;
        duplicate?: boolean;
        contentHash?: string;
      }[];
    };
    expect(insertArg.page_order).toHaveLength(2);
    expect(insertArg.page_order[0]!.contentHash).toBeTruthy();
    expect(insertArg.page_order[0]!.contentHash).toBe(
      insertArg.page_order[1]!.contentHash
    );
    expect(insertArg.page_order[1]!.duplicate).toBe(true);
  });
});
