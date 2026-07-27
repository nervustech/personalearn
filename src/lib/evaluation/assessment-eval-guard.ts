import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvaluationBatch } from "@/types/database";

/**
 * Any batch that is not fully signed off counts as the assessment's
 * single active evaluation (includes legacy invalid "drafted" if present).
 */
export const OPEN_EVAL_BATCH_STATUSES = [
  "draft",
  "in_review",
  "drafted",
  "processing",
] as const;

export const ALREADY_EVALUATED_MESSAGE =
  "This student has already been evaluated for this assessment";

export type StudentAssessmentEvalState = {
  hasSubmission: boolean;
  /** Prior script on another batch for this assessment (any non-pending status). */
  priorBatchId: string | null;
};

export async function findOpenBatchForAssessment(
  supabase: SupabaseClient,
  input: { classId: string; assessmentId: string }
): Promise<EvaluationBatch | null> {
  const { data, error } = await supabase
    .from("evaluation_batches")
    .select("*")
    .eq("class_id", input.classId)
    .eq("assessment_id", input.assessmentId)
    .neq("status", "signed_off")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as EvaluationBatch | null) ?? null;
}

/**
 * Whether this student already has a durable or prior evaluation
 * for the assessment (outside the optional currentBatchId).
 */
export async function getStudentAssessmentEvalState(
  supabase: SupabaseClient,
  input: {
    assessmentId: string;
    studentId: string;
    /** When set, scripts in this batch are ignored. */
    currentBatchId?: string | null;
  }
): Promise<StudentAssessmentEvalState> {
  const [submissionResult, scriptsResult] = await Promise.all([
    supabase
      .from("student_submissions")
      .select("id")
      .eq("assessment_id", input.assessmentId)
      .eq("student_id", input.studentId)
      .maybeSingle(),
    supabase
      .from("evaluated_scripts")
      .select(
        "id, batch_id, status, evaluation_batches!inner(assessment_id)"
      )
      .eq("student_id", input.studentId),
  ]);

  if (submissionResult.error) throw new Error(submissionResult.error.message);
  if (scriptsResult.error) throw new Error(scriptsResult.error.message);

  const hasSubmission = Boolean(submissionResult.data);

  let priorBatchId: string | null = null;
  for (const row of scriptsResult.data ?? []) {
    const batchId = row.batch_id as string;
    if (input.currentBatchId && batchId === input.currentBatchId) continue;

    const batch = row.evaluation_batches as
      | { assessment_id: string | null }
      | { assessment_id: string | null }[]
      | null;
    const meta = Array.isArray(batch) ? batch[0] : batch;
    if (!meta || meta.assessment_id !== input.assessmentId) continue;
    if ((row.status as string) === "pending") continue;

    priorBatchId = batchId;
    break;
  }

  return { hasSubmission, priorBatchId };
}

/** Student ids that already have a signed-off submission for the assessment. */
export async function listAlreadyEvaluatedStudentIds(
  supabase: SupabaseClient,
  assessmentId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("student_submissions")
    .select("student_id")
    .eq("assessment_id", assessmentId);

  if (error) throw new Error(error.message);
  return new Set(
    (data ?? []).map((row) => row.student_id as string).filter(Boolean)
  );
}

/**
 * Student ids that already have a script on another batch for this assessment.
 */
export async function listStudentsWithPriorScriptsOnAssessment(
  supabase: SupabaseClient,
  input: { assessmentId: string; excludeBatchId: string }
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("evaluated_scripts")
    .select(
      "student_id, batch_id, status, evaluation_batches!inner(assessment_id)"
    )
    .neq("batch_id", input.excludeBatchId)
    .not("student_id", "is", null);

  if (error) throw new Error(error.message);

  const ids = new Set<string>();
  for (const row of data ?? []) {
    const batch = row.evaluation_batches as
      | { assessment_id: string | null }
      | { assessment_id: string | null }[]
      | null;
    const assessmentId = Array.isArray(batch)
      ? batch[0]?.assessment_id
      : batch?.assessment_id;
    if (assessmentId !== input.assessmentId) continue;
    if (row.status === "pending") continue;
    if (row.student_id) ids.add(row.student_id as string);
  }
  return ids;
}

export function isAlreadyEvaluatedError(message: string): boolean {
  return message.includes(ALREADY_EVALUATED_MESSAGE);
}

export function markPagesAlreadyEvaluated<
  T extends { conflict?: boolean; alreadyEvaluated?: boolean },
>(pages: T[]): T[] {
  return pages.map((page) => ({
    ...page,
    alreadyEvaluated: true,
    conflict: true,
  }));
}
