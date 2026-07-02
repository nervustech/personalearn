import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk-text";

describe("chunkText", () => {
  it("returns empty array for blank text", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("returns single chunk when text fits", () => {
    expect(chunkText("short scheme")).toEqual(["short scheme"]);
  });

  it("splits long text with overlap", () => {
    const text = "a".repeat(2500);
    const chunks = chunkText(text, 1000, 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toHaveLength(1000);
    expect(chunks[1]!.startsWith("a".repeat(200))).toBe(true);
  });
});
