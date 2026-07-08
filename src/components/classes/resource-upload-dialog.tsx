"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import type { ResourceType } from "@/types/database";
import { useUploadResource } from "@/lib/hooks/use-resources";
import {
  RESOURCE_TYPE_LABELS,
  RESOURCE_TYPE_OPTIONS,
} from "@/lib/resources/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type ResourceUploadDialogProps = {
  classId: string;
};

export function ResourceUploadDialog({ classId }: ResourceUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [resourceType, setResourceType] = useState<ResourceType>("other");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadResource = useUploadResource(classId);

  function resetForm() {
    setSelectedFile(null);
    setResourceType("other");
    if (fileInputRef.current) fileInputRef.current.value = "";
    uploadResource.reset();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  async function handleUpload() {
    if (!selectedFile) return;

    try {
      await uploadResource.mutateAsync({
        file: selectedFile,
        resourceType,
      });
      handleOpenChange(false);
    } catch {
      // Error shown below.
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => setOpen(true)}
        aria-label="Upload resource"
        title="Upload resource"
      >
        <Upload className="h-4 w-4" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Upload resource"
        description="Add a file to this class library for AI Hub context."
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload schemes, notes, or assignments as .txt (max 2 MB), .pdf, or
            images (.jpg/.png, max 5 MB). AI Hub-saved materials appear here
            too.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="resource-type">Resource type</Label>
            <Select
              id="resource-type"
              value={resourceType}
              onChange={(event) =>
                setResourceType(event.target.value as ResourceType)
              }
            >
              {RESOURCE_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {RESOURCE_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resource-file">File</Label>
            <input
              ref={fileInputRef}
              id="resource-file"
              type="file"
              accept=".txt,.pdf,.jpg,.jpeg,.png,text/plain,application/pdf,image/jpeg,image/png"
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium"
              disabled={uploadResource.isPending}
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
                uploadResource.reset();
              }}
            />
            {selectedFile ? (
              <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
            ) : null}
          </div>

          {uploadResource.error ? (
            <p className="text-sm text-destructive">
              {uploadResource.error instanceof Error
                ? uploadResource.error.message
                : "Upload failed"}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={uploadResource.isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedFile || uploadResource.isPending}
              onClick={handleUpload}
            >
              {uploadResource.isPending ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
