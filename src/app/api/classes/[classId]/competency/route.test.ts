import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mockRequireTeacherClass = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

vi.mock("@/lib/auth/require-teacher-class", () => ({
  requireTeacherClass: (...args: unknown[]) => mockRequireTeacherClass(...args),
}));

describe("/api/classes/[classId]/competency", () => {
  const classId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTeacherClass.mockResolvedValue({ id: "teacher-1" });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "comp-1",
                student_id: "stu-1",
                class_id: classId,
                strand: "Numbers",
                status: "developing",
              },
            ],
            error: null,
          }),
        }),
      }),
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireTeacherClass.mockRejectedValue(new Error("Not authenticated"));

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ classId }),
    });

    expect(response.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 403 when the teacher does not own the class", async () => {
    mockRequireTeacherClass.mockRejectedValue(new Error("Class not found"));

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ classId }),
    });

    expect(response.status).toBe(403);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns competency rows for the class", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ classId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.competency).toHaveLength(1);
    expect(body.competency[0].strand).toBe("Numbers");
    expect(mockFrom).toHaveBeenCalledWith("competency_progress");
  });
});
