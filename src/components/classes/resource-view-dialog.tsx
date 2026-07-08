"use client";

import { Download } from "lucide-react";
import type { Resource } from "@/types/database";
import { Dialog } from "@/components/ui/dialog";
import { MarkdownContent } from "@/components/markdown/markdown-content";
import {
  formatResourceDate,
  formatResourceType,
  resourceFileName,
  resourcePreviewText,
} from "@/lib/resources/format";

type ResourceViewDialogProps = {
  resource: Resource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ResourceViewDialog({
  resource,
  open,
  onOpenChange,
}: ResourceViewDialogProps) {
  if (!resource) return null;

  const preview = resourcePreviewText(resource.raw_content);
  const fileName = resourceFileName(resource.raw_content);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={resource.title}
      description={`${formatResourceType(resource.resource_type)} · ${formatResourceDate(resource.created_at)}`}
      className="max-h-[min(90vh,48rem)] w-[calc(100%-2rem)] max-w-4xl"
    >
      <div className="flex max-h-[min(75vh,40rem)] flex-col gap-4">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span>{resource.ai_generated ? "AI-generated" : "Uploaded"}</span>
            <span>·</span>
            <span>{fileName}</span>
          </div>
          <a
            href={`/api/resources/${resource.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            Download original
          </a>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xs">
          {preview ? (
            <MarkdownContent
              content={preview}
              className="text-[0.9375rem] text-foreground"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No extracted text is available for this resource.
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
