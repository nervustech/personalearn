import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { getStudentEvalProfile } from "@/lib/evaluation/student-profile";
import { createClient } from "@/lib/supabase/server";

function authStatus(message: string) {
  if (message === "Not authenticated") return 401;
  if (message === "Class not found" || message === "Student not found")
    return 403;
  return 500;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ classId: string; studentId: string }> }
) {
  try {
    const { classId, studentId } = await context.params;
    const supabase = await createClient();
    await requireTeacherClass(supabase, classId);

    const profile = await getStudentEvalProfile(supabase, classId, studentId);
    return NextResponse.json(profile);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load student profile";
    const status =
      message === "Student not found" ? 404 : authStatus(message);
    return NextResponse.json({ error: message }, { status });
  }
}
