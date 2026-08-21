import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findInflightGeminiJob,
  insertGeminiBatchJob,
  isUniqueInflightJobError,
} from "./batch-jobs";
import type { GeminiBatchJob } from "@/types/database";

const inflightJob: GeminiBatchJob = {
  id: "job-1",
  batch_id: "batch-1",
  phase: "evaluate",
  provider_batch_name: "providers/batches/abc",
  state: "running",
  attempt_count: 1,
  page_count: 0,
  script_count: 2,
  error: null,
  submitted_at: "2026-08-17T00:00:00Z",
  completed_at: null,
  created_at: "2026-08-17T00:00:00Z",
  updated_at: "2026-08-17T00:00:00Z",
};

function queryResult(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const next = () => builder;
  builder.select = next;
  builder.eq = next;
  builder.in = next;
  builder.order = next;
  builder.limit = next;
  builder.insert = next;
  builder.maybeSingle = async () => result;
  builder.single = async () => result;
  return builder;
}

describe("isUniqueInflightJobError", () => {
  it("matches Postgres unique violations", () => {
    expect(isUniqueInflightJobError({ code: "23505" })).toBe(true);
    expect(
      isUniqueInflightJobError({
        message: "duplicate key value violates unique constraint",
      })
    ).toBe(true);
    expect(
      isUniqueInflightJobError({
        message: 'relation "idx_gemini_batch_jobs_one_inflight_per_phase"',
      })
    ).toBe(true);
    expect(isUniqueInflightJobError({ message: "timeout" })).toBe(false);
  });
});

describe("findInflightGeminiJob", () => {
  it("returns the latest submitted/running job for the phase", async () => {
    const supabase = {
      from: vi.fn(() => queryResult({ data: inflightJob, error: null })),
    };

    const found = await findInflightGeminiJob(supabase as never, {
      batchId: "batch-1",
      phase: "evaluate",
    });

    expect(found?.id).toBe("job-1");
    expect(supabase.from).toHaveBeenCalledWith("gemini_batch_jobs");
  });

  it("returns null when no inflight job exists", async () => {
    const supabase = {
      from: vi.fn(() => queryResult({ data: null, error: null })),
    };

    const found = await findInflightGeminiJob(supabase as never, {
      batchId: "batch-1",
      phase: "index",
    });

    expect(found).toBeNull();
  });
});

describe("insertGeminiBatchJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the inserted row", async () => {
    const inserted = { ...inflightJob, state: "submitted" as const };
    const supabase = {
      from: vi.fn(() => queryResult({ data: inserted, error: null })),
    };

    const job = await insertGeminiBatchJob(supabase as never, {
      batch_id: "batch-1",
      phase: "evaluate",
      provider_batch_name: "providers/batches/abc",
      state: "submitted",
      script_count: 2,
      submitted_at: "2026-08-17T00:00:00Z",
    });

    expect(job.id).toBe("job-1");
  });

  it("reuses the inflight job on unique-index race", async () => {
    let call = 0;
    const supabase = {
      from: vi.fn(() => {
        call += 1;
        if (call === 1) {
          return queryResult({
            data: null,
            error: { code: "23505", message: "duplicate key" },
          });
        }
        return queryResult({ data: inflightJob, error: null });
      }),
    };

    const job = await insertGeminiBatchJob(supabase as never, {
      batch_id: "batch-1",
      phase: "evaluate",
      provider_batch_name: "providers/batches/lost-race",
      state: "submitted",
      submitted_at: "2026-08-17T00:00:00Z",
    });

    expect(job.id).toBe("job-1");
    expect(job.provider_batch_name).toBe("providers/batches/abc");
    expect(call).toBe(2);
  });
});
