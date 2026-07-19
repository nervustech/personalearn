import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { requireTeacherEvaluationBatch } from "@/lib/evaluation/batches";
import { createClient } from "@/lib/supabase/server";

const MAX_FILES = 80;
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png"]);

function authStatus(message: string) {
  if (message === "Not authenticated") return 401;
  if (
    message === "Class not found" ||
    message === "Evaluation batch not found"
  ) {
    return 403;
  }
  return 500;
}

function extensionFor(fileName: string, contentType?: string): "jpg" | "png" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png") || contentType === "image/png") return "png";
  return "jpg";
}

/**
 * F1: Issue short-lived signed upload URLs so scan bytes go direct to Supabase
 * Storage and never through the Next.js / Vercel request body.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await context.params;
    const supabase = await createClient();
    const batch = await requireTeacherEvaluationBatch(supabase, batchId);
    await requireTeacherClass(supabase, batch.class_id);

    if (batch.status !== "draft" && batch.status !== "processing") {
      return NextResponse.json(
        { error: "Pages can only be uploaded while the batch is draft or processing" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      files?: { fileName: string; contentType?: string }[];
    };
    const files = body.files ?? [];
    if (!files.length) {
      return NextResponse.json(
        { error: "At least one file descriptor is required" },
        { status: 400 }
      );
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `At most ${MAX_FILES} files per request` },
        { status: 400 }
      );
    }

    const uploads: {
      fileName: string;
      storagePath: string;
      token: string;
      contentType: string;
    }[] = [];

    for (const file of files) {
      const fileName = String(file.fileName ?? "").trim();
      if (!fileName) {
        return NextResponse.json(
          { error: "Each file needs a fileName" },
          { status: 400 }
        );
      }
      const ext = extensionFor(fileName, file.contentType);
      const bareExt = fileName.split(".").pop()?.toLowerCase() ?? "";
      if (bareExt && !ALLOWED_EXT.has(bareExt)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${fileName}` },
          { status: 400 }
        );
      }

      const pageId = crypto.randomUUID();
      const storagePath = `${batch.class_id}/${batchId}/${pageId}.${ext}`;
      const contentType =
        file.contentType || (ext === "png" ? "image/png" : "image/jpeg");

      const { data, error } = await supabase.storage
        .from("student_submissions")
        .createSignedUploadUrl(storagePath);

      if (error || !data?.token) {
        return NextResponse.json(
          { error: error?.message ?? "Could not create signed upload URL" },
          { status: 500 }
        );
      }

      uploads.push({
        fileName,
        storagePath,
        token: data.token,
        contentType,
      });
    }

    return NextResponse.json({ batchId, uploads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}
