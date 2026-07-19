import { NextResponse } from "next/server";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { requireTeacherEvaluationBatch } from "@/lib/evaluation/batches";
import { createClient } from "@/lib/supabase/server";
import type { EvaluatedScriptPage } from "@/types/database";

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

type ConfirmPage = {
  storagePath: string;
  fileName: string;
  contentHash: string;
};

/**
 * F1: After the browser PUTs bytes to signed URLs, register page_order + script row.
 * Dedupes by contentHash within the confirm payload.
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
        { error: "Pages can only be confirmed while the batch is draft or processing" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as { pages?: ConfirmPage[] };
    const pages = body.pages ?? [];
    if (!pages.length) {
      return NextResponse.json(
        { error: "At least one uploaded page is required" },
        { status: 400 }
      );
    }

    const prefix = `${batch.class_id}/${batchId}/`;
    const hashToPath = new Map<string, string>();
    const hashToFirstFileName = new Map<string, string>();
    const pageOrder: EvaluatedScriptPage[] = [];
    const pagesMeta: {
      storagePath: string;
      fileName: string;
      contentHash: string;
      duplicate?: boolean;
    }[] = [];
    const warnings: {
      fileName: string;
      duplicateOfFileName: string;
      message: string;
    }[] = [];

    for (const page of pages) {
      const storagePath = String(page.storagePath ?? "");
      const fileName = String(page.fileName ?? "");
      const contentHash = String(page.contentHash ?? "").toLowerCase();

      if (!storagePath.startsWith(prefix)) {
        return NextResponse.json(
          { error: `Invalid storage path: ${storagePath}` },
          { status: 400 }
        );
      }
      if (!fileName || !/^[a-f0-9]{64}$/.test(contentHash)) {
        return NextResponse.json(
          { error: "Each page needs fileName and a hex SHA-256 contentHash" },
          { status: 400 }
        );
      }

      const uploadIndex = pageOrder.length;
      const existingPath = hashToPath.get(contentHash);
      if (existingPath) {
        const duplicateOfFileName =
          hashToFirstFileName.get(contentHash) ?? "earlier page";
        pageOrder.push({
          storagePath: existingPath,
          fileName,
          uploadIndex,
          contentHash,
          duplicate: true,
        });
        pagesMeta.push({
          storagePath: existingPath,
          fileName,
          contentHash,
          duplicate: true,
        });
        warnings.push({
          fileName,
          duplicateOfFileName,
          message: `Duplicate of ${duplicateOfFileName} — stored once, flagged for review`,
        });
        continue;
      }

      hashToPath.set(contentHash, storagePath);
      hashToFirstFileName.set(contentHash, fileName);
      pageOrder.push({
        storagePath,
        fileName,
        uploadIndex,
        contentHash,
      });
      pagesMeta.push({ storagePath, fileName, contentHash });
    }

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
      pageCount: pageOrder.length,
      pages: pagesMeta,
      warnings,
      queued: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}
