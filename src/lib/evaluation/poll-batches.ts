import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildEvaluateBatchLine,
  buildIndexBatchLine,
  downloadBatchResults,
  getBatchJobStatus,
  submitBatchJob,
} from "@/lib/evaluation/batch-client";
import {
  groupPagesByAdmission,
  type PageWithIndex,
} from "@/lib/evaluation/group-by-admission";
import { loadMarkingSchemeText } from "@/lib/evaluation/load-marking-scheme";
import { parseEvaluateResult } from "@/lib/evaluation/evaluate-schema";
import { parseIndexResult } from "@/lib/evaluation/index-schema";
import { mimeFromStoragePath } from "@/lib/evaluation/page-images";
import {
  persistEvaluateResults,
  persistIndexResults,
  upsertScriptFromGroup,
  markScriptFailed,
} from "@/lib/evaluation/persist-results";
import { refreshBatchStatusRollup } from "@/lib/evaluation/batch-status";
import { withRetries } from "@/lib/evaluation/retries";
import type { EvaluationBatch, GeminiBatchJob } from "@/types/database";

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function downloadPageBase64(
  supabase: SupabaseClient,
  storagePath: string,
  cache: Map<string, { base64: string; mimeType: string }>
): Promise<{ base64: string; mimeType: string }> {
  const cached = cache.get(storagePath);
  if (cached) return cached;

  const { data: blob, error } = await supabase.storage
    .from("student_submissions")
    .download(storagePath);

  if (error || !blob) {
    throw new Error(error?.message ?? `Could not download ${storagePath}`);
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const result = {
    base64: bytesToBase64(bytes),
    mimeType: mimeFromStoragePath(storagePath),
  };
  cache.set(storagePath, result);
  return result;
}

export async function submitIndexBatch(
  supabase: SupabaseClient,
  batch: EvaluationBatch
): Promise<GeminiBatchJob> {
  const { data: pages, error } = await supabase
    .from("evaluation_pages")
    .select("*")
    .eq("batch_id", batch.id)
    .is("admission_number", null)
    .order("upload_index");

  if (error) throw new Error(error.message);
  if (!pages?.length) {
    throw new Error("No pages to index");
  }

  const cache = new Map<string, { base64: string; mimeType: string }>();
  const lines = [];

  for (const page of pages) {
    const img = await downloadPageBase64(supabase, page.storage_path, cache);
    lines.push(
      buildIndexBatchLine({
        key: page.id,
        imageBase64: img.base64,
        mimeType: img.mimeType,
      })
    );
  }

  const { providerBatchName } = await submitBatchJob({
    displayName: `index-${batch.id}`,
    lines,
  });

  const { data: job, error: jobError } = await supabase
    .from("gemini_batch_jobs")
    .insert({
      batch_id: batch.id,
      phase: "index",
      provider_batch_name: providerBatchName,
      state: "submitted",
      page_count: pages.length,
      submitted_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (jobError || !job) throw new Error(jobError?.message ?? "Job insert failed");

  await supabase
    .from("evaluated_scripts")
    .update({ status: "indexing" })
    .eq("batch_id", batch.id)
    .in("status", ["uploaded", "pending"]);

  await supabase
    .from("evaluation_batches")
    .update({ status: "processing" })
    .eq("id", batch.id);

  return job as GeminiBatchJob;
}

async function processCompletedIndexBatch(
  supabase: SupabaseClient,
  batch: EvaluationBatch,
  job: GeminiBatchJob
): Promise<void> {
  if (!job.provider_batch_name) throw new Error("Missing provider batch name");

  const results = await downloadBatchResults(job.provider_batch_name);

  for (const line of results) {
    if (line.error || !line.text) continue;
    try {
      const index = parseIndexResult(JSON.parse(line.text));
      await persistIndexResults(supabase, {
        batchId: batch.id,
        pageId: line.key,
        index,
        modelId: "batch",
      });
    } catch (e) {
      console.error(`Index parse failed for ${line.key}`, e);
    }
  }

  const { data: pages, error } = await supabase
    .from("evaluation_pages")
    .select("*")
    .eq("batch_id", batch.id);

  if (error) throw new Error(error.message);

  const { data: roster } = await supabase
    .from("students")
    .select("id, admission_number, full_name")
    .eq("class_id", batch.class_id);

  const indexedPages: PageWithIndex[] = (pages ?? []).map((p) => ({
    pageId: p.id,
    storagePath: p.storage_path,
    fileName: p.file_name,
    uploadIndex: p.upload_index,
    contentHash: p.content_hash,
    index: {
      admission_number: p.admission_number,
      admission_confidence: Number(p.admission_confidence ?? 0),
      page_number: p.page_number,
      total_pages: p.total_pages,
      questions_found: (p.questions_found as string[]) ?? [],
    },
  }));

  const groups = groupPagesByAdmission({
    pages: indexedPages,
    roster: roster ?? [],
  });

  for (const group of groups) {
    await upsertScriptFromGroup(supabase, { batchId: batch.id, group });
  }

  await supabase
    .from("gemini_batch_jobs")
    .update({
      state: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  await submitEvaluateBatch(supabase, batch);
}

export async function submitEvaluateBatch(
  supabase: SupabaseClient,
  batch: EvaluationBatch
): Promise<GeminiBatchJob | null> {
  const markingScheme = await loadMarkingSchemeText(supabase, batch);

  const { data: scripts, error } = await supabase
    .from("evaluated_scripts")
    .select("id, status, page_order")
    .eq("batch_id", batch.id)
    .eq("status", "evaluating");

  if (error) throw new Error(error.message);
  if (!scripts?.length) {
    await refreshBatchStatusRollup(supabase, batch.id);
    return null;
  }

  const cache = new Map<string, { base64: string; mimeType: string }>();
  const lines = [];

  for (const script of scripts) {
    const pageOrder = (script.page_order ?? []) as Array<{ storagePath: string }>;
    const images = [];
    for (const page of pageOrder) {
      const img = await downloadPageBase64(supabase, page.storagePath, cache);
      images.push(img);
    }
    if (!images.length) continue;

    lines.push(
      buildEvaluateBatchLine({
        key: script.id,
        images,
        markingScheme,
      })
    );
  }

  if (!lines.length) return null;

  const { providerBatchName } = await submitBatchJob({
    displayName: `evaluate-${batch.id}`,
    lines,
  });

  const { data: job, error: jobError } = await supabase
    .from("gemini_batch_jobs")
    .insert({
      batch_id: batch.id,
      phase: "evaluate",
      provider_batch_name: providerBatchName,
      state: "submitted",
      script_count: lines.length,
      submitted_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (jobError || !job) throw new Error(jobError?.message ?? "Job insert failed");
  return job as GeminiBatchJob;
}

async function processCompletedEvaluateBatch(
  supabase: SupabaseClient,
  batch: EvaluationBatch,
  job: GeminiBatchJob
): Promise<void> {
  if (!job.provider_batch_name) throw new Error("Missing provider batch name");

  const markingScheme = await loadMarkingSchemeText(supabase, batch);
  const results = await downloadBatchResults(job.provider_batch_name);

  for (const line of results) {
    if (line.error || !line.text) {
      if (line.key) {
        await markScriptFailed(
          supabase,
          line.key,
          line.error ?? "Empty batch response"
        );
      }
      continue;
    }
    try {
      const result = parseEvaluateResult(JSON.parse(line.text));
      await persistEvaluateResults(supabase, {
        scriptId: line.key,
        result,
        modelId: "batch",
        hasMarkingScheme: Boolean(markingScheme),
      });
    } catch (e) {
      console.error(`Evaluate parse failed for ${line.key}`, e);
      await markScriptFailed(
        supabase,
        line.key,
        e instanceof Error ? e.message : "Evaluate parse failed"
      );
    }
  }

  await supabase
    .from("gemini_batch_jobs")
    .update({
      state: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  await refreshBatchStatusRollup(supabase, batch.id);
}

export async function pollPendingBatchJobs(
  supabase: SupabaseClient
): Promise<number> {
  const { data: jobs, error } = await supabase
    .from("gemini_batch_jobs")
    .select("*, evaluation_batches(*)")
    .in("state", ["submitted", "running"]);

  if (error) throw new Error(error.message);
  let processed = 0;

  for (const row of jobs ?? []) {
    const job = row as GeminiBatchJob & { evaluation_batches: EvaluationBatch };
    if (!job.provider_batch_name) continue;

    const status = await withRetries(
      () => getBatchJobStatus(job.provider_batch_name!),
      { label: "getBatchJobStatus", maxAttempts: 3 }
    );

    if (!status.done) {
      if (job.state === "submitted") {
        await supabase
          .from("gemini_batch_jobs")
          .update({ state: "running" })
          .eq("id", job.id);
      }
      continue;
    }

    if (status.failed) {
      await supabase
        .from("gemini_batch_jobs")
        .update({
          state: "failed",
          error: status.error ?? "Batch failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      processed++;
      continue;
    }

    const batch = job.evaluation_batches;
    if (job.phase === "index") {
      await processCompletedIndexBatch(supabase, batch, job);
    } else {
      await processCompletedEvaluateBatch(supabase, batch, job);
    }
    processed++;
  }

  return processed;
}

/** Live sync: index + group + evaluate one student packet immediately. */
export async function runLiveEvaluation(
  supabase: SupabaseClient,
  batch: EvaluationBatch,
  scriptId: string
): Promise<void> {
  const markingScheme = await loadMarkingSchemeText(supabase, batch);

  const { data: pages, error: pagesError } = await supabase
    .from("evaluation_pages")
    .select("*")
    .eq("batch_id", batch.id)
    .eq("script_id", scriptId)
    .order("upload_index");

  if (pagesError) throw new Error(pagesError.message);
  if (!pages?.length) throw new Error("No pages for script");

  const { syncIndexPage, syncEvaluateScript } = await import(
    "@/lib/evaluation/sync-client"
  );

  const cache = new Map<string, { base64: string; mimeType: string }>();
  const indexedPages: PageWithIndex[] = [];

  for (const page of pages) {
    const img = await downloadPageBase64(supabase, page.storage_path, cache);
    const { result, modelId } = await syncIndexPage({
      images: [{ mimeType: img.mimeType, base64: img.base64 }],
    });
    await persistIndexResults(supabase, {
      batchId: batch.id,
      pageId: page.id,
      index: result,
      modelId,
    });
    indexedPages.push({
      pageId: page.id,
      storagePath: page.storage_path,
      fileName: page.file_name,
      uploadIndex: page.upload_index,
      contentHash: page.content_hash,
      index: result,
    });
  }

  const { data: roster } = await supabase
    .from("students")
    .select("id, admission_number, full_name")
    .eq("class_id", batch.class_id);

  const groups = groupPagesByAdmission({
    pages: indexedPages,
    roster: roster ?? [],
  });

  const group = groups[0];
  if (!group) throw new Error("Could not group pages");

  await upsertScriptFromGroup(supabase, {
    batchId: batch.id,
    group,
    existingScriptId: scriptId,
  });

  if (group.status === "identity_amber" || group.status === "unmatched") {
    return;
  }

  const images = [];
  for (const p of group.pages) {
    const img = await downloadPageBase64(supabase, p.storagePath, cache);
    images.push({ mimeType: img.mimeType, base64: img.base64 });
  }

  await supabase
    .from("evaluated_scripts")
    .update({ status: "evaluating" })
    .eq("id", scriptId);

  const { result, modelId } = await syncEvaluateScript({
    images,
    markingScheme,
  });

  await persistEvaluateResults(supabase, {
    scriptId,
    result,
    modelId,
    hasMarkingScheme: Boolean(markingScheme),
  });

  await refreshBatchStatusRollup(supabase, batch.id);
}
