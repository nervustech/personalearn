import { NextResponse } from "next/server";
import { z } from "zod";
import { queryClassResources } from "@/lib/ai/rag";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  classId: z.string().uuid(),
  question: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { classId, question } = parsed.data;
    await requireTeacherClass(supabase, classId);

    const result = await queryClassResources(supabase, classId, question);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Query failed";
    const status =
      message === "Not authenticated"
        ? 401
        : message === "Class not found"
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
