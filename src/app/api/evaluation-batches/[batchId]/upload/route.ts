import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { requireTeacherEvaluationBatch } from "@/lib/evaluation/batches";
import { createClient } from "@/lib/supabase/server";

/** Safety net after client compress; phone originals may still arrive briefly. */
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
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

function isAllowedImage(file: File) {
  if (ALLOWED_TYPES.has(file.type)) return true;
  const lower = file.name.toLowerCase();
  return lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png");
}

/** FormData File entries can fail `instanceof File` across jsdom/undici boundaries. */
function isFileLike(entry: FormDataEntryValue): entry is File {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "name" in entry &&
    "size" in entry &&
    "arrayBuffer" in entry &&
    typeof (entry as File).arrayBuffer === "function"
  );
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

    if (batch.status !== "draft") {
      return NextResponse.json(
        { error: "Pages can only be uploaded while the batch is in draft" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files").filter(isFileLike);

    if (!files.length) {
      return NextResponse.json(
        { error: "At least one image file is required" },
        { status: 400 }
      );
    }

    const uploaded: { storagePath: string; fileName: string }[] = [];

    for (const file of files) {
      if (!isAllowedImage(file)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.name}` },
          { status: 400 }
        );
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: `File too large (max 15 MB): ${file.name}` },
          { status: 400 }
        );
      }

      const extension = file.name.toLowerCase().endsWith(".png") ? "png" : "jpg";
      const pageId = crypto.randomUUID();
      const storagePath = `${batch.class_id}/${batchId}/${pageId}.${extension}`;
      const bytes = new Uint8Array(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from("student_submissions")
        .upload(storagePath, bytes, {
          contentType: file.type || `image/${extension}`,
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: uploadError.message || "Upload failed" },
          { status: 500 }
        );
      }

      uploaded.push({ storagePath, fileName: file.name });
    }

    // Queue placeholder: one pending script row holding all page paths (grouping in PSL-45).
    const pageOrder = uploaded.map((page, index) => ({
      storagePath: page.storagePath,
      fileName: page.fileName,
      uploadIndex: index,
    }));

    const { data: script, error: scriptError } = await supabase
      .from("evaluated_scripts")
      .insert({
        batch_id: batchId,
        page_order: pageOrder,
        status: "pending",
      })
      .select("id")
      .single();

    if (scriptError || !script) {
      return NextResponse.json(
        { error: scriptError?.message ?? "Could not queue pages" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      batchId,
      scriptId: script.id,
      pageCount: uploaded.length,
      pages: uploaded,
      queued: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}
