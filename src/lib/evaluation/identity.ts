import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getStudentAssessmentEvalState,
  ALREADY_EVALUATED_MESSAGE,
} from "@/lib/evaluation/assessment-eval-guard";
import type { RosterStudent } from "@/lib/evaluation/group-by-admission";
import {
  scriptHasByteDuplicate,
  scriptHasConflict,
  scriptHasMissingPageWarning,
} from "@/lib/evaluation/script-page-warnings";
import {
  compareQuestionLabels,
  normalizeQuestionLabel,
} from "@/lib/evaluation/normalize-question";
import { compareQuestionsForReview } from "@/lib/evaluation/question-identity";
import {
  findContentHashDuplicateScriptIds,
} from "@/lib/evaluation/upload-page-dedupe";
import { computeScriptTotal, type ScriptTotal } from "@/lib/evaluation/script-totals";
import type {
  EvaluatedScript,
  EvaluatedScriptPage,
  QuestionEvaluation,
} from "@/types/database";

function scriptAlreadyEvaluated(pages: EvaluatedScriptPage[]): boolean {
  return pages.some((p) => p.alreadyEvaluated === true);
}

export type ScriptReviewDto = EvaluatedScript & {
  student_name: string | null;
  missingPageWarning: boolean;
  hasConflict: boolean;
  hasByteDuplicate: boolean;
  /** Student already evaluated for this assessment (prior submission/script). */
  alreadyEvaluated: boolean;
  pageUrls: {
    storagePath: string;
    uploadIndex: number;
    fileName: string;
    url: string | null;
  }[];
  questions: QuestionEvaluation[];
  totals: ScriptTotal;
};

function pageSortKey(page: EvaluatedScriptPage): string | null {
  const labels = (page.questionNumbers ?? [])
    .map((q) => normalizeQuestionLabel(q))
    .filter((x): x is string => Boolean(x))
    .sort(compareQuestionLabels);
  return labels[0] ?? null;
}

function sortPagesByQuestion(pages: EvaluatedScriptPage[]): EvaluatedScriptPage[] {
  return [...pages].sort((a, b) => {
    const qa = pageSortKey(a);
    const qb = pageSortKey(b);
    if (qa == null && qb == null) return a.uploadIndex - b.uploadIndex;
    if (qa == null) return 1;
    if (qb == null) return -1;
    const cmp = compareQuestionLabels(qa, qb);
    if (cmp !== 0) return cmp;
    return a.uploadIndex - b.uploadIndex;
  });
}

function asPages(pageOrder: unknown): EvaluatedScriptPage[] {
  if (!Array.isArray(pageOrder)) return [];
  return pageOrder as EvaluatedScriptPage[];
}

export async function listBatchScriptsForReview(
  supabase: SupabaseClient,
  batchId: string,
  classId: string
): Promise<ScriptReviewDto[]> {
  const [{ data: scripts, error }, { data: students }] = await Promise.all([
    supabase
      .from("evaluated_scripts")
      .select("*")
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true }),
    supabase
      .from("students")
      .select("id, full_name, admission_number")
      .eq("class_id", classId),
  ]);

  if (error) throw new Error(error.message);

  const nameById = new Map(
    ((students ?? []) as RosterStudent[]).map((s) => [s.id, s.full_name])
  );

  const rows = (scripts ?? []) as EvaluatedScript[];
  const scriptIds = rows.map((s) => s.id);
  const questionsByScript = new Map<string, QuestionEvaluation[]>();

  if (scriptIds.length > 0) {
    const { data: questionRows, error: questionsError } = await supabase
      .from("question_evaluations")
      .select("*")
      .in("script_id", scriptIds);

    if (questionsError) throw new Error(questionsError.message);

    for (const row of (questionRows ?? []) as QuestionEvaluation[]) {
      const list = questionsByScript.get(row.script_id) ?? [];
      list.push(row);
      questionsByScript.set(row.script_id, list);
    }

    for (const [, list] of questionsByScript) {
      list.sort(compareQuestionsForReview);
    }
  }

  const result: ScriptReviewDto[] = [];

  // Collect unique storage paths, then mint signed URLs in one batched call.
  const uniquePaths: string[] = [];
  const seenPaths = new Set<string>();
  for (const script of rows) {
    for (const page of asPages(script.page_order)) {
      if (seenPaths.has(page.storagePath)) continue;
      seenPaths.add(page.storagePath);
      uniquePaths.push(page.storagePath);
    }
  }

  const signedUrlCache = new Map<string, string | null>();
  if (uniquePaths.length > 0) {
    const { data: signedBatch } = await supabase.storage
      .from("student_submissions")
      .createSignedUrls(uniquePaths, 3600);
    for (const entry of signedBatch ?? []) {
      if (entry.path) {
        signedUrlCache.set(entry.path, entry.signedUrl ?? null);
      }
    }
    // Fallback for any path missing from the batch response.
    for (const path of uniquePaths) {
      if (signedUrlCache.has(path)) continue;
      const { data: signed } = await supabase.storage
        .from("student_submissions")
        .createSignedUrl(path, 3600);
      signedUrlCache.set(path, signed?.signedUrl ?? null);
    }
  }

  for (const script of rows) {
    const pages = asPages(script.page_order);
    const pageUrls: ScriptReviewDto["pageUrls"] = pages.map((page) => ({
      storagePath: page.storagePath,
      uploadIndex: page.uploadIndex,
      fileName: page.fileName,
      url: signedUrlCache.get(page.storagePath) ?? null,
    }));

    const questions = questionsByScript.get(script.id) ?? [];
    result.push({
      ...script,
      page_order: pages,
      student_name: script.student_id
        ? (nameById.get(script.student_id) ?? null)
        : null,
      missingPageWarning: scriptHasMissingPageWarning(pages),
      hasConflict: scriptHasConflict(pages),
      hasByteDuplicate: scriptHasByteDuplicate(pages),
      alreadyEvaluated: scriptAlreadyEvaluated(pages),
      pageUrls,
      questions,
      totals: computeScriptTotal(questions),
    });
  }

  return result;
}

