/**
 * One-off: re-queue ready scripts and submit evaluate for an existing batch
 * (no re-index / no new uploads).
 *
 * Usage: npx tsx scripts/regrade-batch.ts <batchId>
 */
import { createClient } from "@supabase/supabase-js";
import { startOrResumeBatchProcessing } from "../src/lib/evaluation/poll-batches";
import type { EvaluationBatch } from "../src/types/database";

async function main() {
  const batchId = process.argv[2];
  if (!batchId) {
    console.error("Usage: npx tsx scripts/regrade-batch.ts <batchId>");
    process.exit(1);
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: batch, error } = await sb
    .from("evaluation_batches")
    .select("*")
    .eq("id", batchId)
    .single();
  if (error || !batch) throw new Error(error?.message ?? "Batch not found");

  const result = await startOrResumeBatchProcessing(
    sb,
    batch as EvaluationBatch
  );
  console.log(
    JSON.stringify(
      {
        phase: result.phase,
        jobId: result.job.id,
        provider: result.job.provider_batch_name,
        state: result.job.state,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
