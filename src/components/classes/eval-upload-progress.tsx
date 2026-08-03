"use client";

import { AlertCircle, CheckCircle2, Upload, X } from "lucide-react";
import {
  useEvalUploadQueue,
  useUploadBeforeUnload,
  type UploadFileItem,
  type UploadJob,
} from "@/lib/hooks/use-eval-upload-queue";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function fileStatusLabel(file: UploadFileItem): string {
  switch (file.status) {
    case "queued":
      return "Waiting…";
    case "compressing":
      return "Preparing…";
    case "uploading":
      return `Uploading… ${file.progress}%`;
    case "confirming":
      return "Saving…";
    case "confirmed":
      return "Uploaded";
    case "skipped":
      return "Skipped (duplicate)";
    case "failed":
      return file.error ?? "Failed";
    default:
      return file.status;
  }
}

function jobSummary(job: UploadJob): string {
  const total = job.files.length;
  const done = job.files.filter(
    (f) => f.status === "confirmed" || f.status === "skipped"
  ).length;
  const failed = job.files.filter((f) => f.status === "failed").length;
  if (job.status === "running") {
    return `Uploading ${done} of ${total} pages…`;
  }
  if (failed > 0) {
    return `${done} uploaded · ${failed} failed`;
  }
  return `${done} page${done === 1 ? "" : "s"} uploaded`;
}

function jobProgress(job: UploadJob): number {
  if (job.files.length === 0) return 0;
  const weights = job.files.map((file) => {
    switch (file.status) {
      case "confirmed":
      case "skipped":
        return 100;
      case "uploading":
        return 40 + file.progress * 0.5;
      case "confirming":
        return 95;
      case "compressing":
        return 20;
      default:
        return 0;
    }
  });
  return Math.round(
    weights.reduce((sum, value) => sum + value, 0) / job.files.length
  );
}

export function EvalUploadProgressPanel({
  batchId,
  className,
}: {
  batchId?: string;
  className?: string;
}) {
  const { jobs, retryFailed, dismissJob } = useEvalUploadQueue();
  useUploadBeforeUnload();

  const visible = batchId
    ? jobs.filter((job) => job.batchId === batchId)
    : jobs;

  if (visible.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {visible.map((job) => (
        <div
          key={job.id}
          className="rounded-xl border border-border bg-card p-3 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              {job.status === "failed" ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              ) : job.status === "completed" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Upload className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">{jobSummary(job)}</p>
                <p className="text-xs text-muted-foreground">
                  {job.status === "running"
                    ? "You can stay on this page — uploads continue in the background."
                    : job.status === "failed"
                      ? "Retry failed files or dismiss when done."
                      : "Upload complete — start grading when ready."}
                </p>
              </div>
            </div>
            {job.status !== "running" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 p-0"
                onClick={() => dismissJob(job.id)}
                aria-label="Dismiss upload panel"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                job.status === "failed"
                  ? "bg-destructive/80"
                  : job.status === "completed"
                    ? "bg-emerald-500"
                    : "bg-indigo-500"
              )}
              style={{ width: `${jobProgress(job)}%` }}
            />
          </div>

          <ul className="mt-3 max-h-36 space-y-1 overflow-y-auto text-xs">
            {job.files.map((file) => (
              <li
                key={file.id}
                className={cn(
                  "truncate",
                  file.status === "failed"
                    ? "text-destructive"
                    : file.status === "skipped"
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-muted-foreground"
                )}
              >
                {file.fileName} — {fileStatusLabel(file)}
              </li>
            ))}
          </ul>

          {job.warnings.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-200">
              {job.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          {job.status === "failed" ? (
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => retryFailed(job.id)}
              >
                Retry failed
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => dismissJob(job.id)}
              >
                Dismiss
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Compact floating indicator for active uploads anywhere in the dashboard. */
export function EvalUploadFloatingIndicator() {
  const { activeJob } = useEvalUploadQueue();
  if (!activeJob) return null;

  const progress = jobProgress(activeJob);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 max-w-xs">
      <div className="rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
        <p className="text-sm font-medium">{jobSummary(activeJob)}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
