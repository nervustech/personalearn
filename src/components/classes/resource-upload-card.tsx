"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ResourceUploadCardProps = {
  classId: string;
  onUploaded?: () => void;
};

export function ResourceUploadCard({
  classId,
  onUploaded,
}: ResourceUploadCardProps) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("classId", classId);
      formData.append("file", file);

      const response = await fetch("/api/resources/ingest", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        error?: string;
        title?: string;
        chunkCount?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Upload failed");
      }

      setMessage(
        `Uploaded "${payload.title}" (${payload.chunkCount} chunks indexed).`
      );
      onUploaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Class resources</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Upload a scheme of work or notes as a .txt file (max 2 MB) for AI
          co-pilot context.
        </p>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            className="sr-only"
            disabled={uploading}
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload TXT"}
          </Button>
        </div>
        {message ? (
          <p className="text-sm text-primary">{message}</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
