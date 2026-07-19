import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mockRequireTeacherClass = vi.fn();
const mockFrom = vi.fn();
const mockListClassAssessments = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

vi.mock("@/lib/auth/require-teacher-class", () => ({
  requireTeacherClass: (...args: unknown[]) => mockRequireTeacherClass(...args),
}));

vi.mock("@/lib/evaluation/batches", () => ({
  listClassAssessments: (...args: unknown[]) =>
    mockListClassAssessments(...args),
}));

describe("/api/classes/[classId]/submissions", () => {
  const classId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTeacherClass.mockResolvedValue({ id: "teacher-1" });
    mockListClassAssessments.mockResolvedValue([{ id: "assess-1" }]);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: "sub-1",
              assessment_id: "assess-1",
              student_id: "stu-1",
              competency_flags: { totals: { awarded: 8, max: 10 } },
            },
          ],
          error: null,
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

  it("returns empty submissions when the class has no assessments", async () => {
    mockListClassAssessments.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ classId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.submissions).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns submissions for class assessments", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ classId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.submissions).toHaveLength(1);
    expect(body.submissions[0].assessment_id).toBe("assess-1");
    expect(mockFrom).toHaveBeenCalledWith("student_submissions");
  });
});
