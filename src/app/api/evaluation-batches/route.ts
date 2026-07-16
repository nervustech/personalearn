import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import {
  createEvaluationBatch,
  listClassEvaluationBatches,
} from "@/lib/evaluation/batches";
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
    const batches = await listClassEvaluationBatches(supabase, classId);
    return NextResponse.json({ batches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = (await request.json()) as {
      classId?: string;
      assessmentId?: string | null;
      resourceId?: string | null;
      markingSchemeResourceId?: string | null;
      proceedWithoutScheme?: boolean;
      studentId?: string | null;
    };

    if (!body.classId) {
      return NextResponse.json({ error: "classId is required" }, { status: 400 });
    }

    await requireTeacherClass(supabase, body.classId);

    const batch = await createEvaluationBatch(supabase, {
      classId: body.classId,
      assessmentId: body.assessmentId,
      resourceId: body.resourceId,
      markingSchemeResourceId: body.markingSchemeResourceId,
      proceedWithoutScheme: body.proceedWithoutScheme === true,
      studentId: body.studentId,
    });

    return NextResponse.json({ batch }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status =
      message === "Not authenticated"
        ? 401
        : message === "Class not found"
          ? 403
          : message.includes("required") ||
              message.includes("not found") ||
              message.includes("not a marking") ||
              message.includes("Only assignment") ||
              message.includes("proceedWithoutScheme") ||
              message.includes("Student not found")
            ? 400
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
