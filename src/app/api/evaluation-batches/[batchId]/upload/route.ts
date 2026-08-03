import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { requireTeacherEvaluationBatch } from "@/lib/evaluation/batches";
import { refreshBatchStatusRollup } from "@/lib/evaluation/batch-status";
import { sha256Hex } from "@/lib/evaluation/content-hash";
import {
  buildUploadDedupeState,
  type UploadDuplicateWarning,
} from "@/lib/evaluation/upload-page-dedupe";
import { createClient } from "@/lib/supabase/server";

/** Safety net after client compress; phone originals may still arrive briefly. */
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/jpg"]);

export type { UploadDuplicateWarning };

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

    if (batch.status === "signed_off") {
      return NextResponse.json(
        { error: "Cannot append pages to a signed-off batch" },
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

    const { data: existingPages, error: existingError } = await supabase
      .from("evaluation_pages")
      .select("content_hash, storage_path, file_name, upload_index")
      .eq("batch_id", batchId);

    if (existingError) throw new Error(existingError.message);

    const dedupeState = buildUploadDedupeState(
      (existingPages ?? []).map((p) => ({
        page_order: [
          {
            storagePath: p.storage_path,
            fileName: p.file_name,
            uploadIndex: p.upload_index,
            contentHash: p.content_hash,
          },
        ],
      }))
    );

    const pageRows: {
      storage_path: string;
      file_name: string;
      upload_index: number;
      content_hash: string;
    }[] = [];
    const pagesMeta: {
      storagePath: string;
      fileName: string;
      contentHash: string;
    }[] = [];
    const warnings: UploadDuplicateWarning[] = [];

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

      const bytes = new Uint8Array(await file.arrayBuffer());
      const contentHash = await sha256Hex(bytes);
      const existingPath = dedupeState.hashToPath.get(contentHash);

      if (existingPath) {
        const duplicateOfFileName =
          dedupeState.hashToFirstFileName.get(contentHash) ?? "earlier page";
        const alreadyInSession = dedupeState.batchHashes.has(contentHash);
        warnings.push({
          fileName: file.name,
          duplicateOfFileName,
          alreadyInSession,
          message: alreadyInSession
            ? `${file.name} is already in this session — not added again`
            : `${file.name} matches ${duplicateOfFileName} — stored once, not added again`,
        });
        continue;
      }

      const extension = file.name.toLowerCase().endsWith(".png") ? "png" : "jpg";
      const pageId = crypto.randomUUID();
      const storagePath = `${batch.class_id}/${batchId}/${pageId}.${extension}`;

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

      dedupeState.maxUploadIndex += 1;
      dedupeState.hashToPath.set(contentHash, storagePath);
      dedupeState.hashToFirstFileName.set(contentHash, file.name);
      pageRows.push({
        storage_path: storagePath,
        file_name: file.name,
        upload_index: dedupeState.maxUploadIndex,
        content_hash: contentHash,
      });
      pagesMeta.push({ storagePath, fileName: file.name, contentHash });
    }

    if (pageRows.length === 0) {
      return NextResponse.json({
        batchId,
        pageCount: 0,
        pages: [],
        warnings,
        queued: false,
        skippedAll: true,
        message: "All selected files are already in this session.",
      });
    }

    const { error: pagesInsertError } = await supabase
      .from("evaluation_pages")
      .insert(
        pageRows.map((p) => ({
          batch_id: batchId,
          script_id: null,
          storage_path: p.storage_path,
          file_name: p.file_name,
          upload_index: p.upload_index,
          content_hash: p.content_hash,
        }))
      );

    if (pagesInsertError) {
      return NextResponse.json(
        { error: pagesInsertError.message },
        { status: 500 }
      );
    }

    await refreshBatchStatusRollup(supabase, batchId);

    return NextResponse.json({
      batchId,
      pageCount: pageRows.length,
      pages: pagesMeta,
      warnings,
      queued: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}
