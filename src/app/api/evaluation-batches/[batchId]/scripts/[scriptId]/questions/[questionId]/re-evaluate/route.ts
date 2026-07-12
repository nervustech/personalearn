import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { requireTeacherEvaluationBatch } from "@/lib/evaluation/batches";
import { reevaluateScriptQuestion } from "@/lib/evaluation/reevaluate-question";
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
    message === "Script must be drafted before re-evaluation"
  ) {
    return 400;
  }
  return 500;
}

export async function POST(
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

    let instruction: string | null = null;
    try {
      const body = (await request.json()) as { instruction?: string | null };
      instruction = body.instruction ?? null;
    } catch {
      instruction = null;
    }

    const result = await reevaluateScriptQuestion(supabase, {
      batchId,
      scriptId,
      questionId,
      instruction,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Re-evaluation failed";
    return NextResponse.json(
      { error: message },
      { status: authStatus(message) }
    );
  }
}
