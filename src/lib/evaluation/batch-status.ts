import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EvaluatedScriptStatus,
  EvaluationBatchStatus,
} from "@/types/database";

const IN_FLIGHT_SCRIPT_STATUSES: EvaluatedScriptStatus[] = [
  "uploaded",
  "indexing",
  "evaluating",
  "pending",
  "parsing",
  "queued_draft",
  "drafting",
];

/** Derive batch rollup status from script rows (ADR-005). */
export function deriveBatchStatus(
  scriptStatuses: EvaluatedScriptStatus[]
): EvaluationBatchStatus {
  if (scriptStatuses.length === 0) return "draft";

  const hasInFlight = scriptStatuses.some((s) =>
    IN_FLIGHT_SCRIPT_STATUSES.includes(s)
  );
  if (hasInFlight) return "processing";

  const readyOrSigned = scriptStatuses.filter(
    (s) => s === "ready" || s === "signed_off" || s === "drafted"
  );

  if (
    readyOrSigned.length > 0 &&
    readyOrSigned.every((s) => s === "signed_off")
  ) {
    return "signed_off";
  }

  if (scriptStatuses.some((s) => s === "ready" || s === "drafted")) {
    return "in_review";
  }

  return "draft";
}

export async function refreshBatchStatusRollup(
  supabase: SupabaseClient,
  batchId: string
): Promise<EvaluationBatchStatus> {
  const { data: scripts, error } = await supabase
    .from("evaluated_scripts")
    .select("status")
    .eq("batch_id", batchId);

  if (error) throw new Error(error.message);

  const next = deriveBatchStatus(
    (scripts ?? []).map((row) => row.status as EvaluatedScriptStatus)
  );

  const { error: updateError } = await supabase
    .from("evaluation_batches")
    .update({ status: next })
    .eq("id", batchId);

  if (updateError) throw new Error(updateError.message);

  return next;
}
