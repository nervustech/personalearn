import type { SupabaseClient } from "@supabase/supabase-js";
import {
  groupPagesByAdmission,
  scriptHasConflict,
  scriptHasMissingPageWarning,
  type RosterStudent,
} from "@/lib/evaluation/group-pages";
import { readScriptPageFromImage } from "@/lib/evaluation/read-script-page";
import type {
  EvaluatedScript,
  EvaluatedScriptPage,
} from "@/types/database";

export type ScriptReviewDto = EvaluatedScript & {
  student_name: string | null;
  missingPageWarning: boolean;
  hasConflict: boolean;
  pageUrls: { storagePath: string; url: string | null }[];
};

function mimeFromPath(storagePath: string): string {
  return storagePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
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
  const result: ScriptReviewDto[] = [];

  for (const script of rows) {
    const pages = asPages(script.page_order);
    const pageUrls: ScriptReviewDto["pageUrls"] = [];
    for (const page of pages) {
      const { data: signed } = await supabase.storage
        .from("student_submissions")
        .createSignedUrl(page.storagePath, 3600);
      pageUrls.push({
        storagePath: page.storagePath,
        url: signed?.signedUrl ?? null,
      });
    }

    result.push({
      ...script,
      page_order: pages,
      student_name: script.student_id
        ? (nameById.get(script.student_id) ?? null)
        : null,
      missingPageWarning: scriptHasMissingPageWarning(pages),
      hasConflict: scriptHasConflict(pages),
      pageUrls,
    });
  }

  return result;
}

export async function processBatchIdentity(
  supabase: SupabaseClient,
  batchId: string,
  classId: string
): Promise<ScriptReviewDto[]> {
  const { data: existing, error: existingError } = await supabase
    .from("evaluated_scripts")
    .select("*")
    .eq("batch_id", batchId);

  if (existingError) throw new Error(existingError.message);

  const scripts = (existing ?? []) as EvaluatedScript[];
  if (!scripts.length) {
    throw new Error("No uploaded pages to process");
  }

  const nonPending = scripts.filter((s) => s.status !== "pending");
  if (nonPending.length > 0) {
    throw new Error(
      "Identity already processed for this batch. Open the review page to confirm amber matches."
    );
  }

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, full_name, admission_number")
    .eq("class_id", classId);

  if (studentsError) throw new Error(studentsError.message);
  const roster = (students ?? []) as RosterStudent[];

  const pendingPages: {
    storagePath: string;
    fileName: string;
    uploadIndex: number;
  }[] = [];

  for (const script of scripts) {
    for (const page of asPages(script.page_order)) {
      pendingPages.push({
        storagePath: page.storagePath,
        fileName: page.fileName,
        uploadIndex: page.uploadIndex,
      });
    }
  }

  if (!pendingPages.length) {
    throw new Error("No uploaded pages to process");
  }

  const pageReads = [];
  for (const page of pendingPages) {
    const { data: blob, error: downloadError } = await supabase.storage
      .from("student_submissions")
      .download(page.storagePath);

    if (downloadError || !blob) {
      throw new Error(
        downloadError?.message ?? `Could not download ${page.storagePath}`
      );
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const read = await readScriptPageFromImage({
      bytes,
      mimeType: mimeFromPath(page.storagePath),
    });

    pageReads.push({
      ...page,
      admissionNumber: read.admissionNumber,
      questionNumbers: read.questionNumbers,
    });
  }

  const drafts = groupPagesByAdmission(pageReads, roster);

  const pendingIds = scripts.map((s) => s.id);
  const { error: deleteError } = await supabase
    .from("evaluated_scripts")
    .delete()
    .in("id", pendingIds);

  if (deleteError) throw new Error(deleteError.message);

  const inserts = drafts.map((draft) => ({
    batch_id: batchId,
    student_id: draft.student_id,
    read_admission_number: draft.read_admission_number,
    match_confidence: draft.match_confidence,
    page_order: draft.page_order,
    status: draft.status,
  }));

  const { error: insertError } = await supabase
    .from("evaluated_scripts")
    .insert(inserts);

  if (insertError) throw new Error(insertError.message);

  return listBatchScriptsForReview(supabase, batchId, classId);
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

  const { data: script, error: scriptError } = await supabase
    .from("evaluated_scripts")
    .select("*")
    .eq("id", input.scriptId)
    .eq("batch_id", input.batchId)
    .maybeSingle();

  if (scriptError || !script) {
    throw new Error("Script not found");
  }

  const { error: updateError } = await supabase
    .from("evaluated_scripts")
    .update({
      student_id: input.studentId,
      match_confidence: "high",
      status: "identity_cleared",
    })
    .eq("id", input.scriptId)
    .eq("batch_id", input.batchId);

  if (updateError) throw new Error(updateError.message);

  const list = await listBatchScriptsForReview(
    supabase,
    input.batchId,
    input.classId
  );
  const updated = list.find((s) => s.id === input.scriptId);
  if (!updated) throw new Error("Script not found after assign");
  return updated;
}
