import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { requireTeacherEvaluationBatch } from "@/lib/evaluation/batches";
import { assignScriptStudent } from "@/lib/evaluation/identity";
import { createClient } from "@/lib/supabase/server";

function authStatus(message: string) {
  if (message === "Not authenticated") return 401;
  if (
    message === "Class not found" ||
    message === "Evaluation batch not found" ||
    message === "Student not found in this class" ||
    message === "Script not found"
  ) {
    return message === "Student not found in this class" ||
      message === "Script not found"
      ? 404
      : 403;
  }
  return 500;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ batchId: string; scriptId: string }> }
) {
  try {
    const { batchId, scriptId } = await context.params;
    const body = (await request.json()) as { studentId?: string };
    if (!body.studentId?.trim()) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const batch = await requireTeacherEvaluationBatch(supabase, batchId);
    await requireTeacherClass(supabase, batch.class_id);

    const script = await assignScriptStudent(supabase, {
      batchId,
      classId: batch.class_id,
      scriptId,
      studentId: body.studentId.trim(),
    });

    return NextResponse.json({ script });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not assign student";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}
