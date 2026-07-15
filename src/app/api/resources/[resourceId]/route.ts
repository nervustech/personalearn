import { NextResponse } from "next/server";
import { deleteResource } from "@/lib/ai/ingest-resource";
import { requireTeacherResource } from "@/lib/resources/class-resources";
import { pdfFileName, renderResourcePdf } from "@/lib/resources/render-pdf";
import { createClient } from "@/lib/supabase/server";

function authStatus(message: string) {
  if (message === "Not authenticated") return 401;
  if (message === "Class not found" || message === "Resource not found") return 403;
  return 500;
}

type RouteContext = {
  params: Promise<{ resourceId: string }>;
};

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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { resourceId } = await context.params;
    const resource = await requireTeacherResource(supabase, resourceId);
    const rawContent = resource.raw_content as {
      storagePath?: string;
      text?: string;
    };

    // Every resource downloads as a clean, consistent PDF built from its
    // extracted text — including uploaded originals.
    const text = typeof rawContent.text === "string" ? rawContent.text : "";
    if (text.trim()) {
      const pdf = await renderResourcePdf(resource.title, text);
      return new NextResponse(Buffer.from(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${pdfFileName(
            resource.title
          )}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    // No extracted text (e.g. an image with no OCR) — fall back to original.
    if (!rawContent.storagePath) {
      return NextResponse.json(
        { error: "No downloadable content for this resource" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase.storage
      .from("resources")
      .createSignedUrl(rawContent.storagePath, 3600);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: "Could not create download link" },
        { status: 500 }
      );
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Download failed";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}
