"use client";

import { useRef, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import type { ScriptReviewDto } from "@/lib/evaluation/identity";
import {
  useEvaluateLive,
  useEvaluationScripts,
  useStartEvaluationProcessing,
} from "@/lib/hooks/use-evaluation";
import { useEvalUploadQueue } from "@/lib/hooks/use-eval-upload-queue";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type EvalSessionToolbarProps = {
  classId: string;
  batchId: string;
  batchSignedOff?: boolean;
  scripts: ScriptReviewDto[];
  pageCount?: number;
  isLive?: boolean;
  onUpdated?: () => void;
};

export function EvalSessionToolbar({
  classId,
  batchId,
  batchSignedOff = false,
  scripts,
  pageCount = 0,
  isLive = false,
  onUpdated,
}: EvalSessionToolbarProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [kickSummary, setKickSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { enqueueUpload, jobForBatch } = useEvalUploadQueue();
  const startProcessing = useStartEvaluationProcessing(classId);
  const evaluateLive = useEvaluateLive(classId);
  const { refetch } = useEvaluationScripts(batchId);

  const uploadJob = jobForBatch(batchId);
  const uploadActive = uploadJob?.status === "running";

  const gradingActive = scripts.some((s) =>
    ["indexing", "evaluating", "parsing", "queued_draft", "drafting"].includes(
      s.status
    )
  );

  const gradingBusy =
    gradingActive || startProcessing.isPending || evaluateLive.isPending;

  const canStartGrading =
    pageCount > 0 && !uploadActive && !gradingBusy;

  function resetAddDialog() {
    setSelectedFiles([]);
    setFormError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleAddPages() {
    setFormError(null);
    if (!selectedFiles.length) {
      setFormError("Choose at least one scan image.");
      return;
    }

    enqueueUpload({
      classId,
      batchId,
      files: selectedFiles,
    });

    setAddOpen(false);
    resetAddDialog();
    onUpdated?.();
  }

  async function handleStartGrading() {
    setKickSummary(null);
    setFormError(null);
    try {
      if (isLive) {
        await evaluateLive.mutateAsync({ batchId });
        setKickSummary(
          "Grading this student — the queue updates when marks are ready."
        );
      } else {
        const result = await startProcessing.mutateAsync(batchId);
        const phase = result.phase === "evaluate" ? "evaluate" : "index";
        setKickSummary(
          result.jobId
            ? `Batch ${phase} job submitted — this page polls for results every few seconds.`
            : "Batch processing started."
        );
      }
      await refetch();
      onUpdated?.();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not start grading"
      );
    }
  }

  async function handleRetryGrading() {
    setKickSummary(null);
    setFormError(null);
    try {
      if (isLive) {
        await evaluateLive.mutateAsync({ batchId });
        setKickSummary(
          "Grading this student — the queue updates when marks are ready."
        );
      } else {
        const result = await startProcessing.mutateAsync(batchId);
        const phase = result.phase === "evaluate" ? "evaluate" : "index";
        setKickSummary(
          result.jobId
            ? `Batch ${phase} job submitted — this page polls for results every few seconds.`
            : "Batch processing checked — watch progress dots for updates."
        );
      }
      await refetch();
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
          disabled={uploadActive}
          onClick={() => {
            resetAddDialog();
            setAddOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add pages
        </Button>
        {canStartGrading ? (
          <Button
            type="button"
            size="sm"
            disabled={startProcessing.isPending || evaluateLive.isPending}
            onClick={handleStartGrading}
          >
            {startProcessing.isPending || evaluateLive.isPending
              ? "Starting…"
              : isLive
                ? "Grade now"
                : "Start grading"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={
              startProcessing.isPending ||
              evaluateLive.isPending ||
              uploadActive ||
              gradingActive
            }
            onClick={handleRetryGrading}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${startProcessing.isPending ? "animate-spin" : ""}`}
            />
            {startProcessing.isPending ? "Retrying…" : "Retry grading"}
          </Button>
        )}
      </div>
      {uploadActive ? (
        <p className="text-xs text-muted-foreground">
          Uploading pages in the background — start grading when uploads finish.
        </p>
      ) : gradingActive ? (
        <p className="text-xs text-muted-foreground">
          Indexing and grading run in the background — you can leave this page.
          Use retry if dots stay stuck for several minutes.
        </p>
      ) : canStartGrading ? (
        <p className="text-xs text-muted-foreground">
          {pageCount} page{pageCount === 1 ? "" : "s"} uploaded — start grading
          when ready.
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
        description="Upload more scans for this assessment. Pages save as they upload — start or retry grading from the toolbar when ready."
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
              disabled={uploadActive}
              onChange={(event) => {
                setSelectedFiles(Array.from(event.target.files ?? []));
                setFormError(null);
              }}
            />
            {selectedFiles.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {selectedFiles.length} file
                {selectedFiles.length === 1 ? "" : "s"} selected
              </p>
            ) : null}
          </div>

          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={uploadActive}
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={uploadActive || selectedFiles.length === 0}
              onClick={handleAddPages}
            >
              Upload in background
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
