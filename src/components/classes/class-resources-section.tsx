"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { useResources, useUploadResource } from "@/lib/hooks/use-resources";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResourceListTable } from "@/components/classes/resource-list-table";

type ClassResourcesSectionProps = {
  classId: string;
};

export function ClassResourcesSection({ classId }: ClassResourcesSectionProps) {
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
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
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
            disabled={uploadResource.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {uploadResource.isPending ? "Uploading…" : "Upload resource"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload schemes, notes, or assignments as .txt (max 2 MB), .pdf, or
          images (.jpg/.png, max 5 MB). AI Hub-saved materials appear here too.
        </p>

        {uploadResource.isSuccess ? (
          <p className="text-sm text-primary">
            Uploaded &quot;{uploadResource.data?.title}&quot; (
            {uploadResource.data?.chunkCount} chunks indexed).
          </p>
        ) : null}

        {uploadResource.error ? (
          <p className="text-sm text-destructive">
            {uploadResource.error instanceof Error
              ? uploadResource.error.message
              : "Upload failed"}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading resources…</p>
        ) : error ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load resources"}
          </p>
        ) : (
          <ResourceListTable classId={classId} resources={resources ?? []} />
        )}
      </CardContent>
    </Card>
  );
}
