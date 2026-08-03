import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { requireTeacherEvaluationBatch } from "@/lib/evaluation/batches";
import { refreshBatchStatusRollup } from "@/lib/evaluation/batch-status";
import {
  buildUploadDedupeState,
  dedupeIncomingUploadPages,
} from "@/lib/evaluation/upload-page-dedupe";
import { isValidEvalPageStoragePath } from "@/lib/evaluation/compress-eval-image.shared";
import { createClient } from "@/lib/supabase/server";
import type { UploadDuplicateWarning } from "../upload/route";

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
      pages?: { storagePath: string; fileName: string; contentHash: string }[];
    };

    if (!body.pages?.length) {
      return NextResponse.json(
        { error: "At least one confirmed page is required" },
        { status: 400 }
      );
    }

    for (const page of body.pages) {
      if (
        !isValidEvalPageStoragePath(
          page.storagePath,
          batch.class_id,
          batchId
        )
      ) {
        return NextResponse.json(
          { error: `Invalid storage path: ${page.fileName}` },
          { status: 400 }
        );
      }
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

    const { pageOrder, warnings } = dedupeIncomingUploadPages(
      dedupeState,
      body.pages
    );

    if (pageOrder.length === 0) {
      return NextResponse.json({
        batchId,
        pageCount: 0,
        warnings,
        queued: false,
        skippedAll: true,
        message: "All selected files are already in this session.",
      });
    }

    const { error: pagesInsertError } = await supabase
      .from("evaluation_pages")
      .insert(
        pageOrder.map((p) => ({
          batch_id: batchId,
          script_id: null,
          storage_path: p.storagePath,
          file_name: p.fileName,
          upload_index: p.uploadIndex,
          content_hash: p.contentHash,
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
      pageCount: pageOrder.length,
      warnings,
      queued: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}

export type { UploadDuplicateWarning };
