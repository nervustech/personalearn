import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { requireTeacherEvaluationBatch } from "@/lib/evaluation/batches";
import { runLiveEvaluation } from "@/lib/evaluation/poll-batches";
import { createServiceClient } from "@/lib/supabase/service";
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

/** Live sync path: index + evaluate one student script immediately. */
export async function POST(
  request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await context.params;
    const body = (await request.json()) as { scriptId?: string | null };

    const supabase = await createClient();
    const batch = await requireTeacherEvaluationBatch(supabase, batchId);
    await requireTeacherClass(supabase, batch.class_id);

    const service = createServiceClient();
    const scriptId = await runLiveEvaluation(
      service,
      batch,
      body.scriptId ?? null
    );

    const { data: script } = await supabase
      .from("evaluated_scripts")
      .select("id, status")
      .eq("id", scriptId)
      .single();

    return NextResponse.json({
      batchId,
      scriptId,
      status: script?.status ?? "ready",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}
