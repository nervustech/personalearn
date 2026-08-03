"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { compressEvalScanImage } from "@/lib/evaluation/compress-eval-image";
import {
  confirmUploadedPage,
  mintUploadSlots,
  sha256HexBrowser,
  uploadBlobToSignedUrl,
} from "@/lib/evaluation/upload-client";
import {
  evaluationBatchesQueryKey,
  evaluationScriptsQueryKey,
} from "@/lib/hooks/use-evaluation";

export type UploadFileStatus =
  | "queued"
  | "compressing"
  | "uploading"
  | "confirming"
  | "confirmed"
  | "skipped"
  | "failed";

export type UploadFileItem = {
  id: string;
  fileName: string;
  status: UploadFileStatus;
  progress: number;
  error?: string;
  warning?: string;
};

export type UploadJob = {
  id: string;
  classId: string;
  batchId: string;
  status: "running" | "completed" | "failed";
  files: UploadFileItem[];
  warnings: string[];
  startedAt: number;
};

type QueueState = {
  jobs: UploadJob[];
};

type EnqueueInput = {
  classId: string;
  batchId: string;
  files: File[];
};

type QueueAction =
  | { type: "enqueue"; job: UploadJob }
  | { type: "remove"; jobId: string }
  | {
      type: "patch_file";
      jobId: string;
      fileId: string;
      patch: Partial<UploadFileItem>;
    }
  | { type: "append_warning"; jobId: string; warning: string }
  | { type: "finish_job"; jobId: string; status: UploadJob["status"] };

function createFileItems(files: File[]): UploadFileItem[] {
  return files.map((file) => ({
    id: crypto.randomUUID(),
    fileName: file.name,
    status: "queued" as const,
    progress: 0,
  }));
}

function reducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case "enqueue":
      return { jobs: [...state.jobs, action.job] };
    case "remove":
      return { jobs: state.jobs.filter((job) => job.id !== action.jobId) };
    case "patch_file":
      return {
        jobs: state.jobs.map((job) =>
          job.id !== action.jobId
            ? job
            : {
                ...job,
                files: job.files.map((file) =>
                  file.id !== action.fileId ? file : { ...file, ...action.patch }
                ),
              }
        ),
      };
    case "append_warning":
      return {
        jobs: state.jobs.map((job) =>
          job.id !== action.jobId
            ? job
            : { ...job, warnings: [...job.warnings, action.warning] }
        ),
      };
    case "finish_job":
      return {
        jobs: state.jobs.map((job) =>
          job.id !== action.jobId ? job : { ...job, status: action.status }
        ),
      };
    default:
      return state;
  }
}

type EvalUploadQueueContextValue = {
  jobs: UploadJob[];
  activeJob: UploadJob | null;
  enqueueUpload: (input: EnqueueInput) => string;
  retryFailed: (jobId: string) => void;
  dismissJob: (jobId: string) => void;
  jobForBatch: (batchId: string) => UploadJob | undefined;
};

const EvalUploadQueueContext =
  createContext<EvalUploadQueueContextValue | null>(null);

const UPLOAD_CONCURRENCY = 2;

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  async function next(): Promise<void> {
    const current = index;
    index += 1;
    if (current >= items.length) return;
    await worker(items[current]!);
    await next();
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => next())
  );
}

