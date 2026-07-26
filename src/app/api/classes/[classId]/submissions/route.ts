import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { listClassAssessments } from "@/lib/evaluation/batches";
import { createClient } from "@/lib/supabase/server";
import type { StudentSubmission } from "@/types/database";

function authStatus(message: string) {
  if (message === "Not authenticated") return 401;
  if (message === "Class not found") return 403;
  return 500;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await context.params;
    const supabase = await createClient();
    await requireTeacherClass(supabase, classId);

    const assessments = await listClassAssessments(supabase, classId);
    const assessmentIds = assessments.map((a) => a.id);

    if (assessmentIds.length === 0) {
      return NextResponse.json({ submissions: [] as StudentSubmission[] });
    }

    const { data, error } = await supabase
      .from("student_submissions")
      .select("*")
      .in("assessment_id", assessmentIds);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      submissions: (data ?? []) as StudentSubmission[],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load submissions";
    return NextResponse.json(
      { error: message },
      { status: authStatus(message) }
    );
  }
}
