import { describe, expect, it } from "vitest";
import type { Assessment, StudentSubmission } from "@/types/database";
import {
  buildStudentAssessmentRows,
  deriveStudentAssessmentStatus,
  markSummaryFromCompetencyFlags,
} from "./student-profile";

const assessment = (id: string, title: string): Assessment => ({
  id,
  class_id: "class-1",
  title,
  description: null,
  linked_strand: null,
  linked_sub_strand: null,
  type: "written",
  resource_id: null,
  created_at: "2026-07-16T00:00:00Z",
});

describe("deriveStudentAssessmentStatus", () => {
  it("returns not_started when there is no submission or in-flight work", () => {
    expect(
      deriveStudentAssessmentStatus({
        hasSubmission: false,
        hasInFlightWork: false,
      })
    ).toBe("not_started");
  });

  it("returns in_review when a script or scoped batch is in flight", () => {
    expect(
      deriveStudentAssessmentStatus({
        hasSubmission: false,
        hasInFlightWork: true,
      })
    ).toBe("in_review");
  });

  it("prefers signed_off when a submission exists", () => {
    expect(
      deriveStudentAssessmentStatus({
        hasSubmission: true,
        hasInFlightWork: true,
      })
    ).toBe("signed_off");
  });
});

describe("markSummaryFromCompetencyFlags", () => {
  it("reads totals from competency_flags", () => {
    expect(
      markSummaryFromCompetencyFlags({
        totals: { awarded: 7, max: 10 },
      })
    ).toEqual({ awarded: 7, max: 10 });
  });

  it("returns null when totals are missing", () => {
    expect(markSummaryFromCompetencyFlags({})).toBeNull();
    expect(markSummaryFromCompetencyFlags(null)).toBeNull();
  });
});

describe("buildStudentAssessmentRows", () => {
  it("maps not_started, in_review, and signed_off with mark summary", () => {
    const assessments = [
      assessment("a1", "Quiz 1"),
      assessment("a2", "Quiz 2"),
      assessment("a3", "Exam"),
    ];

    const submission: StudentSubmission = {
      id: "sub-1",
      assessment_id: "a3",
      student_id: "stu-1",
      content: null,
      file_url: null,
      submitted_at: "2026-07-16T12:00:00Z",
      ai_feedback: "Good work",
      teacher_feedback: "Agreed",
      competency_flags: { totals: { awarded: 12, max: 20 } },
      created_at: "2026-07-16T12:00:00Z",
    };

    const rows = buildStudentAssessmentRows({
      assessments,
      submissionsByAssessmentId: new Map([["a3", submission]]),
      inFlightAssessmentIds: new Set(["a2"]),
    });

    expect(rows.map((r) => r.status)).toEqual([
      "not_started",
      "in_review",
      "signed_off",
    ]);
    expect(rows[2]?.markSummary).toEqual({ awarded: 12, max: 20 });
    expect(rows[2]?.feedback).toEqual({
      aiFeedback: "Good work",
      teacherFeedback: "Agreed",
    });
    expect(rows[0]?.markSummary).toBeNull();
    expect(rows.every((r) => r.reviewBatchId === null)).toBe(true);
  });
});