export async function assignScriptStudent(
  supabase: SupabaseClient,
  input: {
    batchId: string;
    classId: string;
    scriptId: string;
    studentId: string;
  }
): Promise<ScriptReviewDto> {
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id")
    .eq("id", input.studentId)
    .eq("class_id", input.classId)
    .maybeSingle();

  if (studentError || !student) {
    throw new Error("Student not found in this class");
  }

  const { data: batchMeta, error: batchMetaError } = await supabase
    .from("evaluation_batches")
    .select("assessment_id")
    .eq("id", input.batchId)
    .maybeSingle();

  if (batchMetaError) throw new Error(batchMetaError.message);
  const assessmentId = (batchMeta?.assessment_id as string | null) ?? null;

  if (assessmentId) {
    const prior = await getStudentAssessmentEvalState(supabase, {
      assessmentId,
      studentId: input.studentId,
      currentBatchId: input.batchId,
    });
    if (prior.hasSubmission || prior.priorBatchId) {
      throw new Error(ALREADY_EVALUATED_MESSAGE);
    }
  }

  const { data: script, error: scriptError } = await supabase
    .from("evaluated_scripts")
    .select("*")
    .eq("id", input.scriptId)
    .eq("batch_id", input.batchId)
    .maybeSingle();

  if (scriptError || !script) {
    throw new Error("Script not found");
  }

  const pages = asPages(script.page_order);
  const { data: siblingRows, error: siblingError } = await supabase
    .from("evaluated_scripts")
    .select("*")
    .eq("batch_id", input.batchId);

  if (siblingError) throw new Error(siblingError.message);

  const siblings = ((siblingRows ?? []) as EvaluatedScript[]).filter(
    (s) => s.id !== input.scriptId
  );
  const thisHashes = new Set(
    pages.map((p) => p.contentHash).filter(Boolean) as string[]
  );
  const thisPaths = new Set(pages.map((p) => p.storagePath));

  const existingForStudent = siblings.find(
    (s) => s.student_id === input.studentId
  );
  const hashPathSiblings = siblings.filter((s) => {
    const sp = asPages(s.page_order);
    return sp.some(
      (p) =>
        (p.contentHash && thisHashes.has(p.contentHash)) ||
        thisPaths.has(p.storagePath)
    );
  });

  // Merge into the student's existing script when assign would create a second
  // script for the same student (common when one copy lacked a readable ID).
  if (existingForStudent) {
    const existingPages = asPages(existingForStudent.page_order);
    const incoming = pages.map((p) => ({ ...p, conflict: true }));
    for (const page of existingPages) {
      const overlaps = incoming.some(
        (p) =>
          (p.contentHash &&
            page.contentHash &&
            p.contentHash === page.contentHash) ||
          p.storagePath === page.storagePath
      );
      if (overlaps) page.conflict = true;
    }
    // Always mark at least the incoming pages as conflict when merging.
    const merged = sortPagesByQuestion([...existingPages, ...incoming]);

    const { error: mergeError } = await supabase
      .from("evaluated_scripts")
      .update({
        page_order: merged,
        match_confidence: "low",
        status: "identity_amber",
        student_id: input.studentId,
      })
      .eq("id", existingForStudent.id)
      .eq("batch_id", input.batchId);

    if (mergeError) throw new Error(mergeError.message);

    const { error: deleteError } = await supabase
      .from("evaluated_scripts")
      .delete()
      .eq("id", input.scriptId)
      .eq("batch_id", input.batchId);

    if (deleteError) throw new Error(deleteError.message);

    const list = await listBatchScriptsForReview(
      supabase,
      input.batchId,
      input.classId
    );
    const updated = list.find((s) => s.id === existingForStudent.id);
    if (!updated) throw new Error("Script not found after merge assign");
    return updated;
  }

  // Shared blob with another script (no student yet on either / different students).
  if (hashPathSiblings.length > 0) {
    const conflictPages = pages.map((p) => ({ ...p, conflict: true }));
    const { error: updateError } = await supabase
      .from("evaluated_scripts")
      .update({
        student_id: input.studentId,
        match_confidence: "low",
        status: "identity_amber",
        page_order: conflictPages,
      })
      .eq("id", input.scriptId)
      .eq("batch_id", input.batchId);

    if (updateError) throw new Error(updateError.message);

    for (const sibling of hashPathSiblings) {
      const sp = asPages(sibling.page_order).map((p) => {
        const overlaps =
          (p.contentHash && thisHashes.has(p.contentHash)) ||
          thisPaths.has(p.storagePath);
        return overlaps ? { ...p, conflict: true } : p;
      });
      const { error: siblingError } = await supabase
        .from("evaluated_scripts")
        .update({
          page_order: sp,
          match_confidence: "low",
          status: "identity_amber",
          student_id: null,
        })
        .eq("id", sibling.id)
        .eq("batch_id", input.batchId);
      if (siblingError) throw new Error(siblingError.message);
    }
  } else {
    const { error: updateError } = await supabase
      .from("evaluated_scripts")
      .update({
        student_id: input.studentId,
        match_confidence: "high",
        status: "evaluating",
      })
      .eq("id", input.scriptId)
      .eq("batch_id", input.batchId);

    if (updateError) throw new Error(updateError.message);
  }

  const list = await listBatchScriptsForReview(
    supabase,
    input.batchId,
    input.classId
  );
  const updated = list.find((s) => s.id === input.scriptId);
  if (!updated) throw new Error("Script not found after assign");
  return updated;
}

