import type { SupabaseClient } from "@supabase/supabase-js";
import {
  previewCompetency,
  type CompetencyPreview,
} from "@/lib/evaluation/competency-map";
import { loadMarkingSchemeText } from "@/lib/evaluation/load-marking-scheme";
import {
  asScriptPages,
  downloadPageBytes,
  mimeFromStoragePath,
  pagesForQuestion,
} from "@/lib/evaluation/page-images";
import { syncEvaluateScript } from "@/lib/evaluation/sync-client";
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

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
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
  if (script.status !== "ready" && script.status !== "drafted") {
    throw new Error("Script must be ready before re-evaluation");
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
  const images: { mimeType: string; base64: string }[] = [];
  const seen = new Set<string>();

  for (const page of qPages) {
    if (seen.has(page.storagePath)) continue;
    seen.add(page.storagePath);
    const downloaded = await downloadPageBytes(supabase, page.storagePath, cache);
    images.push({
      mimeType: mimeFromStoragePath(page.storagePath),
      base64: bytesToBase64(downloaded.bytes),
    });
  }

  const instruction = normalizeReevalInstruction(input.instruction);
  const promptExtra = instruction ? `\n\nTeacher instruction: ${instruction}` : "";

  const { result, modelId } = await syncEvaluateScript({
    images,
    markingScheme: schemeText
      ? `${schemeText}${promptExtra}`
      : promptExtra || null,
    questionFocus: existing.question_number as string,
  });

  const graded = result.questions.find(
    (q) => q.question_number === existing.question_number
  );
  if (!graded) {
    throw new Error("Model did not return the requested question");
  }

  const { data: updated, error: updateError } = await supabase
    .from("question_evaluations")
    .update({
      awarded: graded.awarded ?? null,
      max: graded.max ?? null,
      feedback: graded.suggested_feedback ?? null,
      student_answer: graded.student_work
        ? JSON.stringify(graded.student_work)
        : null,
      expected_answer: graded.correct_reference
        ? JSON.stringify(graded.correct_reference)
        : null,
      student_work: graded.student_work ?? null,
      correct_reference: graded.correct_reference ?? null,
      explanation: graded.explanation ?? null,
      page_number: graded.page_number ?? null,
      vertical_bounds: graded.vertical_bounds ?? null,
      model_id: modelId,
      confidence: graded.confidence ?? null,
      attention_status: graded.status,
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
