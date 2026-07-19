import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH } from "./route";

const mockRequireTeacherResource = vi.fn();
const mockDeleteResource = vi.fn();
const mockUpdateTextResource = vi.fn();
const mockCreateSignedUrl = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    storage: {
      from: () => ({
        createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args),
      }),
    },
  })),
}));

vi.mock("@/lib/resources/class-resources", () => ({
  requireTeacherResource: (...args: unknown[]) =>
    mockRequireTeacherResource(...args),
}));

vi.mock("@/lib/ai/ingest-resource", () => ({
  deleteResource: (...args: unknown[]) => mockDeleteResource(...args),
  updateTextResource: (...args: unknown[]) => mockUpdateTextResource(...args),
}));

describe("/api/resources/[resourceId]", () => {
  const resourceId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTeacherResource.mockResolvedValue({
      id: resourceId,
      title: "Resource",
      ai_generated: false,
      raw_content: { text: "hello" },
    });
    mockDeleteResource.mockResolvedValue(undefined);
    mockUpdateTextResource.mockResolvedValue({
      resourceId,
      chunkCount: 1,
      title: "Updated",
    });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example/original.pdf" },
      error: null,
    });
  });

  it("returns JSON resource detail with preview text", async () => {
    const response = await GET(
      new Request(`http://localhost/api/resources/${resourceId}`),
      { params: Promise.resolve({ resourceId }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.resource.id).toBe(resourceId);
    expect(payload.previewText).toBe("hello");
    expect(payload.viewUrl).toBeNull();
  });

  it("includes a signed viewUrl for PDF originals", async () => {
    mockRequireTeacherResource.mockResolvedValue({
      id: resourceId,
      title: "Scan",
      ai_generated: false,
      raw_content: {
        mimeType: "application/pdf",
        storagePath: "class/abc/file.pdf",
        text: "extracted",
      },
    });

    const response = await GET(
      new Request(`http://localhost/api/resources/${resourceId}`),
      { params: Promise.resolve({ resourceId }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.viewUrl).toBe("https://storage.example/original.pdf");
    expect(mockCreateSignedUrl).toHaveBeenCalledWith("class/abc/file.pdf", 3600);
  });

  it("patches title and text for editable resources", async () => {
    const response = await PATCH(
      new Request(`http://localhost/api/resources/${resourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated", text: "New body" }),
      }),
      { params: Promise.resolve({ resourceId }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.title).toBe("Updated");
    expect(mockUpdateTextResource).toHaveBeenCalledWith(
      expect.anything(),
      resourceId,
      { title: "Updated", text: "New body" }
    );
  });

  it("deletes an owned resource", async () => {
    const response = await DELETE(
      new Request(`http://localhost/api/resources/${resourceId}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ resourceId }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.deleted).toBe(true);
    expect(mockDeleteResource).toHaveBeenCalledWith(
      expect.anything(),
      resourceId
    );
  });

  it("returns 403 when the teacher does not own the resource", async () => {
    mockRequireTeacherResource.mockRejectedValue(new Error("Resource not found"));

    const response = await DELETE(
      new Request(`http://localhost/api/resources/${resourceId}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ resourceId }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Resource not found");
  });
});
