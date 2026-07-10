import { describe, expect, it } from "vitest";
import { targetDimensions } from "@/lib/evaluation/compress-eval-image";

describe("targetDimensions", () => {
  it("leaves small images unchanged", () => {
    expect(targetDimensions(1200, 800, 2400)).toEqual({
      width: 1200,
      height: 800,
    });
  });

  it("scales down long edge to max", () => {
    expect(targetDimensions(4000, 3000, 2400)).toEqual({
      width: 2400,
      height: 1800,
    });
    expect(targetDimensions(3000, 4000, 2400)).toEqual({
      width: 1800,
      height: 2400,
    });
  });
});
