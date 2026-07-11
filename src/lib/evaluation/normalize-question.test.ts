import { describe, expect, it } from "vitest";
import {
  compareQuestionLabels,
  hasIntegerQuestionGap,
  normalizeQuestionLabel,
  parseQuestionLabels,
} from "./normalize-question";

describe("normalizeQuestionLabel", () => {
  it("normalizes parts and letters", () => {
    expect(normalizeQuestionLabel("1.a")).toBe("1a");
    expect(normalizeQuestionLabel("1(b)")).toBe("1b");
    expect(normalizeQuestionLabel("Q1-c")).toBe("1c");
    expect(normalizeQuestionLabel("A")).toBe("a");
    expect(normalizeQuestionLabel(3)).toBe("3");
  });

  it("returns null for empty junk", () => {
    expect(normalizeQuestionLabel("")).toBeNull();
    expect(normalizeQuestionLabel("???")).toBeNull();
    expect(normalizeQuestionLabel(null)).toBeNull();
  });
});

describe("parseQuestionLabels", () => {
  it("dedupes equivalent part spellings", () => {
    expect(parseQuestionLabels(["1.a", "1a", "1(A)", 2])).toEqual([
      "1a",
      "2",
    ]);
  });
});

describe("compareQuestionLabels", () => {
  it("orders stem then part", () => {
    expect(
      ["2", "1b", "1a", "10", "a"].sort(compareQuestionLabels)
    ).toEqual(["1a", "1b", "2", "10", "a"]);
  });
});

describe("hasIntegerQuestionGap", () => {
  it("detects gaps only for bare integers", () => {
    expect(hasIntegerQuestionGap(["1", "3"])).toBe(true);
    expect(hasIntegerQuestionGap(["1", "2", "3"])).toBe(false);
    expect(hasIntegerQuestionGap(["1a", "1b", "3"])).toBe(false);
    expect(hasIntegerQuestionGap(["a", "c"])).toBe(false);
  });
});
