import { NextResponse } from "next/server";
import { ingestTxtResource, MAX_TXT_BYTES } from "@/lib/ai/ingest-resource";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const formData = await request.formData();
    const classId = formData.get("classId");
    const file = formData.get("file");

    if (typeof classId !== "string" || !classId) {
      return NextResponse.json({ error: "classId is required" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".txt")) {
      return NextResponse.json(
        { error: "Only .txt files are supported in Sprint 2" },
        { status: 400 }
      );
    }

    if (file.size > MAX_TXT_BYTES) {
      return NextResponse.json(
        { error: "File must be 2 MB or smaller" },
        { status: 400 }
      );
    }

    await requireTeacherClass(supabase, classId);

    const text = await file.text();
    const result = await ingestTxtResource(supabase, {
      classId,
      fileName: file.name,
      text,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ingest failed";
    const status = message === "Not authenticated" ? 401 : message === "Class not found" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
