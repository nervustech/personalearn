import { describe, expect, it } from "vitest";
import {
  ALREADY_EVALUATED_MESSAGE,
  isAlreadyEvaluatedError,
  markPagesAlreadyEvaluated,
} from "./assessment-eval-guard";

describe("assessment-eval-guard", () => {
  it("detects already-evaluated error messages", () => {
    expect(isAlreadyEvaluatedError(ALREADY_EVALUATED_MESSAGE)).toBe(true);
    expect(isAlreadyEvaluatedError("other")).toBe(false);
  });

  it("marks pages as already evaluated and conflicted", () => {
    const pages = markPagesAlreadyEvaluated<
      { storagePath: string; conflict?: boolean; alreadyEvaluated?: boolean }
    >([{ storagePath: "a", conflict: false }, { storagePath: "b" }]);
    expect(pages.every((p) => p.alreadyEvaluated && p.conflict)).toBe(true);
  });
});
