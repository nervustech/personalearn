import { NextResponse } from "next/server";
import { requireTeacherResource } from "@/lib/resources/class-resources";
import {
  isBinaryOriginalResource,
  resourcePreviewText,
  resourceStoragePath,
  shouldExportResourceAsPdf,
} from "@/lib/resources/format";
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

/**
 * Download: binary uploads → original via signed URL;
 * AI/text (text/plain or ai_generated) → PDF even if a .txt storagePath exists.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { resourceId } = await context.params;
    const resource = await requireTeacherResource(supabase, resourceId);
    const rawContent = resource.raw_content;
    const storagePath = resourceStoragePath(rawContent);

    if (
      storagePath &&
      isBinaryOriginalResource(rawContent) &&
      !shouldExportResourceAsPdf(resource)
    ) {
      const { data, error } = await supabase.storage
        .from("resources")
        .createSignedUrl(storagePath, 3600);

      if (error || !data?.signedUrl) {
        return NextResponse.json(
          { error: "Could not create download link" },
          { status: 500 }
        );
      }

      return NextResponse.redirect(data.signedUrl);
    }

    if (shouldExportResourceAsPdf(resource)) {
      const text = resourcePreviewText(rawContent);
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
    }

    // Fallback: non-text original with storage (e.g. odd mime).
    if (storagePath) {
      const { data, error } = await supabase.storage
        .from("resources")
        .createSignedUrl(storagePath, 3600);

      if (error || !data?.signedUrl) {
        return NextResponse.json(
          { error: "Could not create download link" },
          { status: 500 }
        );
      }

      return NextResponse.redirect(data.signedUrl);
    }

    return NextResponse.json(
      { error: "No downloadable content for this resource" },
      { status: 404 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Download failed";
    return NextResponse.json({ error: message }, { status: authStatus(message) });
  }
}
