"use client";

import type { Resource } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatResourceType } from "@/lib/resources/format";

type ResourceDeleteDialogProps = {
  resource: Resource | null;
  open: boolean;
  isDeleting: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ResourceDeleteDialog({
  resource,
  open,
  isDeleting,
  error,
  onOpenChange,
  onConfirm,
}: ResourceDeleteDialogProps) {
  if (!resource) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete resource?"
      description="This action cannot be undone."
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm leading-relaxed">
          <p>
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              &ldquo;{resource.title}&rdquo;
            </span>
            .
          </p>
          <p className="mt-2 text-muted-foreground">
            {formatResourceType(resource.resource_type)} ·{" "}
            {resource.ai_generated ? "AI-generated" : "Uploaded"}
          </p>
          <p className="mt-2 text-muted-foreground">
            The original file and all indexed search chunks for this class will
            be removed. The AI Hub will no longer be able to cite this material.
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting ? "Deleting…" : "Delete resource"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
