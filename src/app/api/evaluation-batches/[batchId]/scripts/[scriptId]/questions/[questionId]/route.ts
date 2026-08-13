import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { requireTeacherEvaluationBatch } from "@/lib/evaluation/batches";
import { updateQuestionEvaluation } from "@/lib/evaluation/update-question";
import { createClient } from "@/lib/supabase/server";

function authStatus(message: string) {
  if (message === "Not authenticated") return 401;
  if (
    message === "Class not found" ||
    message === "Evaluation batch not found"
  ) {
    return 403;
  }
  if (
    message === "Script not found" ||
    message === "Question evaluation not found"
  ) {
    return 404;
  }
  if (
    message === "Script is already signed off" ||
    message === "Script must be drafted before editing marks" ||
    message.startsWith("Invalid ")
  ) {
    return 400;
  }
  return 500;
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ batchId: string; scriptId: string; questionId: string }>;
  }
) {
  try {
    const { batchId, scriptId, questionId } = await context.params;
    const supabase = await createClient();
    const batch = await requireTeacherEvaluationBatch(supabase, batchId);
    await requireTeacherClass(supabase, batch.class_id);

    const body = (await request.json()) as {
      awarded?: number | null;
      max?: number | null;
      feedback?: string | null;
    };

    const result = await updateQuestionEvaluation(supabase, {
      batchId,
      scriptId,
      questionId,
      awarded: body.awarded,
      max: body.max,
      feedback: body.feedback,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update question";
    return NextResponse.json(
      { error: message },
      { status: authStatus(message) }
    );
  }
}
