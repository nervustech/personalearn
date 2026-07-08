import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mockRequireTeacherClass = vi.fn();
const mockListClassResources = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({})),
}));

vi.mock("@/lib/auth/require-teacher-class", () => ({
  requireTeacherClass: (...args: unknown[]) => mockRequireTeacherClass(...args),
}));

vi.mock("@/lib/resources/class-resources", () => ({
  listClassResources: (...args: unknown[]) => mockListClassResources(...args),
}));

describe("/api/resources", () => {
  const classId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTeacherClass.mockResolvedValue({ id: "teacher-1" });
  });

  it("returns resources for an owned class", async () => {
    mockListClassResources.mockResolvedValue([
      { id: "res-1", title: "Term 2 scheme" },
    ]);

    const response = await GET(
      new Request(`http://localhost/api/resources?classId=${classId}`)
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.resources).toHaveLength(1);
    expect(mockRequireTeacherClass).toHaveBeenCalledWith({}, classId);
  });

  it("returns 403 when the teacher does not own the class", async () => {
    mockRequireTeacherClass.mockRejectedValue(new Error("Class not found"));

    const response = await GET(
      new Request(`http://localhost/api/resources?classId=${classId}`)
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Class not found");
  });
});
