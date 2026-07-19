import { after } from "next/server";
import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { requireTeacherEvaluationBatch } from "@/lib/evaluation/batches";
import { processBatchDrafts } from "@/lib/evaluation/drafts";
import { processBatchIdentity } from "@/lib/evaluation/identity";
import { createClient } from "@/lib/supabase/server";

function authStatus(message: string) {
  if (message === "Not authenticated") return 401;
  if (
    message === "Class not found" ||
    message === "Evaluation batch not found"
  ) {
    return 403;
  }
  return 500;
}

/**
 * F3: Start async identity + draft pipeline (processing → drafted).
 * Returns immediately so the teacher can keep using the app.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await context.params;
    const supabase = await createClient();
    const batch = await requireTeacherEvaluationBatch(supabase, batchId);
    await requireTeacherClass(supabase, batch.class_id);

    if (batch.status === "signed_off") {
      return NextResponse.json(
        { error: "Batch is already signed off" },
        { status: 400 }
      );
    }

    await supabase
      .from("evaluation_batches")
      .update({ status: "processing" })
      .eq("id", batchId);

    const reviewHref = `/classes/${batch.class_id}/evaluations/${batchId}`;

    const classId = batch.class_id;

    after(async () => {
      try {
        await processBatchIdentity(supabase, batchId, classId);
        await processBatchDrafts(supabase, batchId);
      } catch (error) {
        console.error("[process-async] batch failed", batchId, error);
        await supabase
          .from("evaluation_batches")
          .update({ status: "draft" })
          .eq("id", batchId)
          .eq("status", "processing");
      }
    });

    return NextResponse.json({
      started: true,
      batchId,
      status: "processing",
      reviewHref,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start processing";
    return NextResponse.json(
      { error: message },
      { status: authStatus(message) }
    );
  }
}
