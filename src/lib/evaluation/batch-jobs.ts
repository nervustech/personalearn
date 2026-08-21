import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeminiBatchJob, GeminiBatchJobPhase } from "@/types/database";

export const INFLIGHT_GEMINI_JOB_STATES = ["submitted", "running"] as const;

export function isUniqueInflightJobError(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "23505" ||
    message.includes("duplicate") ||
    message.includes("idx_gemini_batch_jobs_one_inflight")
  );
}

export async function findInflightGeminiJob(
  supabase: SupabaseClient,
  input: { batchId: string; phase: GeminiBatchJobPhase }
): Promise<GeminiBatchJob | null> {
  const { data, error } = await supabase
    .from("gemini_batch_jobs")
    .select("*")
    .eq("batch_id", input.batchId)
    .eq("phase", input.phase)
    .in("state", [...INFLIGHT_GEMINI_JOB_STATES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as GeminiBatchJob | null) ?? null;
}

export async function insertGeminiBatchJob(
  supabase: SupabaseClient,
  row: {
    batch_id: string;
    phase: GeminiBatchJobPhase;
    provider_batch_name: string;
    state: "submitted";
    page_count?: number;
    script_count?: number;
    submitted_at: string;
  }
): Promise<GeminiBatchJob> {
  const { data: job, error: jobError } = await supabase
    .from("gemini_batch_jobs")
    .insert(row)
    .select("*")
    .single();

  if (!jobError && job) return job as GeminiBatchJob;

  if (isUniqueInflightJobError(jobError)) {
    const raced = await findInflightGeminiJob(supabase, {
      batchId: row.batch_id,
      phase: row.phase,
    });
    if (raced) return raced;
  }

  throw new Error(jobError?.message ?? "Job insert failed");
}
