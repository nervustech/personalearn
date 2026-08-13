import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireTeacherResource } from "@/lib/resources/class-resources";
import {
  isBinaryOriginalResource,
  contentDispositionFileName,
  resourceFileName,
  resourceMimeType,
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

function wantsInline(request: Request) {
  const { searchParams } = new URL(request.url);
  return (
    searchParams.get("inline") === "1" ||
    searchParams.get("disposition") === "inline"
  );
}

/**
 * Proxy storage bytes same-origin so iframes can embed PDFs.
 * Direct signed URLs are blocked by storage X-Frame-Options; `storage.download()`
 * has returned empty bodies in the Node route handler, so we create a signed URL
 * and re-fetch it through this API (buffered so we can reject empty payloads).
 */
async function streamStoredFile(
  supabase: SupabaseClient,
  storagePath: string,
  rawContent: Record<string, unknown>,
  disposition: "inline" | "attachment"
) {
  const { data: signed, error } = await supabase.storage
    .from("resources")
    .createSignedUrl(storagePath, 3600);

  if (error || !signed?.signedUrl) {
    return NextResponse.json(
      { error: "Could not load original file" },
      { status: 500 }
    );
  }

  const upstream = await fetch(signed.signedUrl);
  const bytes = Buffer.from(await upstream.arrayBuffer());
  if (!upstream.ok || bytes.byteLength === 0) {
    return NextResponse.json(
      { error: "Could not load original file" },
      { status: 500 }
    );
  }

  const mime =
    resourceMimeType(rawContent) ||
    upstream.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream";
  const fileName = contentDispositionFileName(resourceFileName(rawContent));

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${disposition}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * Download / inline view:
 * - binary uploads → original bytes (stream when ?inline=1 for embed; else signed redirect)
 * - AI/text → synthesized PDF
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { resourceId } = await context.params;
    const resource = await requireTeacherResource(supabase, resourceId);
    const rawContent = resource.raw_content;
    const storagePath = resourceStoragePath(rawContent);
    const inline = wantsInline(request);
    const disposition = inline ? "inline" : "attachment";

    if (
      storagePath &&
      isBinaryOriginalResource(rawContent) &&
      !shouldExportResourceAsPdf(resource)
    ) {
      if (inline) {
        return streamStoredFile(supabase, storagePath, rawContent, "inline");
      }

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
            "Content-Disposition": `${disposition}; filename="${pdfFileName(
              resource.title
            )}"`,
            "Cache-Control": "private, no-store",
          },
        });
      }
    }

    // Fallback: non-text original with storage (e.g. odd mime).
    if (storagePath) {
      if (inline) {
        return streamStoredFile(supabase, storagePath, rawContent, "inline");
      }

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
