import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { createClient } from "@/lib/supabase/server";
import type { CompetencyProgress } from "@/types/database";

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

    const { data, error } = await supabase
      .from("competency_progress")
      .select("*")
      .eq("class_id", classId)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({
      competency: (data ?? []) as CompetencyProgress[],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load competency";
    return NextResponse.json(
      { error: message },
      { status: authStatus(message) }
    );
  }
}
