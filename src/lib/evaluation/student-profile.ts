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
  /** Deep-link into eval review when a batch is ready (F10). */
  reviewBatchId: string | null;
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
  reviewBatchIdByAssessmentId?: Map<string, string>;
}): StudentAssessmentRow[] {
  return input.assessments.map((assessment) => {
    const submission = input.submissionsByAssessmentId.get(assessment.id);
    const status = deriveStudentAssessmentStatus({
      hasSubmission: Boolean(submission),
      hasInFlightWork: input.inFlightAssessmentIds.has(assessment.id),
    });
    const reviewBatchId =
      input.reviewBatchIdByAssessmentId?.get(assessment.id) ?? null;

    if (!submission) {
      return {
        assessment,
        status,
        markSummary: null,
        feedback: null,
        reviewBatchId,
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
      reviewBatchId,
    };
  });
}

const STUDENT_PROFILE_SELECT =
  "id, class_id, admission_number, full_name, gender, metadata, created_at";

const SUBMISSION_PROFILE_SELECT =
  "id, assessment_id, student_id, ai_feedback, teacher_feedback, competency_flags, submitted_at, created_at";

export async function getStudentEvalProfile(
  supabase: SupabaseClient,
  classId: string,
  studentId: string
): Promise<StudentEvalProfile> {
  // Parallel cold-open: student + assessments (assessments self-heal may write).
  const [studentResult, assessments] = await Promise.all([
    supabase
      .from("students")
      .select(STUDENT_PROFILE_SELECT)
      .eq("id", studentId)
      .eq("class_id", classId)
      .maybeSingle(),
    listClassAssessments(supabase, classId),
  ]);

  if (studentResult.error) throw new Error(studentResult.error.message);
  if (!studentResult.data) throw new Error("Student not found");

  const assessmentIds = assessments.map((a) => a.id);

  if (assessmentIds.length === 0) {
    return {
      student: studentResult.data as Student,
      assessments: [],
    };
  }

  const [submissionsResult, scriptsResult, scopedResult] = await Promise.all([
    supabase
      .from("student_submissions")
      .select(SUBMISSION_PROFILE_SELECT)
      .eq("student_id", studentId)
      .in("assessment_id", assessmentIds),
    supabase
      .from("evaluated_scripts")
      .select("id, status, batch_id, evaluation_batches!inner(assessment_id)")
      .eq("student_id", studentId)
      .neq("status", "signed_off"),
    supabase
      .from("evaluation_batches")
      .select("id, assessment_id, status")
      .eq("class_id", classId)
      .eq("scoped_student_id", studentId)
      .in("status", ["draft", "processing", "drafted", "in_review"]),
  ]);

  if (submissionsResult.error) throw new Error(submissionsResult.error.message);
  if (scriptsResult.error) throw new Error(scriptsResult.error.message);
  if (scopedResult.error) throw new Error(scopedResult.error.message);

  const submissionsByAssessmentId = new Map<string, StudentSubmission>();
  for (const row of (submissionsResult.data ?? []) as StudentSubmission[]) {
    submissionsByAssessmentId.set(row.assessment_id, row);
  }

  const inFlightAssessmentIds = new Set<string>();
  const reviewBatchIdByAssessmentId = new Map<string, string>();

  for (const row of scriptsResult.data ?? []) {
    const batch = row.evaluation_batches as
      | { assessment_id: string | null }
      | { assessment_id: string | null }[]
      | null;
    const assessmentId = Array.isArray(batch)
      ? batch[0]?.assessment_id
      : batch?.assessment_id;
    if (assessmentId && assessmentIds.includes(assessmentId)) {
      inFlightAssessmentIds.add(assessmentId);
      if (row.batch_id && !reviewBatchIdByAssessmentId.has(assessmentId)) {
        reviewBatchIdByAssessmentId.set(
          assessmentId,
          row.batch_id as string
        );
      }
    }
  }

  for (const batch of scopedResult.data ?? []) {
    const assessmentId = batch.assessment_id as string | null;
    const batchId = batch.id as string;
    const status = batch.status as string;
    if (assessmentId && assessmentIds.includes(assessmentId)) {
      inFlightAssessmentIds.add(assessmentId);
      if (
        (status === "drafted" || status === "in_review") &&
        !reviewBatchIdByAssessmentId.has(assessmentId)
      ) {
        reviewBatchIdByAssessmentId.set(assessmentId, batchId);
      }
    }
  }

  return {
    student: studentResult.data as Student,
    assessments: buildStudentAssessmentRows({
      assessments,
      submissionsByAssessmentId,
      inFlightAssessmentIds,
      reviewBatchIdByAssessmentId,
    }),
  };
}
