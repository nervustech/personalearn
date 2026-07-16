import type { SupabaseClient } from "@supabase/supabase-js";
import { listClassAssessments } from "@/lib/evaluation/batches";
import type {
  Assessment,
  Student,
  StudentAssessmentStatus,
  StudentSubmission,
} from "@/types/database";

export type MarkSummary = {
  awarded: number | null;
  max: number | null;
};

export type StudentAssessmentFeedback = {
  aiFeedback: string | null;
  teacherFeedback: string | null;
};

export type StudentAssessmentRow = {
  assessment: Assessment;
  status: StudentAssessmentStatus;
  markSummary: MarkSummary | null;
  feedback: StudentAssessmentFeedback | null;
};

export type StudentEvalProfile = {
  student: Student;
  assessments: StudentAssessmentRow[];
};

export function deriveStudentAssessmentStatus(input: {
  hasSubmission: boolean;
  hasInFlightWork: boolean;
}): StudentAssessmentStatus {
  if (input.hasSubmission) return "signed_off";
  if (input.hasInFlightWork) return "in_review";
  return "not_started";
}

export function markSummaryFromCompetencyFlags(
  flags: Record<string, unknown> | null | undefined
): MarkSummary | null {
  if (!flags || typeof flags !== "object") return null;
  const totals = flags.totals;
  if (!totals || typeof totals !== "object") return null;
  const awarded = (totals as { awarded?: unknown }).awarded;
  const max = (totals as { max?: unknown }).max;
  return {
    awarded: typeof awarded === "number" ? awarded : null,
    max: typeof max === "number" ? max : null,
  };
}

export function buildStudentAssessmentRows(input: {
  assessments: Assessment[];
  submissionsByAssessmentId: Map<string, StudentSubmission>;
  inFlightAssessmentIds: Set<string>;
}): StudentAssessmentRow[] {
  return input.assessments.map((assessment) => {
    const submission = input.submissionsByAssessmentId.get(assessment.id);
    const status = deriveStudentAssessmentStatus({
      hasSubmission: Boolean(submission),
      hasInFlightWork: input.inFlightAssessmentIds.has(assessment.id),
    });

    if (!submission) {
      return {
        assessment,
        status,
        markSummary: null,
        feedback: null,
      };
    }

    return {
      assessment,
      status,
      markSummary: markSummaryFromCompetencyFlags(submission.competency_flags),
      feedback: {
        aiFeedback: submission.ai_feedback,
        teacherFeedback: submission.teacher_feedback,
      },
    };
  });
}

export async function getStudentEvalProfile(
  supabase: SupabaseClient,
  classId: string,
  studentId: string
): Promise<StudentEvalProfile> {
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .eq("class_id", classId)
    .maybeSingle();

  if (studentError) throw new Error(studentError.message);
  if (!student) throw new Error("Student not found");

  const assessments = await listClassAssessments(supabase, classId);
  const assessmentIds = assessments.map((a) => a.id);

  if (assessmentIds.length === 0) {
    return {
      student: student as Student,
      assessments: [],
    };
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from("student_submissions")
    .select("*")
    .eq("student_id", studentId)
    .in("assessment_id", assessmentIds);

  if (submissionsError) throw new Error(submissionsError.message);

  const submissionsByAssessmentId = new Map<string, StudentSubmission>();
  for (const row of (submissions ?? []) as StudentSubmission[]) {
    submissionsByAssessmentId.set(row.assessment_id, row);
  }

  const inFlightAssessmentIds = new Set<string>();

  const { data: scripts, error: scriptsError } = await supabase
    .from("evaluated_scripts")
    .select("id, status, batch_id, evaluation_batches!inner(assessment_id)")
    .eq("student_id", studentId)
    .neq("status", "signed_off");

  if (scriptsError) throw new Error(scriptsError.message);

  for (const row of scripts ?? []) {
    const batch = row.evaluation_batches as
      | { assessment_id: string | null }
      | { assessment_id: string | null }[]
      | null;
    const assessmentId = Array.isArray(batch)
      ? batch[0]?.assessment_id
      : batch?.assessment_id;
    if (assessmentId && assessmentIds.includes(assessmentId)) {
      inFlightAssessmentIds.add(assessmentId);
    }
  }

  const { data: scopedBatches, error: scopedError } = await supabase
    .from("evaluation_batches")
    .select("assessment_id, status")
    .eq("class_id", classId)
    .eq("scoped_student_id", studentId)
    .in("status", ["draft", "in_review"]);

  if (scopedError) throw new Error(scopedError.message);

  for (const batch of scopedBatches ?? []) {
    const assessmentId = batch.assessment_id as string | null;
    if (assessmentId && assessmentIds.includes(assessmentId)) {
      inFlightAssessmentIds.add(assessmentId);
    }
  }

  return {
    student: student as Student,
    assessments: buildStudentAssessmentRows({
      assessments,
      submissionsByAssessmentId,
      inFlightAssessmentIds,
    }),
  };
}
