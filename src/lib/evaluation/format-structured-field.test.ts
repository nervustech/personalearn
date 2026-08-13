import { describe, expect, it } from "vitest";
import { formatStructuredField } from "./format-structured-field";

describe("formatStructuredField", () => {
  it("prefers expression over JSON dump", () => {
    expect(
      formatStructuredField({ expression: "7×8=56" }, null)
    ).toBe("7×8=56");
  });

  it("formats steps arrays readably", () => {
    expect(
      formatStructuredField(
        { steps: ["7×8", "56"], answer: "56" },
        null
      )
    ).toBe("1. 7×8\n2. 56\nAnswer: 56");
  });

  it("humanizes legacy JSON strings", () => {
    expect(
      formatStructuredField(null, '{"expression":"7×8=56"}')
    ).toBe("7×8=56");
  });

  it("falls back to legacy plain text", () => {
    expect(formatStructuredField(null, "  42  ")).toBe("42");
  });
});
