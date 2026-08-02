import type { SupabaseClient } from "@supabase/supabase-js";
import {
  previewCompetency,
  statusFromRatio,
  type CompetencyPreview,
} from "@/lib/evaluation/competency-map";
import { refreshBatchStatusRollup } from "@/lib/evaluation/batch-status";
import { computeScriptTotal, type ScriptTotal } from "@/lib/evaluation/script-totals";
import type {
  CompetencyProgress,
  QuestionEvaluation,
  StudentSubmission,
} from "@/types/database";

export type SignOffResult = {
  scriptId: string;
  submission: StudentSubmission;
  competency: CompetencyProgress;
  totals: ScriptTotal;
  competencyPreview: CompetencyPreview;
  alreadySignedOff: boolean;
};

function aggregateFeedback(questions: QuestionEvaluation[]): {
  aiFeedback: string | null;
  teacherFeedback: string | null;
} {
  const aiParts: string[] = [];
  const teacherParts: string[] = [];

  for (const q of questions) {
    if (!q.feedback) continue;
    const line = `Q${q.question_number}: ${q.feedback}`;
    if (q.status === "teacher_edited" || q.status === "reevaluated") {
      teacherParts.push(line);
    } else {
      aiParts.push(line);
    }
  }

  return {
    aiFeedback: aiParts.length ? aiParts.join("\n") : null,
    teacherFeedback: teacherParts.length ? teacherParts.join("\n") : null,
  };
}

