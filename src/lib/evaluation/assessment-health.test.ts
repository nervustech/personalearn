import { describe, expect, it } from "vitest";
import type { Assessment, StudentSubmission } from "@/types/database";
import {
  bandFromRatio,
  buildAssessmentHealthCubes,
  buildStudentAssessmentHealthCubes,
  statusLabelForBand,
} from "./assessment-health";

function assessment(
  overrides: Partial<Assessment> & Pick<Assessment, "id" | "title">
): Assessment {
  return {
    class_id: "class-1",
    description: null,
    linked_strand: null,
    linked_sub_strand: null,
    type: "written",
    resource_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function submission(
  overrides: Partial<StudentSubmission> &
    Pick<StudentSubmission, "id" | "assessment_id" | "student_id">
): StudentSubmission {
  return {
    content: null,
    file_url: null,
    submitted_at: "2026-07-01T00:00:00.000Z",
    ai_feedback: null,
    teacher_feedback: null,
    competency_flags: {},
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("bandFromRatio", () => {
  it("maps strong / mixed / weak thresholds", () => {
    expect(bandFromRatio(0.8)).toBe("strong");
    expect(bandFromRatio(0.79)).toBe("mixed");
    expect(bandFromRatio(0.5)).toBe("mixed");
    expect(bandFromRatio(0.49)).toBe("weak");
    expect(bandFromRatio(null)).toBe("unsigned");
  });
});

describe("buildAssessmentHealthCubes", () => {
  it("marks assessments without submissions as unsigned", () => {
    const cubes = buildAssessmentHealthCubes({
      assessments: [assessment({ id: "a1", title: "Quiz 1" })],
      submissions: [],
    });

    expect(cubes).toHaveLength(1);
    expect(cubes[0]!.band).toBe("unsigned");
    expect(cubes[0]!.statusLabel).toBe(statusLabelForBand("unsigned"));
    expect(cubes[0]!.averageRatio).toBeNull();
  });

  it("colors by average signed-off score band", () => {
    const cubes = buildAssessmentHealthCubes({
      assessments: [
        assessment({ id: "a1", title: "Strong quiz" }),
        assessment({ id: "a2", title: "Weak quiz" }),
      ],
      submissions: [
        submission({
          id: "s1",
          assessment_id: "a1",
          student_id: "stu-1",
          competency_flags: { totals: { awarded: 9, max: 10 } },
        }),
        submission({
          id: "s2",
          assessment_id: "a1",
          student_id: "stu-2",
          competency_flags: { totals: { awarded: 8, max: 10 } },
        }),
        submission({
          id: "s3",
          assessment_id: "a2",
          student_id: "stu-1",
          competency_flags: { totals: { awarded: 2, max: 10 } },
        }),
      ],
    });

    expect(cubes[0]!.band).toBe("strong");
    expect(cubes[0]!.signedOffCount).toBe(2);
    expect(cubes[0]!.averageRatio).toBeCloseTo(0.85);
    expect(cubes[1]!.band).toBe("weak");
  });

  it("stays unsigned when submissions lack usable totals", () => {
    const cubes = buildAssessmentHealthCubes({
      assessments: [assessment({ id: "a1", title: "Draft" })],
      submissions: [
        submission({
          id: "s1",
          assessment_id: "a1",
          student_id: "stu-1",
          competency_flags: {},
        }),
      ],
    });

    expect(cubes[0]!.band).toBe("unsigned");
    expect(cubes[0]!.signedOffCount).toBe(1);
  });
});

describe("buildStudentAssessmentHealthCubes", () => {
  it("scopes bands to one student and leaves missing assessments unsigned", () => {
    const assessments = [
      assessment({ id: "a1", title: "Quiz 1" }),
      assessment({ id: "a2", title: "Quiz 2" }),
    ];
    const cubes = buildStudentAssessmentHealthCubes({
      assessments,
      studentId: "stu-1",
      submissions: [
        submission({
          id: "s1",
          assessment_id: "a1",
          student_id: "stu-1",
          competency_flags: { totals: { awarded: 9, max: 10 } },
        }),
        submission({
          id: "s2",
          assessment_id: "a1",
          student_id: "stu-2",
          competency_flags: { totals: { awarded: 1, max: 10 } },
        }),
      ],
    });

    expect(cubes).toHaveLength(2);
    expect(cubes[0]!.band).toBe("strong");
    expect(cubes[1]!.band).toBe("unsigned");
  });
});
