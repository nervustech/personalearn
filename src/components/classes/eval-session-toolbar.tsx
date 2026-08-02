"use client";

import { useRef, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { compressEvalScanImages } from "@/lib/evaluation/compress-eval-image";
import type { ScriptReviewDto } from "@/lib/evaluation/identity";
import {
  useProcessEvaluationIdentity,
  useStartEvaluationProcessing,
  useUploadEvaluationPages,
} from "@/lib/hooks/use-evaluation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type EvalSessionToolbarProps = {
  classId: string;
  batchId: string;
  batchSignedOff?: boolean;
  scripts: ScriptReviewDto[];
  onUpdated?: () => void;
};

export function EvalSessionToolbar({
  classId,
  batchId,
  batchSignedOff = false,
  scripts,
  onUpdated,
}: EvalSessionToolbarProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [kickSummary, setKickSummary] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadPages = useUploadEvaluationPages(classId);
  const processIdentity = useProcessEvaluationIdentity(classId);
  const startProcessing = useStartEvaluationProcessing(classId);

  const gradingActive = scripts.some((s) =>
    ["indexing", "evaluating", "parsing", "queued_draft", "drafting"].includes(
      s.status
    )
  );

  const uploadPending =
    compressing || uploadPages.isPending || processIdentity.isPending;

  function resetAddDialog() {
    setSelectedFiles([]);
    setFormError(null);
    setUploadWarnings([]);
    uploadPages.reset();
    processIdentity.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAddPages() {
    setFormError(null);
    setUploadWarnings([]);
    if (!selectedFiles.length) {
      setFormError("Choose at least one scan image.");
      return;
    }

    try {
      setCompressing(true);
      const files = await compressEvalScanImages(selectedFiles);
      setCompressing(false);

      const uploadResult = await uploadPages.mutateAsync({ batchId, files });
      const warnings = (uploadResult.warnings ?? []).map((w) => w.message);
      if (warnings.length) setUploadWarnings(warnings);

      if (!(uploadResult.skippedAll ?? false)) {
        await processIdentity.mutateAsync(batchId);
      }

      setAddOpen(false);
      resetAddDialog();
      onUpdated?.();
    } catch (error) {
      setCompressing(false);
      setFormError(
        error instanceof Error ? error.message : "Upload or identity failed"
      );
    }
  }

  async function handleRetryGrading() {
    setKickSummary(null);
    setFormError(null);
    try {
      const result = await startProcessing.mutateAsync(batchId);
      const phase = result.phase === "evaluate" ? "evaluate" : "index";
      setKickSummary(
        result.jobId
          ? `Batch ${phase} job submitted — processing runs in the background (usually a few minutes).`
          : "Batch processing checked — watch progress dots for updates."
      );
      onUpdated?.();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not retry grading"
      );
    }
  }

  if (batchSignedOff) return null;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={uploadPending}
          onClick={() => {
            resetAddDialog();
            setAddOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add pages
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={startProcessing.isPending || uploadPending}
          onClick={handleRetryGrading}
        >
          <RefreshCw
            className={`mr-1.5 h-3.5 w-3.5 ${startProcessing.isPending ? "animate-spin" : ""}`}
          />
          {startProcessing.isPending ? "Retrying…" : "Retry grading"}
        </Button>
      </div>
      {gradingActive ? (
        <p className="text-xs text-muted-foreground">
          Indexing and grading run in the background — you can leave this page.
          Use retry if dots stay stuck for several minutes.
        </p>
      ) : null}
      {kickSummary ? (
        <p className="text-xs text-muted-foreground">{kickSummary}</p>
      ) : null}
      {formError && !addOpen ? (
        <p className="text-xs text-destructive">{formError}</p>
      ) : null}

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) resetAddDialog();
        }}
        title="Add pages to session"
        description="Upload more scans for this assessment. New pages are matched to students and join the same grading queue."
        className="max-w-md"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="session-add-files">Scan images</Label>
            <input
              ref={fileInputRef}
              id="session-add-files"
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium"
              disabled={uploadPending}
              onChange={(event) => {
                setSelectedFiles(Array.from(event.target.files ?? []));
                setFormError(null);
                setUploadWarnings([]);
              }}
            />
            {selectedFiles.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {selectedFiles.length} file
                {selectedFiles.length === 1 ? "" : "s"} selected
              </p>
            ) : null}
          </div>

          {uploadWarnings.length > 0 ? (
            <ul className="space-y-1 text-sm text-amber-900 dark:text-amber-100">
              {uploadWarnings.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}

          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={uploadPending}
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={uploadPending || selectedFiles.length === 0}
              onClick={handleAddPages}
            >
              {compressing
                ? "Preparing…"
                : uploadPages.isPending
                  ? "Uploading…"
                  : processIdentity.isPending
                    ? "Identifying…"
                    : "Upload & process"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