export async function signOffScript(
  supabase: SupabaseClient,
  input: { batchId: string; scriptId: string }
): Promise<SignOffResult> {
  const { data: batch, error: batchError } = await supabase
    .from("evaluation_batches")
    .select("*")
    .eq("id", input.batchId)
    .maybeSingle();

  if (batchError) throw new Error(batchError.message);
  if (!batch) throw new Error("Evaluation batch not found");
  if (!batch.assessment_id) {
    throw new Error(
      "Batch has no assessment; cannot sign off without an assessment"
    );
  }

  const { data: script, error: scriptError } = await supabase
    .from("evaluated_scripts")
    .select("*")
    .eq("id", input.scriptId)
    .eq("batch_id", input.batchId)
    .maybeSingle();

  if (scriptError) throw new Error(scriptError.message);
  if (!script) throw new Error("Script not found");
  if (!script.student_id) {
    throw new Error("Script has no student assigned");
  }

  const { data: questionRows, error: questionsError } = await supabase
    .from("question_evaluations")
    .select("*")
    .eq("script_id", input.scriptId);

  if (questionsError) throw new Error(questionsError.message);
  const questions = (questionRows ?? []) as QuestionEvaluation[];
  const totals = computeScriptTotal(questions);

  if (script.status === "signed_off") {
    const [{ data: submission }, { data: competencyRows }] = await Promise.all([
      supabase
        .from("student_submissions")
        .select("*")
        .eq("assessment_id", batch.assessment_id)
        .eq("student_id", script.student_id)
        .maybeSingle(),
      supabase
        .from("competency_progress")
        .select("*")
        .eq("student_id", script.student_id)
        .eq("class_id", batch.class_id),
    ]);

    if (!submission) {
      throw new Error("Signed-off script is missing student_submissions row");
    }

    const [{ data: assessment }, { data: classRow }] = await Promise.all([
      supabase
        .from("assessments")
        .select("linked_strand, linked_sub_strand")
        .eq("id", batch.assessment_id)
        .maybeSingle(),
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
    const competencyPreview = previewCompetency({
      strand,
      subStrand:
        (assessment?.linked_sub_strand as string | null | undefined) ?? null,
      awarded: totals.awarded,
      max: totals.max,
    });
    const competency =
      ((competencyRows ?? []) as CompetencyProgress[]).find(
        (c) => c.strand === strand
      ) ?? null;
    if (!competency) {
      throw new Error("Signed-off script is missing competency_progress row");
    }

    return {
      scriptId: input.scriptId,
      submission: submission as StudentSubmission,
      competency,
      totals,
      competencyPreview,
      alreadySignedOff: true,
    };
  }

  if (script.status !== "ready" && script.status !== "drafted") {
    throw new Error("Script must be ready before sign-off");
  }

  const [{ data: assessment }, { data: classRow }] = await Promise.all([
    supabase
      .from("assessments")
      .select("linked_strand, linked_sub_strand")
      .eq("id", batch.assessment_id)
      .maybeSingle(),
    supabase
      .from("classes")
      .select("subject")
      .eq("id", batch.class_id)
      .maybeSingle(),
  ]);

  if (!assessment) throw new Error("Assessment not found");

  const strand =
    (assessment.linked_strand as string | null | undefined)?.trim() ||
    (classRow?.subject as string | undefined) ||
    "General";
  const subStrand =
    (assessment.linked_sub_strand as string | null | undefined) ?? null;
  const competencyStatus = statusFromRatio(totals.awarded, totals.max);
  const competencyPreview = previewCompetency({
    strand,
    subStrand,
    awarded: totals.awarded,
    max: totals.max,
  });
  const { aiFeedback, teacherFeedback } = aggregateFeedback(questions);

  const competencyFlags = {
    totals,
    questions: questions.map((q) => ({
      question_number: q.question_number,
      awarded: q.awarded,
      max: q.max,
      status: q.status,
      feedback: q.feedback,
    })),
    competencyPreview,
  };

  const now = new Date().toISOString();

  // Detect prior submission so retries after a partial failure do not
  // double-increment competency evidence_count.
  const { data: priorSubmission } = await supabase
    .from("student_submissions")
    .select("id")
    .eq("assessment_id", batch.assessment_id)
    .eq("student_id", script.student_id)
    .maybeSingle();
  const bumpEvidence = !priorSubmission;

  // Write durable results before flipping script status so a failed status
  // update can be retried (upserts are idempotent).
  const { data: submission, error: submissionError } = await supabase
    .from("student_submissions")
    .upsert(
      {
        assessment_id: batch.assessment_id,
        student_id: script.student_id,
        content: null,
        file_url: null,
        submitted_at: now,
        ai_feedback: aiFeedback,
        teacher_feedback: teacherFeedback,
        competency_flags: competencyFlags,
      },
      { onConflict: "assessment_id,student_id" }
    )
    .select("*")
    .single();

  if (submissionError) throw new Error(submissionError.message);

  const { data: existingComp } = await supabase
    .from("competency_progress")
    .select("*")
    .eq("student_id", script.student_id)
    .eq("class_id", batch.class_id)
    .eq("strand", strand)
    .maybeSingle();

  const nextEvidence = bumpEvidence
    ? (existingComp?.evidence_count ?? 0) + 1
    : (existingComp?.evidence_count ?? 1);

  const { data: competencyRow, error: compError } = await supabase
    .from("competency_progress")
    .upsert(
      {
        student_id: script.student_id,
        class_id: batch.class_id,
        strand,
        sub_strand: subStrand,
        competency_code: existingComp?.competency_code ?? null,
        status: competencyStatus,
        last_evidence_at: now,
        evidence_count: nextEvidence,
        updated_at: now,
      },
      { onConflict: "student_id,class_id,strand" }
    )
    .select("*")
    .single();

  if (compError) throw new Error(compError.message);
  const competency = competencyRow as CompetencyProgress;

  const { error: scriptUpdateError } = await supabase
    .from("evaluated_scripts")
    .update({ status: "signed_off" })
    .eq("id", input.scriptId)
    .eq("batch_id", input.batchId);

  if (scriptUpdateError) throw new Error(scriptUpdateError.message);

  await refreshBatchStatusRollup(supabase, input.batchId);

  return {
    scriptId: input.scriptId,
    submission: submission as StudentSubmission,
    competency,
    totals,
    competencyPreview,
    alreadySignedOff: false,
  };
}