/** Remove a duplicate or mistaken script from an open session. */
export async function removeScriptFromBatch(
  supabase: SupabaseClient,
  input: { batchId: string; classId: string; scriptId: string }
): Promise<void> {
  const { data: scripts, error: scriptsError } = await supabase
    .from("evaluated_scripts")
    .select("id, status, page_order, student_id, created_at")
    .eq("batch_id", input.batchId);

  if (scriptsError) throw new Error(scriptsError.message);

  const script = (scripts ?? []).find((s) => s.id === input.scriptId);
  if (!script) {
    throw new Error("Script not found");
  }

  const status = script.status as string;
  const pages = asPages(script.page_order);
  const duplicateIds = findContentHashDuplicateScriptIds(
    (scripts ?? []).map((s) => ({
      id: s.id,
      student_id: s.student_id,
      created_at: s.created_at,
      page_order: s.page_order,
    }))
  );
  const isHashDuplicate = duplicateIds.includes(input.scriptId);

  const removable =
    status === "pending" ||
    status === "identity_amber" ||
    scriptAlreadyEvaluated(pages) ||
    isHashDuplicate;

  if (!removable || status === "signed_off") {
    throw new Error(
      "Only pending, amber, or content-hash duplicate scripts can be removed"
    );
  }

  const { error: deleteError } = await supabase
    .from("evaluated_scripts")
    .delete()
    .eq("id", input.scriptId)
    .eq("batch_id", input.batchId);

  if (deleteError) throw new Error(deleteError.message);

  const { refreshBatchStatusRollup } = await import(
    "@/lib/evaluation/batch-status"
  );
  await refreshBatchStatusRollup(supabase, input.batchId);
}

/**
 * Delete newer scripts that reuse content hashes/paths already on an older
 * script in the same batch (legacy duplicate rows from before upload guards).
 */
export async function removeContentHashDuplicateScripts(
  supabase: SupabaseClient,
  batchId: string
): Promise<number> {
  const { data: scripts, error } = await supabase
    .from("evaluated_scripts")
    .select("id, student_id, created_at, page_order, status")
    .eq("batch_id", batchId);

  if (error) throw new Error(error.message);

  const removeIds = findContentHashDuplicateScriptIds(
    (scripts ?? []).map((s) => ({
      id: s.id,
      student_id: s.student_id,
      created_at: s.created_at,
      page_order: s.page_order,
    }))
  ).filter((id) => {
    const row = (scripts ?? []).find((s) => s.id === id);
    return row?.status !== "signed_off";
  });

  if (removeIds.length === 0) return 0;

  const { error: deleteError } = await supabase
    .from("evaluated_scripts")
    .delete()
    .eq("batch_id", batchId)
    .in("id", removeIds);

  if (deleteError) throw new Error(deleteError.message);

  const { refreshBatchStatusRollup } = await import(
    "@/lib/evaluation/batch-status"
  );
  await refreshBatchStatusRollup(supabase, batchId);
  return removeIds.length;
}
