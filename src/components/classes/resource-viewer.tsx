"use client";

import { useEffect, useState } from "react";
import { Download, Pencil, X } from "lucide-react";
import type { Resource } from "@/types/database";
import { MarkdownContent } from "@/components/markdown/markdown-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpdateResource } from "@/lib/hooks/use-resources";
import {
  isBinaryOriginalResource,
  isEditableTextResource,
  resourceMimeType,
} from "@/lib/resources/format";

type ResourceViewerProps = {
  classId: string;
  resource: Resource;
  viewUrl: string | null;
  previewText: string;
};

export function ResourceViewer({
  classId,
  resource,
  viewUrl,
  previewText,
}: ResourceViewerProps) {
  const editable = isEditableTextResource(resource);
  const binary = isBinaryOriginalResource(resource.raw_content);
  const mime = resourceMimeType(resource.raw_content);
  const updateResource = useUpdateResource(classId, resource.id);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(resource.title);
  const [text, setText] = useState(previewText);

  useEffect(() => {
    setTitle(resource.title);
    setText(previewText);
    setEditing(false);
  }, [resource.id, resource.title, previewText]);

  function handleCancel() {
    setTitle(resource.title);
    setText(previewText);
    setEditing(false);
  }

  function handleSave() {
    updateResource.mutate(
      { title, text },
      {
        onSuccess: () => setEditing(false),
      }
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <a
          href={`/api/resources/${resource.id}/download`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-muted"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </a>
        {editable && !editing ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        ) : null}
        {editing ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={updateResource.isPending}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={updateResource.isPending || !title.trim()}
            >
              {updateResource.isPending ? "Saving…" : "Save"}
            </Button>
          </>
        ) : null}
      </div>

      {updateResource.error ? (
        <p className="text-sm text-destructive">
          {updateResource.error instanceof Error
            ? updateResource.error.message
            : "Save failed"}
        </p>
      ) : null}

      {editing ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="resource-title">Title</Label>
            <Input
              id="resource-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={updateResource.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resource-body">Body</Label>
            <textarea
              id="resource-body"
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={updateResource.isPending}
              rows={18}
              className="flex w-full rounded-xl border border-input bg-card px-3 py-2 font-mono text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
      ) : binary && viewUrl ? (
        mime.startsWith("image/") ? (
          /* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */
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
      ) : binary ? (
        <p className="text-sm text-muted-foreground">
          Original file could not be loaded. Try downloading instead.
        </p>
      ) : previewText ? (
        <MarkdownContent
          content={previewText}
          className="text-[0.9375rem] text-foreground"
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
        <Skeleton className="h-9 w-20 rounded-xl" />
      </div>
      <Skeleton className="h-[min(60vh,32rem)] w-full rounded-lg" />
    </div>
  );
}
