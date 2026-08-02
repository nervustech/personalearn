import type { SupabaseClient } from "@supabase/supabase-js";
import {
  previewCompetency,
  type CompetencyPreview,
} from "@/lib/evaluation/competency-map";
import { computeScriptTotal, type ScriptTotal } from "@/lib/evaluation/script-totals";
import type { QuestionEvaluation } from "@/types/database";

export type UpdateQuestionInput = {
  batchId: string;
  scriptId: string;
  questionId: string;
  awarded?: number | null;
  max?: number | null;
  feedback?: string | null;
};

export type UpdateQuestionResult = {
  question: QuestionEvaluation;
  questions: QuestionEvaluation[];
  totals: ScriptTotal;
  competencyPreview: CompetencyPreview | null;
  unchanged: boolean;
};

function parseOptionalNumber(
  value: unknown,
  field: string
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number.parseFloat(value);
    if (Number.isFinite(n)) return n;
  }
  throw new Error(`Invalid ${field}`);
}

export async function updateQuestionEvaluation(
  supabase: SupabaseClient,
  input: UpdateQuestionInput
): Promise<UpdateQuestionResult> {
  const { data: script, error: scriptError } = await supabase
    .from("evaluated_scripts")
    .select("id, batch_id, status")
    .eq("id", input.scriptId)
    .eq("batch_id", input.batchId)
    .maybeSingle();

  if (scriptError) throw new Error(scriptError.message);
  if (!script) throw new Error("Script not found");
  if (script.status === "signed_off") {
    throw new Error("Script is already signed off");
  }
  if (script.status !== "ready" && script.status !== "drafted") {
    throw new Error("Script must be ready before editing marks");
  }

  const { data: existing, error: existingError } = await supabase
    .from("question_evaluations")
    .select("*")
    .eq("id", input.questionId)
    .eq("script_id", input.scriptId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Question evaluation not found");

  const current = existing as QuestionEvaluation;
  const patch: {
    awarded?: number | null;
    max?: number | null;
    feedback?: string | null;
    status?: "teacher_edited";
  } = {};

  if (input.awarded !== undefined) {
    const awarded = parseOptionalNumber(input.awarded, "awarded") ?? null;
    if (awarded !== current.awarded) patch.awarded = awarded;
  }
  if (input.max !== undefined) {
    const max = parseOptionalNumber(input.max, "max") ?? null;
    if (max !== current.max) patch.max = max;
  }
  if (input.feedback !== undefined) {
    const feedback =
      input.feedback === null
        ? null
        : String(input.feedback).trim() || null;
    if (feedback !== current.feedback) patch.feedback = feedback;
  }

  const hasFieldChange =
    patch.awarded !== undefined ||
    patch.max !== undefined ||
    patch.feedback !== undefined;

  let updated = current;
  if (hasFieldChange) {
    patch.status = "teacher_edited";
    const { data, error: updateError } = await supabase
      .from("question_evaluations")
      .update(patch)
      .eq("id", input.questionId)
      .eq("script_id", input.scriptId)
      .select("*")
      .single();

    if (updateError) throw new Error(updateError.message);
    updated = data as QuestionEvaluation;
  }

  const { data: allQuestions, error: listError } = await supabase
    .from("question_evaluations")
    .select("*")
    .eq("script_id", input.scriptId);

  if (listError) throw new Error(listError.message);

  const questions = (allQuestions ?? []) as QuestionEvaluation[];
  const totals = computeScriptTotal(questions);

  const { data: batch } = await supabase
    .from("evaluation_batches")
    .select("class_id, assessment_id")
    .eq("id", input.batchId)
    .maybeSingle();

  let competencyPreview: CompetencyPreview | null = null;
  if (batch?.class_id) {
    const [{ data: assessment }, { data: classRow }] = await Promise.all([
      batch.assessment_id
        ? supabase
            .from("assessments")
            .select("linked_strand, linked_sub_strand")
            .eq("id", batch.assessment_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("classes")
        .select("subject")
        .eq("id", batch.class_id)
        .maybeSingle(),
    ]);

    const strand =
      (assessment?.linked_strand as string | null | undefined)?.trim() ||
      (classRow?.subject as string | undefined) ||
      "General";
    competencyPreview = previewCompetency({
      strand,
      subStrand:
        (assessment?.linked_sub_strand as string | null | undefined) ?? null,
      awarded: totals.awarded,
      max: totals.max,
    });
  }

  return {
    question: updated,
    questions,
    totals,
    competencyPreview,
    unchanged: !hasFieldChange,
  };
}
