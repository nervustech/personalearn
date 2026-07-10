import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureAssessmentForGradableResource } from "./create-assessment-from-resource";

describe("ensureAssessmentForGradableResource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing assessment when resource_id already linked", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "assess-1" },
              error: null,
            }),
          })),
        })),
      })),
    };

    const result = await ensureAssessmentForGradableResource(
      supabase as never,
      {
        classId: "class-1",
        resourceId: "res-1",
        title: "Fractions Quiz",
        resourceType: "quiz",
      }
    );

    expect(result).toEqual({ assessmentId: "assess-1", created: false });
    expect(supabase.from).toHaveBeenCalledWith("assessments");
  });

  it("inserts a new assessment for a gradable resource", async () => {
    let selectCall = 0;
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: "assess-new" },
          error: null,
        }),
      })),
    }));

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => {
          selectCall += 1;
          return {
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          };
        }),
        insert,
      })),
    };

    const result = await ensureAssessmentForGradableResource(
      supabase as never,
      {
        classId: "class-1",
        resourceId: "res-2",
        title: "Term Exam",
        resourceType: "examination",
      }
    );

    expect(result).toEqual({ assessmentId: "assess-new", created: true });
    expect(selectCall).toBe(1);
    expect(insert).toHaveBeenCalledWith({
      class_id: "class-1",
      title: "Term Exam",
      description: null,
      type: "summative",
      resource_id: "res-2",
    });
  });
});
