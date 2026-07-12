import { describe, expect, it } from "vitest";
import { computeScriptTotal } from "./script-totals";

describe("computeScriptTotal", () => {
  it("sums finite awarded and max", () => {
    expect(
      computeScriptTotal([
        { awarded: 2, max: 5 },
        { awarded: 3, max: 5 },
      ])
    ).toEqual({ awarded: 5, max: 10 });
  });

  it("ignores nulls and returns null when none finite", () => {
    expect(
      computeScriptTotal([
        { awarded: null, max: null },
        { awarded: null, max: 4 },
      ])
    ).toEqual({ awarded: null, max: 4 });

    expect(computeScriptTotal([])).toEqual({ awarded: null, max: null });
  });
});
