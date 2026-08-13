import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { requireTeacherEvaluationBatch } from "@/lib/evaluation/batches";
import {
  assignScriptStudent,
  removeScriptFromBatch,
} from "@/lib/evaluation/identity";
import {
  runLiveEvaluation,
  submitEvaluateBatch,
} from "@/lib/evaluation/poll-batches";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

function authStatus(message: string) {
  if (message === "Not authenticated") return 401;
  if (message.includes("already been evaluated")) return 409;
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

    if (script.status === "evaluating") {
      const service = createServiceClient();
      const fullBatch = await requireTeacherEvaluationBatch(service, batchId);
      if (fullBatch.mode === "live") {
        await runLiveEvaluation(service, fullBatch, script.id);
      } else {
        await submitEvaluateBatch(service, fullBatch);
      }
    }

    return NextResponse.json({ script });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not assign student";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ batchId: string; scriptId: string }> }
) {
  try {
    const { batchId, scriptId } = await context.params;
    const supabase = await createClient();
    const batch = await requireTeacherEvaluationBatch(supabase, batchId);
    await requireTeacherClass(supabase, batch.class_id);

    await removeScriptFromBatch(supabase, {
      batchId,
      classId: batch.class_id,
      scriptId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not remove script";
    const status =
      message === "Script not found"
        ? 404
        : message.startsWith("Only pending") ||
            message.startsWith("Cannot remove")
          ? 400
          : authStatus(message);
    return NextResponse.json({ error: message }, { status });
  }
}
