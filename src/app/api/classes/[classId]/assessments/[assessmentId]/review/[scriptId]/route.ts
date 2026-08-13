import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { listBatchScriptsForReview } from "@/lib/evaluation/identity";
import { createClient } from "@/lib/supabase/server";

function authStatus(message: string) {
  if (message === "Not authenticated") return 401;
  if (message === "Class not found" || message === "Script not found") {
    return message === "Script not found" ? 404 : 403;
  }
  return 500;
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ classId: string; assessmentId: string; scriptId: string }>;
  }
) {
  try {
    const { classId, assessmentId, scriptId } = await context.params;
    const supabase = await createClient();
    await requireTeacherClass(supabase, classId);

    const { data: scriptRow, error: scriptError } = await supabase
      .from("evaluated_scripts")
      .select("id, batch_id, status, evaluation_batches!inner(id, class_id, assessment_id)")
      .eq("id", scriptId)
      .maybeSingle();

    if (scriptError) throw new Error(scriptError.message);
    if (!scriptRow) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }

    const batch = scriptRow.evaluation_batches as
      | { id: string; class_id: string; assessment_id: string | null }
      | { id: string; class_id: string; assessment_id: string | null }[];

    const batchMeta = Array.isArray(batch) ? batch[0] : batch;
    if (
      !batchMeta ||
      batchMeta.class_id !== classId ||
      batchMeta.assessment_id !== assessmentId
    ) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }

    const scripts = await listBatchScriptsForReview(
      supabase,
      batchMeta.id,
      classId
    );
    const script = scripts.find((s) => s.id === scriptId);
    if (!script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }

    const reviewable = scripts
      .filter((s) => s.status === "drafted" || s.status === "signed_off")
      .map((s) => ({
        id: s.id,
        student_name: s.student_name,
        read_admission_number: s.read_admission_number,
        status: s.status,
      }));

    const { data: assessment, error: assessmentError } = await supabase
      .from("assessments")
      .select("id, title, linked_strand, linked_sub_strand")
      .eq("id", assessmentId)
      .maybeSingle();

    if (assessmentError) throw new Error(assessmentError.message);

    return NextResponse.json({
      script,
      batchId: batchMeta.id,
      assessment,
      siblings: reviewable,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load review";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}
