"use client";

import { Download, Printer } from "lucide-react";
import type { Resource } from "@/types/database";
import { MarkdownContent } from "@/components/markdown/markdown-content";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isBinaryOriginalResource,
  formatExtractedPlainText,
  resourceMimeType,
  shouldExportResourceAsPdf,
} from "@/lib/resources/format";

type ResourceViewerProps = {
  classId: string;
  resource: Resource;
  viewUrl: string | null;
  previewText: string;
};

/**
 * Print the on-screen rendered content (WYSIWYG tables/math).
 * Use a real browser (Brave/Chrome) → Save as PDF. Embedded browsers may fail.
 */
function printRenderedResource(title: string) {
  const previous = document.title;
  document.title = title.trim() || previous;
  const restore = () => {
    document.title = previous;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
  window.setTimeout(restore, 1000);
}

export function ResourceViewer({
  resource,
  viewUrl,
  previewText,
}: ResourceViewerProps) {
  const binary = isBinaryOriginalResource(resource.raw_content);
  const mime = resourceMimeType(resource.raw_content);
  const canPrint = shouldExportResourceAsPdf(resource) && Boolean(previewText.trim());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        {canPrint ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => printRenderedResource(resource.title)}
            title="Print the page as shown — in Brave/Chrome choose Save as PDF"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save as PDF
          </Button>
        ) : null}
        {binary ? (
          <a
            href={`/api/resources/${resource.id}/download`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-muted"
            title="Download the original file"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        ) : null}
      </div>

      {binary && viewUrl ? (
        mime.startsWith("image/") ? (
          /* eslint-disable-next-line @next/next/no-img-element -- same-origin or signed URL */
          <img
            src={viewUrl}
            alt={resource.title}
            className="mx-auto max-h-[min(80vh,48rem)] w-auto max-w-full rounded-lg object-contain"
          />
        ) : (
          <iframe
            title={resource.title}
            src={viewUrl}
            className="h-[min(80vh,48rem)] w-full rounded-lg border border-border bg-card"
          />
        )
      ) : binary && previewText ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground print:hidden">
            Original file is missing or empty in storage. Showing extracted text
            instead — re-upload the PDF/image to restore the original viewer.
          </p>
          <div className="max-h-[min(80vh,48rem)] overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-xs print:max-h-none print:overflow-visible print:border-0 print:p-0 print:shadow-none">
            <pre className="resource-print-body whitespace-pre-wrap break-words font-sans text-[0.9375rem] leading-relaxed text-foreground">
              {formatExtractedPlainText(previewText)}
            </pre>
          </div>
        </div>
      ) : binary ? (
        <p className="text-sm text-muted-foreground">
          Original file could not be loaded. Try downloading instead, or
          re-upload the resource.
        </p>
      ) : previewText ? (
        <MarkdownContent
          content={previewText}
          className="resource-print-body text-[0.9375rem] text-foreground"
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          No content is available for this resource.
        </p>
      )}
    </div>
  );
}

export function ResourceViewerSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading resource">
      <div className="flex justify-end gap-2">
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
      <Skeleton className="h-[min(60vh,32rem)] w-full rounded-lg" />
    </div>
  );
}
