import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvaluateResult } from "@/lib/evaluation/evaluate-schema";
import type { IndexResult } from "@/lib/evaluation/index-schema";
import type { GroupedScript } from "@/lib/evaluation/group-by-admission";
import type {
  EvaluatedScriptPage,
  EvaluatedScriptStatus,
} from "@/types/database";

const SETTLED_SCRIPT_STATUSES = new Set<EvaluatedScriptStatus>([
  "evaluating",
  "ready",
  "signed_off",
  "failed",
  "identity_cleared",
  "queued_draft",
  "drafting",
  "drafted",
]);

export type ExistingScriptIdentity = {
  student_id: string | null;
  status: EvaluatedScriptStatus;
  match_confidence: "high" | "low" | null;
  read_admission_number?: string | null;
};

/**
 * Keep teacher-confirmed (or already-grading) identity across regroup / later
 * uploads. Never drop a settled student back to amber/unmatched (PSL-108).
 */
export function resolveScriptIdentityOnUpsert(input: {
  existing: ExistingScriptIdentity | null;
  group: Pick<
    GroupedScript,
    "studentId" | "status" | "matchConfidence" | "admissionNumber"
  >;
}): {
  studentId: string | null;
  status: EvaluatedScriptStatus;
  matchConfidence: "high" | "low" | null;
  admissionNumber: string | null;
} {
  const { existing, group } = input;
  const studentId = group.studentId ?? existing?.student_id ?? null;
  const admissionNumber =
    group.admissionNumber ?? existing?.read_admission_number ?? null;

  if (
    existing &&
    existing.student_id &&
    SETTLED_SCRIPT_STATUSES.has(existing.status) &&
    (group.status === "identity_amber" || group.status === "unmatched")
  ) {
    return {
      studentId,
      status: existing.status === "failed" ? "evaluating" : existing.status,
      matchConfidence: existing.match_confidence ?? group.matchConfidence,
      admissionNumber,
    };
  }

  return {
    studentId,
    status: group.status,
    matchConfidence: group.matchConfidence,
    admissionNumber,
  };
}

