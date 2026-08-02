import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { requireTeacherEvaluationBatch } from "@/lib/evaluation/batches";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/jpg"]);

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

function isAllowedContentType(contentType?: string, fileName?: string) {
  if (contentType && ALLOWED_TYPES.has(contentType)) return true;
  const lower = (fileName ?? "").toLowerCase();
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png")
  );
}

function extensionFor(fileName: string, contentType?: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png") || contentType === "image/png") return "png";
  return "jpg";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await context.params;
    const supabase = await createClient();
    const batch = await requireTeacherEvaluationBatch(supabase, batchId);
    await requireTeacherClass(supabase, batch.class_id);

    if (batch.status === "signed_off") {
      return NextResponse.json(
        { error: "Cannot append pages to a signed-off batch" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      files?: { fileName: string; contentType?: string }[];
    };

    if (!body.files?.length) {
      return NextResponse.json(
        { error: "At least one file descriptor is required" },
        { status: 400 }
      );
    }

    const uploads: {
      fileName: string;
      storagePath: string;
      token: string;
      contentType: string;
    }[] = [];

    for (const file of body.files) {
      if (!isAllowedContentType(file.contentType, file.fileName)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.fileName}` },
          { status: 400 }
        );
      }

      const ext = extensionFor(file.fileName, file.contentType);
      const pageId = crypto.randomUUID();
      const storagePath = `${batch.class_id}/${batchId}/${pageId}.${ext}`;
      const contentType = file.contentType || `image/${ext === "png" ? "png" : "jpeg"}`;

      const { data, error } = await supabase.storage
        .from("student_submissions")
        .createSignedUploadUrl(storagePath);

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message ?? "Could not create signed upload URL" },
          { status: 500 }
        );
      }

      uploads.push({
        fileName: file.fileName,
        storagePath,
        token: data.token,
        contentType,
      });
    }

    return NextResponse.json({ uploads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}
