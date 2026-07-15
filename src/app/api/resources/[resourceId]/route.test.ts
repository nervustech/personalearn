import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET } from "./route";

const mockRequireTeacherResource = vi.fn();
const mockDeleteResource = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({})),
}));

vi.mock("@/lib/resources/class-resources", () => ({
  requireTeacherResource: (...args: unknown[]) =>
    mockRequireTeacherResource(...args),
}));

vi.mock("@/lib/ai/ingest-resource", () => ({
  deleteResource: (...args: unknown[]) => mockDeleteResource(...args),
}));

describe("/api/resources/[resourceId]", () => {
  const resourceId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTeacherResource.mockResolvedValue({ id: resourceId });
    mockDeleteResource.mockResolvedValue(undefined);
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
    expect(mockDeleteResource).toHaveBeenCalledWith({}, resourceId);
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

  it("downloads a resource as a generated PDF", async () => {
    mockRequireTeacherResource.mockResolvedValue({
      id: resourceId,
      title: "Fractions worksheet",
      raw_content: { text: "# Question 1\n\nSolve 3/4 + 1/2." },
    });

    const response = await GET(
      new Request(`http://localhost/api/resources/${resourceId}`),
      { params: Promise.resolve({ resourceId }) }
    );
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(
      "Fractions-worksheet.pdf"
    );
    // PDF magic bytes: %PDF
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
  });

  it("returns 404 when a resource has no text and no original file", async () => {
    mockRequireTeacherResource.mockResolvedValue({
      id: resourceId,
      title: "Empty",
      raw_content: {},
    });

    const response = await GET(
      new Request(`http://localhost/api/resources/${resourceId}`),
      { params: Promise.resolve({ resourceId }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("No downloadable content for this resource");
  });
});
