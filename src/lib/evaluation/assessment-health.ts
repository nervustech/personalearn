import { markSummaryFromCompetencyFlags } from "@/lib/evaluation/student-profile";
import type { Assessment, StudentSubmission } from "@/types/database";

/** Score bands for home assessment health cubes (PSL-66 / B3). */
export type AssessmentHealthBand = "unsigned" | "strong" | "mixed" | "weak";

export type AssessmentHealthCube = {
  assessment: Assessment;
  band: AssessmentHealthBand;
  /** Mean awarded/max across signed-off submissions; null when unsigned. */
  averageRatio: number | null;
  signedOffCount: number;
  statusLabel: string;
};

/** Same thresholds as competency statusFromRatio (0.8 / 0.5). */
export function bandFromRatio(ratio: number | null): AssessmentHealthBand {
  if (ratio === null || !Number.isFinite(ratio)) return "unsigned";
  if (ratio >= 0.8) return "strong";
  if (ratio >= 0.5) return "mixed";
  return "weak";
}

export function statusLabelForBand(band: AssessmentHealthBand): string {
  switch (band) {
    case "strong":
      return "Strong";
    case "mixed":
      return "Mixed";
    case "weak":
      return "Weak";
    case "unsigned":
      return "Not signed off";
  }
}

function ratioFromSubmission(submission: StudentSubmission): number | null {
  const summary = markSummaryFromCompetencyFlags(submission.competency_flags);
  if (
    !summary ||
    typeof summary.awarded !== "number" ||
    typeof summary.max !== "number" ||
    !Number.isFinite(summary.awarded) ||
    !Number.isFinite(summary.max) ||
    summary.max <= 0
  ) {
    return null;
  }
  return summary.awarded / summary.max;
}

function cubeForSubmission(
  assessment: Assessment,
  submission: StudentSubmission | undefined
): AssessmentHealthCube {
  if (!submission) {
    return {
      assessment,
      band: "unsigned",
      averageRatio: null,
      signedOffCount: 0,
      statusLabel: statusLabelForBand("unsigned"),
    };
  }

  const ratio = ratioFromSubmission(submission);
  const band = bandFromRatio(ratio);
  return {
    assessment,
    band,
    averageRatio: ratio,
    signedOffCount: ratio !== null ? 1 : 0,
    statusLabel: statusLabelForBand(band),
  };
}

/** Class-level strip: one cube per assessment (mean across students). */
export function buildAssessmentHealthCubes(input: {
  assessments: Assessment[];
  submissions: StudentSubmission[];
}): AssessmentHealthCube[] {
  const byAssessment = new Map<string, StudentSubmission[]>();
  for (const submission of input.submissions) {
    const list = byAssessment.get(submission.assessment_id) ?? [];
    list.push(submission);
    byAssessment.set(submission.assessment_id, list);
  }

  return input.assessments.map((assessment) => {
    const signedOff = byAssessment.get(assessment.id) ?? [];
    if (signedOff.length === 0) {
      return {
        assessment,
        band: "unsigned" as const,
        averageRatio: null,
        signedOffCount: 0,
        statusLabel: statusLabelForBand("unsigned"),
      };
    }

    const ratios = signedOff
      .map(ratioFromSubmission)
      .filter((r): r is number => r !== null);

    if (ratios.length === 0) {
      return {
        assessment,
        band: "unsigned" as const,
        averageRatio: null,
        signedOffCount: signedOff.length,
        statusLabel: statusLabelForBand("unsigned"),
      };
    }

    const averageRatio =
      ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
    const band = bandFromRatio(averageRatio);

    return {
      assessment,
      band,
      averageRatio,
      signedOffCount: signedOff.length,
      statusLabel: statusLabelForBand(band),
    };
  });
}

/** Per-student strip: one cube per assessment for that student (PSL-66). */
export function buildStudentAssessmentHealthCubes(input: {
  assessments: Assessment[];
  submissions: StudentSubmission[];
  studentId: string;
}): AssessmentHealthCube[] {
  const byAssessment = new Map<string, StudentSubmission>();
  for (const submission of input.submissions) {
    if (submission.student_id !== input.studentId) continue;
    byAssessment.set(submission.assessment_id, submission);
  }

  return input.assessments.map((assessment) =>
    cubeForSubmission(assessment, byAssessment.get(assessment.id))
  );
}
