import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvaluationBatch } from "@/types/database";

/**
 * Load marking scheme text for a batch.
 * Returns null when no scheme is attached or text is empty (→ ai_estimate path).
 */
export async function loadMarkingSchemeText(
  supabase: SupabaseClient,
  batch: Pick<EvaluationBatch, "marking_scheme_resource_id">
): Promise<string | null> {
  const resourceId = batch.marking_scheme_resource_id;
  if (!resourceId) return null;

  const { data, error } = await supabase
    .from("resources")
    .select("raw_content")
    .eq("id", resourceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const raw = data.raw_content as { text?: unknown };
  const text = typeof raw?.text === "string" ? raw.text.trim() : "";
  return text.length > 0 ? text : null;
}
