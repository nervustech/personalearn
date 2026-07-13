import { describe, expect, it } from "vitest";
import { previewCompetency, statusFromRatio } from "./competency-map";

describe("statusFromRatio", () => {
  it("maps thresholds", () => {
    expect(statusFromRatio(8, 10)).toBe("mastered");
    expect(statusFromRatio(5, 10)).toBe("developing");
    expect(statusFromRatio(4, 10)).toBe("not_yet");
  });

  it("returns not_yet for invalid inputs", () => {
    expect(statusFromRatio(null, 10)).toBe("not_yet");
    expect(statusFromRatio(5, null)).toBe("not_yet");
    expect(statusFromRatio(5, 0)).toBe("not_yet");
  });
});

describe("previewCompetency", () => {
  it("includes strand and ratio", () => {
    expect(
      previewCompetency({
        strand: "Numbers",
        subStrand: "Fractions",
        awarded: 8,
        max: 10,
      })
    ).toEqual({
      strand: "Numbers",
      sub_strand: "Fractions",
      status: "mastered",
      ratio: 0.8,
    });
  });
});