export function EvalUploadQueueProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(reducer, { jobs: [] });
  const stateRef = useRef(state);
  stateRef.current = state;
  const filesRef = useRef(new Map<string, File>());
  const runningRef = useRef(new Set<string>());

  const patchFile = useCallback(
    (jobId: string, fileId: string, patch: Partial<UploadFileItem>) => {
      dispatch({ type: "patch_file", jobId, fileId, patch });
    },
    []
  );

  const invalidateBatch = useCallback(
    (classId: string, batchId: string) => {
      queryClient.invalidateQueries({
        queryKey: evaluationBatchesQueryKey(classId),
      });
      queryClient.invalidateQueries({
        queryKey: evaluationScriptsQueryKey(batchId),
      });
    },
    [queryClient]
  );

  const processJob = useCallback(
    async (jobId: string) => {
      if (runningRef.current.has(jobId)) return;
      const job = stateRef.current.jobs.find((entry) => entry.id === jobId);
      if (!job || job.status === "completed") return;

      runningRef.current.add(jobId);

      type Prepared = {
        fileItem: UploadFileItem;
        blob: Blob;
        contentType: string;
      };

      const prepared: Prepared[] = [];

      try {
        for (const fileItem of job.files) {
          if (
            fileItem.status === "confirmed" ||
            fileItem.status === "skipped"
          ) {
            continue;
          }

          const source = filesRef.current.get(`${jobId}:${fileItem.id}`);
          if (!source) {
            patchFile(jobId, fileItem.id, {
              status: "failed",
              error: "File no longer available — re-select and upload again.",
            });
            continue;
          }

          patchFile(jobId, fileItem.id, {
            status: "compressing",
            progress: 0,
            error: undefined,
          });
          const compressed = await compressEvalScanImage(source);
          prepared.push({
            fileItem,
            blob: compressed,
            contentType: compressed.type || "image/jpeg",
          });
        }

        if (prepared.length > 0) {
          const slots = await mintUploadSlots(
            job.batchId,
            prepared.map((entry) => ({
              fileName: entry.fileItem.fileName,
              contentType: entry.contentType,
            }))
          );

          if (slots.length !== prepared.length) {
            throw new Error("Upload URL count mismatch");
          }

          await runWithConcurrency(
            prepared.map((entry, index) => ({ entry, slot: slots[index]! })),
            UPLOAD_CONCURRENCY,
            async ({ entry, slot }) => {
              const { fileItem, blob, contentType } = entry;
              try {
                patchFile(jobId, fileItem.id, {
                  status: "uploading",
                  progress: 0,
                  error: undefined,
                });

                await uploadBlobToSignedUrl(
                  { ...slot, contentType },
                  blob,
                  (loaded, total) => {
                    patchFile(jobId, fileItem.id, {
                      progress:
                        total > 0 ? Math.round((loaded / total) * 100) : 0,
                    });
                  }
                );

                patchFile(jobId, fileItem.id, {
                  status: "confirming",
                  progress: 100,
                });

                const contentHash = await sha256HexBrowser(blob);
                const confirm = await confirmUploadedPage(job.batchId, {
                  storagePath: slot.storagePath,
                  fileName: fileItem.fileName,
                  contentHash,
                });

                for (const warning of confirm.warnings ?? []) {
                  dispatch({
                    type: "append_warning",
                    jobId,
                    warning: warning.message,
                  });
                }

                if (confirm.skippedAll) {
                  patchFile(jobId, fileItem.id, {
                    status: "skipped",
                    progress: 100,
                    warning:
                      confirm.message ??
                      "Already in this session — not added again.",
                  });
                } else {
                  patchFile(jobId, fileItem.id, {
                    status: "confirmed",
                    progress: 100,
                  });
                }

                invalidateBatch(job.classId, job.batchId);
              } catch (error) {
                patchFile(jobId, fileItem.id, {
                  status: "failed",
                  error:
                    error instanceof Error ? error.message : "Upload failed",
                });
              }
            }
          );
        }

        const latest = stateRef.current.jobs.find((entry) => entry.id === jobId);
        const hasFailed = latest?.files.some((f) => f.status === "failed");
        dispatch({
          type: "finish_job",
          jobId,
          status: hasFailed ? "failed" : "completed",
        });
      } catch (error) {
        for (const fileItem of job.files) {
          if (
            fileItem.status !== "confirmed" &&
            fileItem.status !== "skipped" &&
            fileItem.status !== "failed"
          ) {
            patchFile(jobId, fileItem.id, {
              status: "failed",
              error:
                error instanceof Error ? error.message : "Upload failed",
            });
          }
        }
        dispatch({ type: "finish_job", jobId, status: "failed" });
      } finally {
        runningRef.current.delete(jobId);
        invalidateBatch(job.classId, job.batchId);
      }
    },
    [invalidateBatch, patchFile]
  );

  const enqueueUpload = useCallback(
    ({ classId, batchId, files }: EnqueueInput) => {
      const jobId = crypto.randomUUID();
      const fileItems = createFileItems(files);
      files.forEach((file, index) => {
        const item = fileItems[index];
        if (item) {
          filesRef.current.set(`${jobId}:${item.id}`, file);
        }
      });
      dispatch({
        type: "enqueue",
        job: {
          id: jobId,
          classId,
          batchId,
          status: "running",
          files: fileItems,
          warnings: [],
          startedAt: Date.now(),
        },
      });
      void processJob(jobId);
      return jobId;
    },
    [processJob]
  );

  const retryFailed = useCallback(
    (jobId: string) => {
      const job = stateRef.current.jobs.find((entry) => entry.id === jobId);
      if (!job) return;
      for (const file of job.files) {
        if (file.status === "failed") {
          patchFile(jobId, file.id, {
            status: "queued",
            progress: 0,
            error: undefined,
          });
        }
      }
      dispatch({ type: "finish_job", jobId, status: "running" });
      void processJob(jobId);
    },
    [patchFile, processJob]
  );

  const dismissJob = useCallback((jobId: string) => {
    for (const key of filesRef.current.keys()) {
      if (key.startsWith(`${jobId}:`)) {
        filesRef.current.delete(key);
      }
    }
    dispatch({ type: "remove", jobId });
  }, []);

  const activeJob = useMemo(
    () => state.jobs.find((job) => job.status === "running") ?? null,
    [state.jobs]
  );

  const jobForBatch = useCallback(
    (batchId: string) =>
      state.jobs.find(
        (job) =>
          job.batchId === batchId &&
          (job.status === "running" || job.status === "failed")
      ),
    [state.jobs]
  );

  const value = useMemo(
    () => ({
      jobs: state.jobs,
      activeJob,
      enqueueUpload,
      retryFailed,
      dismissJob,
      jobForBatch,
    }),
    [
      state.jobs,
      activeJob,
      enqueueUpload,
      retryFailed,
      dismissJob,
      jobForBatch,
    ]
  );

  return (
    <EvalUploadQueueContext.Provider value={value}>
      {children}
    </EvalUploadQueueContext.Provider>
  );
}

export function useEvalUploadQueue() {
  const context = useContext(EvalUploadQueueContext);
  if (!context) {
    throw new Error(
      "useEvalUploadQueue must be used within EvalUploadQueueProvider"
    );
  }
  return context;
}

export function useUploadBeforeUnload() {
  const { activeJob } = useEvalUploadQueue();

  useEffect(() => {
    if (!activeJob) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [activeJob]);
}
