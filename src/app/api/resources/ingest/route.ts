import { NextResponse } from "next/server";
import {
  detectResourceFormat,
  ExtractTextError,
  extractTextFromUpload,
  maxBytesForFormat,
} from "@/lib/ai/extract-text";
import { ingestResource } from "@/lib/ai/ingest-resource";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { createClient } from "@/lib/supabase/server";

function authStatus(message: string) {
  if (message === "Not authenticated") return 401;
  if (message === "Class not found") return 403;
  return 500;
}

function clientErrorStatus(error: ExtractTextError) {
  if (error.code === "config") return 500;
  return 400;
}

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

    const format = detectResourceFormat(file.name, file.type);
    if (!format) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload a .txt, .pdf, .jpg, or .png file." },
        { status: 400 }
      );
    }

    const maxBytes = maxBytesForFormat(format);
    if (file.size > maxBytes) {
      const limitMb = maxBytes / (1024 * 1024);
      return NextResponse.json(
        { error: `File must be ${limitMb} MB or smaller.` },
        { status: 400 }
      );
    }

    await requireTeacherClass(supabase, classId);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = await extractTextFromUpload({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes,
    });

    const result = await ingestResource(supabase, {
      classId,
      fileName: file.name,
      text,
      mimeType: file.type || "application/octet-stream",
      fileBytes: bytes,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ExtractTextError) {
      return NextResponse.json(
        { error: error.message },
        { status: clientErrorStatus(error) }
      );
    }

    const message =
      error instanceof Error ? error.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}
