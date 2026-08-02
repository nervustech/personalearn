import { describe, expect, it } from "vitest";
import { parseIndexResult } from "@/lib/evaluation/index-schema";

describe("parseIndexResult", () => {
  it("parses valid index payload", () => {
    const result = parseIndexResult({
      admission_number: "A001",
      admission_confidence: 0.9,
      page_number: 1,
      total_pages: 2,
      questions_found: ["1", "2"],
    });
    expect(result.admission_number).toBe("A001");
    expect(result.questions_found).toEqual(["1", "2"]);
  });
});
