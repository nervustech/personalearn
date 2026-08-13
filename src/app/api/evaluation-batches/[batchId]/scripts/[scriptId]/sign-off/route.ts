import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { requireTeacherEvaluationBatch } from "@/lib/evaluation/batches";
import { signOffScript } from "@/lib/evaluation/sign-off";
import { createClient } from "@/lib/supabase/server";

function authStatus(message: string) {
  if (message === "Not authenticated") return 401;
  if (
    message === "Class not found" ||
    message === "Evaluation batch not found"
  ) {
    return 403;
  }
  if (message === "Script not found" || message === "Assessment not found") {
    return 404;
  }
  if (
    message === "Script must be drafted before sign-off" ||
    message === "Script has no student assigned" ||
    message.startsWith("Batch has no assessment")
  ) {
    return 400;
  }
  return 500;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ batchId: string; scriptId: string }> }
) {
  try {
    const { batchId, scriptId } = await context.params;
    const supabase = await createClient();
    const batch = await requireTeacherEvaluationBatch(supabase, batchId);
    await requireTeacherClass(supabase, batch.class_id);

    const result = await signOffScript(supabase, { batchId, scriptId });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sign-off failed";
    return NextResponse.json(
      { error: message },
      { status: authStatus(message) }
    );
  }
}
