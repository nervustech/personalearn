import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { requireTeacherEvaluationBatch } from "@/lib/evaluation/batches";
import { listBatchScriptsForReview } from "@/lib/evaluation/identity";
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await context.params;
    const supabase = await createClient();
    const batch = await requireTeacherEvaluationBatch(supabase, batchId);
    await requireTeacherClass(supabase, batch.class_id);

    const scripts = await listBatchScriptsForReview(
      supabase,
      batchId,
      batch.class_id
    );

    return NextResponse.json({ scripts, batch });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load scripts";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}
