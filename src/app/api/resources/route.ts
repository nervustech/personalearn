import { NextResponse } from "next/server";
import { listClassResources } from "@/lib/resources/class-resources";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { createClient } from "@/lib/supabase/server";

function authStatus(message: string) {
  if (message === "Not authenticated") return 401;
  if (message === "Class not found") return 403;
  return 500;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");

    if (!classId) {
      return NextResponse.json({ error: "classId is required" }, { status: 400 });
    }

    await requireTeacherClass(supabase, classId);
    const resources = await listClassResources(supabase, classId);

    return NextResponse.json({ resources });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list resources";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}
