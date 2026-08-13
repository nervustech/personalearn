import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { listClassAssessments } from "@/lib/evaluation/batches";
import { createClient } from "@/lib/supabase/server";

function authStatus(message: string) {
  if (message === "Not authenticated") return 401;
  if (message === "Class not found") return 403;
  return 500;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const classId = new URL(request.url).searchParams.get("classId");

    if (!classId) {
      return NextResponse.json({ error: "classId is required" }, { status: 400 });
    }

    await requireTeacherClass(supabase, classId);
    const assessments = await listClassAssessments(supabase, classId);
    return NextResponse.json({ assessments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}
