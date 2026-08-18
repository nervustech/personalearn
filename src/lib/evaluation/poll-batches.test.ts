import { beforeEach, describe, expect, it, vi } from "vitest";
import { startOrResumeBatchProcessing, submitEvaluateBatch } from "./poll-batches";
import { findInflightGeminiJob } from "./batch-jobs";
import type { EvaluationBatch, GeminiBatchJob } from "@/types/database";

vi.mock("./batch-jobs", async () => {
  const actual = await vi.importActual<typeof import("./batch-jobs")>(
    "./batch-jobs"
  );
  return {
    ...actual,
    findInflightGeminiJob: vi.fn(),
    insertGeminiBatchJob: vi.fn(),
  };
});

vi.mock("./batch-client", () => ({
  buildEvaluateBatchLine: vi.fn(),
  buildIndexBatchLine: vi.fn(),
  downloadBatchResults: vi.fn(),
  getBatchJobStatus: vi.fn(),
  submitBatchJob: vi.fn(),
}));

vi.mock("./load-marking-scheme", () => ({
  loadMarkingSchemeText: vi.fn().mockResolvedValue("scheme"),
}));

vi.mock("./eval-provider", () => ({
  evalPromptCacheKey: vi.fn(() => "cache-key"),
}));

vi.mock("./persist-results", () => ({
  persistEvaluateResults: vi.fn(),
  persistIndexResults: vi.fn(),
  upsertScriptFromGroup: vi.fn(),
  markScriptFailed: vi.fn(),
}));

vi.mock("./batch-status", () => ({
  refreshBatchStatusRollup: vi.fn(),
}));

const mockFindInflight = vi.mocked(findInflightGeminiJob);

const batch = {
  id: "batch-1",
  class_id: "class-1",
} as EvaluationBatch;

const inflightEval: GeminiBatchJob = {
  id: "job-eval-1",
  batch_id: "batch-1",
  phase: "evaluate",
  provider_batch_name: "providers/batches/eval",
  state: "submitted",
  attempt_count: 1,
  page_count: 0,
  script_count: 2,
  error: null,
  submitted_at: "2026-08-17T00:00:00Z",
  completed_at: null,
  created_at: "2026-08-17T00:00:00Z",
  updated_at: "2026-08-17T00:00:00Z",
};

function resolved(value: unknown) {
  const builder: Record<string, unknown> = {};
  const next = () => builder;
  for (const key of [
    "select",
    "eq",
    "in",
    "is",
    "order",
    "limit",
    "update",
    "insert",
  ]) {
    builder[key] = next;
  }
  builder.maybeSingle = async () => value;
  builder.single = async () => value;
  builder.then = (
    onFulfilled: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown
  ) => Promise.resolve(value).then(onFulfilled, onRejected);
  return builder;
}

describe("startOrResumeBatchProcessing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindInflight.mockResolvedValue(null);
  });

  it("returns an inflight evaluate job instead of submitting another", async () => {
    mockFindInflight.mockImplementation(async (_sb, input) => {
      if (input.phase === "evaluate") return inflightEval;
      return null;
    });

    const update = vi.fn();
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "evaluation_pages") {
          return resolved({ count: 0, error: null });
        }
        if (table === "evaluated_scripts") {
          return { update };
        }
        return resolved({ data: null, error: null });
      }),
    };

    const result = await startOrResumeBatchProcessing(
      supabase as never,
      batch
    );

    expect(result.phase).toBe("evaluate");
    expect(result.job.id).toBe("job-eval-1");
    expect(update).not.toHaveBeenCalled();
  });

  it("returns an inflight index job when unindexed pages remain", async () => {
    const inflightIndex: GeminiBatchJob = {
      ...inflightEval,
      id: "job-index-1",
      phase: "index",
    };
    mockFindInflight.mockResolvedValue(inflightIndex);

    const supabase = {
      from: vi.fn(() => resolved({ count: 3, error: null })),
    };

    const result = await startOrResumeBatchProcessing(
      supabase as never,
      batch
    );

    expect(result.phase).toBe("index");
    expect(result.job.id).toBe("job-index-1");
  });
});

describe("submitEvaluateBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the inflight evaluate job without submitting a new provider job", async () => {
    mockFindInflight.mockResolvedValue(inflightEval);

    const supabase = {
      from: vi.fn(() =>
        resolved({
          data: [{ id: "script-1", status: "evaluating", page_order: [] }],
          error: null,
        })
      ),
    };

    const job = await submitEvaluateBatch(supabase as never, batch);
    expect(job?.id).toBe("job-eval-1");
  });

  it("does not reuse a completed job (sequential re-evaluate remains allowed)", async () => {
    mockFindInflight.mockResolvedValue(null);

    const supabase = {
      from: vi.fn(() =>
        resolved({
          data: [],
          error: null,
        })
      ),
    };

    const job = await submitEvaluateBatch(supabase as never, batch);
    expect(job).toBeNull();
    expect(mockFindInflight).toHaveBeenCalledWith(
      expect.anything(),
      { batchId: "batch-1", phase: "evaluate" }
    );
  });
});
