"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { useResources, useUploadResource } from "@/lib/hooks/use-resources";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResourceListTable } from "@/components/classes/resource-list-table";
import { cn } from "@/lib/utils";

type ClassResourcesSectionProps = {
  classId: string;
  /** Constrain height and scroll the list (side-by-side class page layout). */
  scrollable?: boolean;
};

export function ClassResourcesSection({
  classId,
  scrollable = false,
}: ClassResourcesSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: resources, isLoading, error } = useResources(classId);
  const uploadResource = useUploadResource(classId);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      await uploadResource.mutateAsync(file);
    } catch {
      // Error state is surfaced via uploadResource.error below.
    }
  }

  return (
    <Card
      className={cn(
        "flex min-h-0 flex-col",
        scrollable && "lg:max-h-[min(70vh,40rem)]"
      )}
    >
      <CardHeader className="flex shrink-0 flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-lg">Class resources</CardTitle>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.pdf,.jpg,.jpeg,.png,text/plain,application/pdf,image/jpeg,image/png"
            className="sr-only"
            disabled={uploadResource.isPending}
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={uploadResource.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {uploadResource.isPending ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4",
          scrollable && "overflow-hidden"
        )}
      >
        <p className="shrink-0 text-sm text-muted-foreground">
          Upload schemes, notes, or assignments as .txt (max 2 MB), .pdf, or
          images (.jpg/.png, max 5 MB). AI Hub-saved materials appear here too.
        </p>

        {uploadResource.isSuccess ? (
          <p className="shrink-0 text-sm text-primary">
            Uploaded &quot;{uploadResource.data?.title}&quot; (
            {uploadResource.data?.chunkCount} chunks indexed).
          </p>
        ) : null}

        {uploadResource.error ? (
          <p className="shrink-0 text-sm text-destructive">
            {uploadResource.error instanceof Error
              ? uploadResource.error.message
              : "Upload failed"}
          </p>
        ) : null}

        <div
          className={cn(
            "min-h-0 flex-1",
            scrollable && "overflow-y-auto pr-1"
          )}
        >
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading resources…</p>
          ) : error ? (
            <p className="text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "Failed to load resources"}
            </p>
          ) : (
            <ResourceListTable classId={classId} resources={resources ?? []} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