export async function persistIndexResults(
  supabase: SupabaseClient,
  input: {
    batchId: string;
    pageId: string;
    index: IndexResult;
    modelId: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from("evaluation_pages")
    .update({
      admission_number: input.index.admission_number,
      admission_confidence: input.index.admission_confidence,
      page_number: input.index.page_number,
      total_pages: input.index.total_pages,
      questions_found: input.index.questions_found,
      index_model_id: input.modelId,
    })
    .eq("id", input.pageId)
    .eq("batch_id", input.batchId);

  if (error) throw new Error(error.message);
}

export async function upsertScriptFromGroup(
  supabase: SupabaseClient,
  input: {
    batchId: string;
    group: GroupedScript;
    existingScriptId?: string | null;
  }
): Promise<string> {
  const pageOrder: EvaluatedScriptPage[] = input.group.pages.map((p) => ({
    storagePath: p.storagePath,
    fileName: p.fileName,
    uploadIndex: p.uploadIndex,
    contentHash: p.contentHash,
    questionNumbers: p.index.questions_found,
    readAdmissionNumber: p.index.admission_number,
  }));

  let scriptId = input.existingScriptId ?? null;

  const scriptFields =
    "id, student_id, status, match_confidence, read_admission_number";

  let existing: (ExistingScriptIdentity & { id: string }) | null = null;

  if (scriptId) {
    const { data, error } = await supabase
      .from("evaluated_scripts")
      .select(scriptFields)
      .eq("id", scriptId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    existing = (data as (ExistingScriptIdentity & { id: string }) | null) ?? null;
  }

  if (!existing && input.group.studentId) {
    const { data, error } = await supabase
      .from("evaluated_scripts")
      .select(scriptFields)
      .eq("batch_id", input.batchId)
      .eq("student_id", input.group.studentId)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    existing = (data as (ExistingScriptIdentity & { id: string }) | null) ?? null;
  }

  if (!existing && input.group.admissionNumber) {
    const { data, error } = await supabase
      .from("evaluated_scripts")
      .select(scriptFields)
      .eq("batch_id", input.batchId)
      .eq("read_admission_number", input.group.admissionNumber)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    existing = (data as (ExistingScriptIdentity & { id: string }) | null) ?? null;
  }

  if (!existing && input.group.status === "unmatched") {
    const { data, error } = await supabase
      .from("evaluated_scripts")
      .select(scriptFields)
      .eq("batch_id", input.batchId)
      .eq("status", "unmatched")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    existing = (data as (ExistingScriptIdentity & { id: string }) | null) ?? null;
  }

  scriptId = existing?.id ?? scriptId;

  if (scriptId) {
    const next = resolveScriptIdentityOnUpsert({
      existing,
      group: input.group,
    });
    const { error } = await supabase
      .from("evaluated_scripts")
      .update({
        student_id: next.studentId,
        read_admission_number: next.admissionNumber,
        match_confidence: next.matchConfidence,
        page_order: pageOrder,
        status: next.status,
      })
      .eq("id", scriptId);

    if (error) throw new Error(error.message);

    for (const page of input.group.pages) {
      await supabase
        .from("evaluation_pages")
        .update({ script_id: scriptId })
        .eq("id", page.pageId);
    }
    return scriptId;
  }

  const { data, error } = await supabase
    .from("evaluated_scripts")
    .insert({
      batch_id: input.batchId,
      student_id: input.group.studentId,
      read_admission_number: input.group.admissionNumber,
      match_confidence: input.group.matchConfidence,
      page_order: pageOrder,
      status: input.group.status,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not create script");

  for (const page of input.group.pages) {
    await supabase
      .from("evaluation_pages")
      .update({ script_id: data.id })
      .eq("id", page.pageId);
  }

  return data.id as string;
}

export async function persistEvaluateResults(
  supabase: SupabaseClient,
  input: {
    scriptId: string;
    result: EvaluateResult;
    modelId: string;
    hasMarkingScheme: boolean;
  }
): Promise<void> {
  await supabase
    .from("question_evaluations")
    .delete()
    .eq("script_id", input.scriptId);

  const rows = input.result.questions.map((q) => {
    const withIdentity = q as typeof q & {
      section?: string | null;
      canonical_key?: string | null;
    };
    return {
      script_id: input.scriptId,
      question_number: q.question_number,
      section: withIdentity.section ?? null,
      canonical_key:
        withIdentity.canonical_key ?? q.question_number,
      awarded: q.awarded ?? null,
      max: q.max ?? null,
      feedback: q.suggested_feedback ?? null,
      student_answer: q.student_work
        ? JSON.stringify(q.student_work)
        : null,
      expected_answer: q.correct_reference
        ? JSON.stringify(q.correct_reference)
        : null,
      student_work: q.student_work ?? null,
      correct_reference: q.correct_reference ?? null,
      explanation: q.explanation ?? null,
      page_number: q.page_number ?? null,
      vertical_bounds: q.vertical_bounds ?? null,
      model_id: input.modelId,
      confidence: q.confidence ?? null,
      attention_status: q.status,
      status: input.hasMarkingScheme ? "ai_draft" : "ai_estimate",
    };
  });

  if (rows.length) {
    const { error } = await supabase.from("question_evaluations").insert(rows);
    if (error) throw new Error(error.message);
  }

  const { error: scriptError } = await supabase
    .from("evaluated_scripts")
    .update({ status: "ready" })
    .eq("id", input.scriptId);

  if (scriptError) throw new Error(scriptError.message);
}

export async function markScriptFailed(
  supabase: SupabaseClient,
  scriptId: string,
  errorMessage: string
): Promise<void> {
  // Do not clobber a successful ready script if a racing duplicate job fails.
  const { error } = await supabase
    .from("evaluated_scripts")
    .update({ status: "failed" })
    .eq("id", scriptId)
    .eq("status", "evaluating");
  if (error) {
    console.error(`Script ${scriptId} fail update error: ${error.message}`);
  }
  console.error(`Script ${scriptId} failed: ${errorMessage}`);
}
