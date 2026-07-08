import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";

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
});
