import { describe, expect, it } from "vitest";
import {
  formatEvalQueueSummary,
  summarizeEvalQueue,
} from "@/lib/evaluation/queue-summary";

describe("summarizeEvalQueue", () => {
  it("aggregates script states", () => {
    const summary = summarizeEvalQueue([
      { status: "drafted" } as never,
      { status: "drafting" } as never,
      { status: "identity_amber" } as never,
      { status: "signed_off" } as never,
    ]);

    expect(summary).toEqual({
      ready: 1,
      grading: 1,
      identity: 1,
      blocked: 0,
      done: 1,
    });
    expect(formatEvalQueueSummary(summary)).toBe(
      "1 ready · 1 grading · 1 need identity · 1 done"
    );
  });

  it("does not treat uploaded pages as an identity exception", () => {
    const summary = summarizeEvalQueue([
      { status: "uploaded" } as never,
      { status: "pending" } as never,
      { status: "ready" } as never,
    ]);
    expect(summary.identity).toBe(0);
    expect(summary.ready).toBe(1);
  });

  it("counts already-evaluated amber as blocked, not identity", () => {
    const summary = summarizeEvalQueue([
      { status: "identity_amber", alreadyEvaluated: true } as never,
      { status: "identity_amber" } as never,
    ]);

    expect(summary.identity).toBe(1);
    expect(summary.blocked).toBe(1);
    expect(formatEvalQueueSummary(summary)).toBe(
      "0 ready · 0 grading · 1 need identity · 1 blocked · 0 done"
    );
  });
});
