import type { SupabaseClient } from "@supabase/supabase-js";
import {
  previewCompetency,
  type CompetencyPreview,
} from "@/lib/evaluation/competency-map";
import { draftQuestionFromImages } from "@/lib/evaluation/draft-question";
import { loadMarkingSchemeText } from "@/lib/evaluation/load-marking-scheme";
import {
  asScriptPages,
  downloadPageBytes,
  pagesForQuestion,
} from "@/lib/evaluation/page-images";
import { computeScriptTotal, type ScriptTotal } from "@/lib/evaluation/script-totals";
import type {
  EvaluationBatch,
  QuestionEvaluation,
} from "@/types/database";

export type ReevaluateQuestionResult = {
  question: QuestionEvaluation;
  questions: QuestionEvaluation[];
  totals: ScriptTotal;
  competencyPreview: CompetencyPreview | null;
};

/** Cap teacher re-eval instructions before they enter the vision prompt. */
export const MAX_REEVAL_INSTRUCTION_CHARS = 2000;

export function normalizeReevalInstruction(
  instruction?: string | null
): string | null {
  if (instruction == null) return null;
  const trimmed = String(instruction).trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_REEVAL_INSTRUCTION_CHARS) {
    throw new Error(
      `Instruction must be at most ${MAX_REEVAL_INSTRUCTION_CHARS} characters`
    );
  }
  return trimmed;
}

async function loadCompetencyPreview(
  supabase: SupabaseClient,
  batchId: string,
  totals: ScriptTotal
): Promise<CompetencyPreview | null> {
  const { data: batch } = await supabase
    .from("evaluation_batches")
    .select("class_id, assessment_id")
    .eq("id", batchId)
    .maybeSingle();

  if (!batch?.class_id) return null;

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

  return previewCompetency({
    strand,
    subStrand:
      (assessment?.linked_sub_strand as string | null | undefined) ?? null,
    awarded: totals.awarded,
    max: totals.max,
  });
}

export async function reevaluateScriptQuestion(
  supabase: SupabaseClient,
  input: {
    batchId: string;
    scriptId: string;
    questionId: string;
    instruction?: string | null;
  }
): Promise<ReevaluateQuestionResult> {
  const { data: script, error: scriptError } = await supabase
    .from("evaluated_scripts")
    .select("*")
    .eq("id", input.scriptId)
    .eq("batch_id", input.batchId)
    .maybeSingle();

  if (scriptError) throw new Error(scriptError.message);
  if (!script) throw new Error("Script not found");
  if (script.status === "signed_off") {
    throw new Error("Script is already signed off");
  }
  if (script.status !== "drafted") {
    throw new Error("Script must be drafted before re-evaluation");
  }

  const { data: existing, error: existingError } = await supabase
    .from("question_evaluations")
    .select("*")
    .eq("id", input.questionId)
    .eq("script_id", input.scriptId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Question evaluation not found");

  const { data: batch, error: batchError } = await supabase
    .from("evaluation_batches")
    .select("*")
    .eq("id", input.batchId)
    .maybeSingle();

  if (batchError) throw new Error(batchError.message);
  if (!batch) throw new Error("Evaluation batch not found");

  const schemeText = await loadMarkingSchemeText(
    supabase,
    batch as EvaluationBatch
  );

  const pages = asScriptPages(script.page_order);
  const qPages = pagesForQuestion(pages, existing.question_number as string);
  const cache = new Map<string, Awaited<ReturnType<typeof downloadPageBytes>>>();
  const images: Awaited<ReturnType<typeof downloadPageBytes>>[] = [];
  const seen = new Set<string>();
  for (const page of qPages) {
    if (seen.has(page.storagePath)) continue;
    seen.add(page.storagePath);
    images.push(await downloadPageBytes(supabase, page.storagePath, cache));
  }

  const instruction = normalizeReevalInstruction(input.instruction);

  const draft = await draftQuestionFromImages({
    pages: images,
    questionLabel: existing.question_number as string,
    schemeText,
    instruction,
  });

  const { data: updated, error: updateError } = await supabase
    .from("question_evaluations")
    .update({
      awarded: draft.awarded,
      max: draft.max,
      feedback: draft.feedback,
      status: "reevaluated",
    })
    .eq("id", input.questionId)
    .eq("script_id", input.scriptId)
    .select("*")
    .single();

  if (updateError) throw new Error(updateError.message);

  const { data: allQuestions, error: listError } = await supabase
    .from("question_evaluations")
    .select("*")
    .eq("script_id", input.scriptId);

  if (listError) throw new Error(listError.message);

  const questions = (allQuestions ?? []) as QuestionEvaluation[];
  const totals = computeScriptTotal(questions);
  const competencyPreview = await loadCompetencyPreview(
    supabase,
    input.batchId,
    totals
  );

  return {
    question: updated as QuestionEvaluation,
    questions,
    totals,
    competencyPreview,
  };
}
