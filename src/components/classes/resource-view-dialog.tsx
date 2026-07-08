"use client";

import { Download } from "lucide-react";
import type { Resource } from "@/types/database";
import { Dialog } from "@/components/ui/dialog";
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
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{resource.ai_generated ? "AI-generated" : "Uploaded"}</span>
          <span>·</span>
          <span>{fileName}</span>
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border bg-muted/30 p-4">
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
            {preview || "No extracted text is available for this resource."}
          </pre>
        </div>

        <div className="flex justify-end">
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
      </div>
    </Dialog>
  );
}
