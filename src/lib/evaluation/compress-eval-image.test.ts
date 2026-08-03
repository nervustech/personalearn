import { describe, expect, it } from "vitest";
import {
  buildEvalPageStoragePath,
  isValidEvalPageStoragePath,
  shouldSkipEvalScanCompression,
  skipThresholdBytes,
  targetDimensions,
} from "@/lib/evaluation/compress-eval-image.shared";

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

describe("shouldSkipEvalScanCompression", () => {
  it("skips small JPEG within max edge", () => {
    expect(
      shouldSkipEvalScanCompression(
        "scan.jpg",
        "image/jpeg",
        3 * 1024 * 1024,
        2000,
        1500
      )
    ).toBe(true);
  });

  it("does not skip JPEG that exceeds skip threshold", () => {
    expect(
      shouldSkipEvalScanCompression(
        "scan.jpg",
        "image/jpeg",
        5 * 1024 * 1024,
        2000,
        1500
      )
    ).toBe(false);
  });

  it("does not skip when resize is required", () => {
    expect(
      shouldSkipEvalScanCompression(
        "scan.jpg",
        "image/jpeg",
        1024,
        4000,
        3000
      )
    ).toBe(false);
  });

  it("uses a lower skip threshold for PNG", () => {
    expect(skipThresholdBytes("scan.png", "image/png")).toBe(2 * 1024 * 1024);
    expect(skipThresholdBytes("scan.jpg", "image/jpeg")).toBe(4 * 1024 * 1024);
  });
});

describe("buildEvalPageStoragePath", () => {
  it("builds a class-scoped path", () => {
    const path = buildEvalPageStoragePath(
      "class-1",
      "batch-1",
      "page.jpg",
      "image/jpeg"
    );
    expect(path.startsWith("class-1/batch-1/")).toBe(true);
    expect(path.endsWith(".jpg")).toBe(true);
  });

  it("validates storage paths", () => {
    const path = buildEvalPageStoragePath(
      "class-1",
      "batch-1",
      "page.jpg",
      "image/jpeg"
    );
    expect(isValidEvalPageStoragePath(path, "class-1", "batch-1")).toBe(true);
    expect(isValidEvalPageStoragePath(path, "class-2", "batch-1")).toBe(false);
    expect(
      isValidEvalPageStoragePath("../evil", "class-1", "batch-1")
    ).toBe(false);
  });
});
