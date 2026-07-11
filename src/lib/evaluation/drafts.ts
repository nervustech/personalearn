import type { SupabaseClient } from "@supabase/supabase-js";
import {
  draftQuestionFromImages,
  listQuestionsFromImages,
  questionEvaluationStatusForScheme,
  type DraftPageImage,
} from "@/lib/evaluation/draft-question";
import { loadMarkingSchemeText } from "@/lib/evaluation/load-marking-scheme";
import {
  compareQuestionLabels,
  normalizeQuestionLabel,
} from "@/lib/evaluation/normalize-question";
import type {
  EvaluatedScript,
  EvaluatedScriptPage,
  EvaluationBatch,
} from "@/types/database";

export type ProcessDraftsSummary = {
  drafted: number;
  skippedAmber: number;
  skippedPending: number;
  skippedAlreadyDrafted: number;
  skippedOther: number;
  errors: { scriptId: string; message: string }[];
};

function mimeFromPath(storagePath: string): string {
  return storagePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

function asPages(pageOrder: unknown): EvaluatedScriptPage[] {
  if (!Array.isArray(pageOrder)) return [];
  return pageOrder as EvaluatedScriptPage[];
}

function coerceLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeQuestionLabel(item))
    .filter((x): x is string => Boolean(x));
}

function uniqueQuestionLabels(pages: EvaluatedScriptPage[]): string[] {
  const set = new Set<string>();
  for (const page of pages) {
    for (const q of coerceLabels(page.questionNumbers)) {
      set.add(q);
    }
  }
  return [...set].sort(compareQuestionLabels);
}

async function downloadPageBytes(
  supabase: SupabaseClient,
  storagePath: string,
  cache: Map<string, DraftPageImage>
): Promise<DraftPageImage> {
  const cached = cache.get(storagePath);
  if (cached) return cached;

  const { data: blob, error } = await supabase.storage
    .from("student_submissions")
    .download(storagePath);

  if (error || !blob) {
    throw new Error(error?.message ?? `Could not download ${storagePath}`);
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const image: DraftPageImage = {
    bytes,
    mimeType: mimeFromPath(storagePath),
  };
  cache.set(storagePath, image);
  return image;
}

function pagesForQuestion(
  pages: EvaluatedScriptPage[],
  questionLabel: string
): EvaluatedScriptPage[] {
  const matched = pages.filter((p) =>
    coerceLabels(p.questionNumbers).includes(questionLabel)
  );
  return matched.length > 0 ? matched : pages;
}

export async function processScriptDraft(
  supabase: SupabaseClient,
  input: {
    script: EvaluatedScript;
    schemeText: string | null;
    pageCache?: Map<string, DraftPageImage>;
  }
): Promise<void> {
  const { script, schemeText } = input;
  if (script.status !== "identity_cleared") {
    throw new Error(
      `Script ${script.id} is not identity_cleared (status: ${script.status})`
    );
  }

  const pages = asPages(script.page_order);
  const cache = input.pageCache ?? new Map<string, DraftPageImage>();
  const status = questionEvaluationStatusForScheme(schemeText);

  const allImages: DraftPageImage[] = [];
  const seenPaths = new Set<string>();
  for (const page of pages) {
    if (seenPaths.has(page.storagePath)) continue;
    seenPaths.add(page.storagePath);
    allImages.push(await downloadPageBytes(supabase, page.storagePath, cache));
  }

  let questionLabels = uniqueQuestionLabels(pages);
  if (questionLabels.length === 0 && allImages.length > 0) {
    questionLabels = await listQuestionsFromImages(allImages);
  }

  if (questionLabels.length === 0) {
    throw new Error(
      `No question labels found on script ${script.id}; cannot draft marks`
    );
  }

  const rows: {
    script_id: string;
    question_number: string;
    awarded: number | null;
    max: number | null;
    feedback: string | null;
    status: typeof status;
  }[] = [];

  for (const label of questionLabels) {
    const qPages = pagesForQuestion(pages, label);
    const images: DraftPageImage[] = [];
    const qSeen = new Set<string>();
    for (const page of qPages) {
      if (qSeen.has(page.storagePath)) continue;
      qSeen.add(page.storagePath);
      images.push(await downloadPageBytes(supabase, page.storagePath, cache));
    }

    const draft = await draftQuestionFromImages({
      pages: images,
      questionLabel: label,
      schemeText,
    });

    rows.push({
      script_id: script.id,
      question_number: label,
      awarded: draft.awarded,
      max: draft.max,
      feedback: draft.feedback,
      status,
    });
  }

  const { error: deleteError } = await supabase
    .from("question_evaluations")
    .delete()
    .eq("script_id", script.id);

  if (deleteError) throw new Error(deleteError.message);

  const { error: insertError } = await supabase
    .from("question_evaluations")
    .insert(rows);

  if (insertError) throw new Error(insertError.message);

  const { error: updateError } = await supabase
    .from("evaluated_scripts")
    .update({ status: "drafted" })
    .eq("id", script.id)
    .eq("batch_id", script.batch_id);

  if (updateError) throw new Error(updateError.message);
}

export async function processBatchDrafts(
  supabase: SupabaseClient,
  batchId: string
): Promise<ProcessDraftsSummary> {
  const { data: batch, error: batchError } = await supabase
    .from("evaluation_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();

  if (batchError) throw new Error(batchError.message);
  if (!batch) throw new Error("Evaluation batch not found");

  const schemeText = await loadMarkingSchemeText(
    supabase,
    batch as EvaluationBatch
  );

  const { data: scripts, error: scriptsError } = await supabase
    .from("evaluated_scripts")
    .select("*")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true });

  if (scriptsError) throw new Error(scriptsError.message);

  const summary: ProcessDraftsSummary = {
    drafted: 0,
    skippedAmber: 0,
    skippedPending: 0,
    skippedAlreadyDrafted: 0,
    skippedOther: 0,
    errors: [],
  };

  const pageCache = new Map<string, DraftPageImage>();
  const rows = (scripts ?? []) as EvaluatedScript[];

  for (const script of rows) {
    if (script.status === "identity_amber") {
      summary.skippedAmber += 1;
      continue;
    }
    if (script.status === "pending") {
      summary.skippedPending += 1;
      continue;
    }
    if (script.status === "drafted" || script.status === "signed_off") {
      summary.skippedAlreadyDrafted += 1;
      continue;
    }
    if (script.status !== "identity_cleared") {
      summary.skippedOther += 1;
      continue;
    }

    try {
      await processScriptDraft(supabase, {
        script,
        schemeText,
        pageCache,
      });
      summary.drafted += 1;
    } catch (error) {
      summary.errors.push({
        scriptId: script.id,
        message:
          error instanceof Error ? error.message : "Draft processing failed",
      });
    }
  }

  return summary;
}
