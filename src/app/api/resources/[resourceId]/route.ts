import { NextResponse } from "next/server";
import { deleteResource, updateTextResource } from "@/lib/ai/ingest-resource";
import { requireTeacherResource } from "@/lib/resources/class-resources";
import {
  isBinaryOriginalResource,
  resourcePreviewText,
  resourceStoragePath,
} from "@/lib/resources/format";
import { createClient } from "@/lib/supabase/server";

function authStatus(message: string) {
  if (message === "Not authenticated") return 401;
  if (message === "Class not found" || message === "Resource not found") return 403;
  if (message === "PDF and image uploads cannot be edited as text") return 400;
  if (
    message === "Title is required" ||
    message === "Content is empty or contains no readable text."
  ) {
    return 400;
  }
  return 500;
}

type RouteContext = {
  params: Promise<{ resourceId: string }>;
};

/**
 * Full resource JSON for the detail page.
 * Binary originals use same-origin `/download?inline=1` when the storage object
 * has bytes (empty uploads are skipped so the UI can fall back to extracted text).
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { resourceId } = await context.params;
    const resource = await requireTeacherResource(supabase, resourceId);

    let viewUrl: string | null = null;
    const storagePath = resourceStoragePath(resource.raw_content);
    if (storagePath && isBinaryOriginalResource(resource.raw_content)) {
      const { data: signed, error } = await supabase.storage
        .from("resources")
        .createSignedUrl(storagePath, 120);
      if (!error && signed?.signedUrl) {
        const head = await fetch(signed.signedUrl, { method: "HEAD" });
        const length = Number(head.headers.get("content-length") ?? 0);
        if (head.ok && length > 0) {
          viewUrl = `/api/resources/${resourceId}/download?inline=1`;
        }
      }
    }

    return NextResponse.json({
      resource,
      viewUrl,
      previewText: resourcePreviewText(resource.raw_content),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load resource";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { resourceId } = await context.params;
    await requireTeacherResource(supabase, resourceId);

    const body = (await request.json()) as {
      title?: unknown;
      text?: unknown;
    };

    if (typeof body.title !== "string" || typeof body.text !== "string") {
      return NextResponse.json(
        { error: "title and text are required strings" },
        { status: 400 }
      );
    }

    const result = await updateTextResource(supabase, resourceId, {
      title: body.title,
      text: body.text,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { resourceId } = await context.params;

    await requireTeacherResource(supabase, resourceId);
    await deleteResource(supabase, resourceId);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}
