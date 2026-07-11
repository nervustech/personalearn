import type { SupabaseClient } from "@supabase/supabase-js";
import {
  groupPagesByAdmission,
  scriptHasByteDuplicate,
  scriptHasConflict,
  scriptHasMissingPageWarning,
  type RosterStudent,
} from "@/lib/evaluation/group-pages";
import {
  compareQuestionLabels,
  normalizeQuestionLabel,
} from "@/lib/evaluation/normalize-question";
import { readScriptPageFromImage } from "@/lib/evaluation/read-script-page";
import type {
  EvaluatedScript,
  EvaluatedScriptPage,
} from "@/types/database";

export type ScriptReviewDto = EvaluatedScript & {
  student_name: string | null;
  missingPageWarning: boolean;
  hasConflict: boolean;
  hasByteDuplicate: boolean;
  pageUrls: {
    storagePath: string;
    uploadIndex: number;
    fileName: string;
    url: string | null;
  }[];
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
  const signedUrlCache = new Map<string, string | null>();

  for (const script of rows) {
    const pages = asPages(script.page_order);
    const pageUrls: ScriptReviewDto["pageUrls"] = [];
    for (const page of pages) {
      let url: string | null;
      if (signedUrlCache.has(page.storagePath)) {
        url = signedUrlCache.get(page.storagePath) ?? null;
      } else {
        const { data: signed } = await supabase.storage
          .from("student_submissions")
          .createSignedUrl(page.storagePath, 3600);
        url = signed?.signedUrl ?? null;
        signedUrlCache.set(page.storagePath, url);
      }
      pageUrls.push({
        storagePath: page.storagePath,
        uploadIndex: page.uploadIndex,
        fileName: page.fileName,
        url,
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
      hasByteDuplicate: scriptHasByteDuplicate(pages),
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
    contentHash?: string;
    duplicate?: boolean;
  }[] = [];

  for (const script of scripts) {
    for (const page of asPages(script.page_order)) {
      pendingPages.push({
        storagePath: page.storagePath,
        fileName: page.fileName,
        uploadIndex: page.uploadIndex,
        contentHash: page.contentHash,
        duplicate: page.duplicate,
      });
    }
  }

  if (!pendingPages.length) {
    throw new Error("No uploaded pages to process");
  }

  // One vision call per unique storage blob (byte-deduped uploads share a path).
  const readByPath = new Map<
    string,
    { admissionNumber: string | null; questionNumbers: string[] }
  >();

  for (const page of pendingPages) {
    if (readByPath.has(page.storagePath)) continue;

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
    readByPath.set(page.storagePath, read);
  }

  const pageReads = pendingPages.map((page) => {
    const read = readByPath.get(page.storagePath)!;
    return {
      ...page,
      admissionNumber: read.admissionNumber,
      questionNumbers: read.questionNumbers,
    };
  });

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
        status: "identity_cleared",
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
