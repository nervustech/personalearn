"use client";

import { Download } from "lucide-react";
import type { Resource } from "@/types/database";
import { Dialog } from "@/components/ui/dialog";
import { MarkdownContent } from "@/components/markdown/markdown-content";
import { resourcePreviewText } from "@/lib/resources/format";

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

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={resource.title}
      className="max-h-[min(92vh,54rem)] w-[calc(100%-2rem)] max-w-4xl"
      headerAction={
        <a
          href={`/api/resources/${resource.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-xs transition-all hover:bg-muted hover:text-foreground"
          aria-label="Download original"
          title="Download original"
        >
          <Download className="h-4 w-4" />
        </a>
      }
    >
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
    </Dialog>
  );
}
