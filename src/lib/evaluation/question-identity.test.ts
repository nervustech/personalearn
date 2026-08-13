import { describe, expect, it } from "vitest";
import {
  buildCanonicalQuestionKey,
  canonicalizeEvaluateQuestions,
  compareQuestionsForReview,
  formatQuestionDisplayLabel,
  normalizeSectionLabel,
} from "@/lib/evaluation/question-identity";

describe("question-identity", () => {
  it("normalizes section headings", () => {
    expect(normalizeSectionLabel("Section A")).toBe("A");
    expect(normalizeSectionLabel("PART B")).toBe("B");
    expect(normalizeSectionLabel("a")).toBe("A");
  });

  it("builds section-qualified canonical keys", () => {
    expect(
      buildCanonicalQuestionKey({ section: "Section A", questionNumber: "1" })
    ).toBe("A:1");
    expect(
      buildCanonicalQuestionKey({ section: null, questionNumber: "2a" })
    ).toBe("2a");
  });

  it("formats display labels", () => {
    expect(
      formatQuestionDisplayLabel({ section: "A", questionNumber: "1" })
    ).toBe("A.1");
    expect(
      formatQuestionDisplayLabel({ section: null, questionNumber: "3" })
    ).toBe("3");
  });

  it("orders review questions by page then vertical then section", () => {
    const ordered = [
      {
        question_number: "1",
        section: "B",
        page_number: 1,
        vertical_bounds: { top_percent: 0.5, bottom_percent: 0.6 },
      },
      {
        question_number: "1",
        section: "A",
        page_number: 1,
        vertical_bounds: { top_percent: 0.1, bottom_percent: 0.2 },
      },
      {
        question_number: "1",
        section: "C",
        page_number: 2,
        vertical_bounds: { top_percent: 0.1, bottom_percent: 0.2 },
      },
    ].sort(compareQuestionsForReview);
    expect(ordered.map((q) => `${q.section}:${q.question_number}`)).toEqual([
      "A:1",
      "B:1",
      "C:1",
    ]);
  });

  it("assigns synthetic blocks when bare numbering restarts", () => {
    const result = canonicalizeEvaluateQuestions([
      {
        question_number: "1",
        status: "CORRECT",
        page_number: 1,
        vertical_bounds: { top_percent: 0.1, bottom_percent: 0.2 },
      },
      {
        question_number: "2",
        status: "CORRECT",
        page_number: 1,
        vertical_bounds: { top_percent: 0.2, bottom_percent: 0.3 },
      },
      {
        question_number: "1",
        status: "ATTENTION_NEEDED",
        page_number: 1,
        vertical_bounds: { top_percent: 0.5, bottom_percent: 0.6 },
      },
      {
        question_number: "2",
        status: "CORRECT",
        page_number: 1,
        vertical_bounds: { top_percent: 0.6, bottom_percent: 0.7 },
      },
    ]);

    expect(result.map((q) => q.canonical_key)).toEqual([
      "BLK1:1",
      "BLK1:2",
      "BLK2:1",
      "BLK2:2",
    ]);
    expect(result.map((q) => q.section)).toEqual([
      "BLK1",
      "BLK1",
      "BLK2",
      "BLK2",
    ]);
  });

  it("keeps explicit sections and does not invent blocks", () => {
    const result = canonicalizeEvaluateQuestions([
      {
        question_number: "1",
        section: "A",
        status: "CORRECT",
        page_number: 1,
        vertical_bounds: { top_percent: 0.1, bottom_percent: 0.2 },
      },
      {
        question_number: "1",
        section: "B",
        status: "CORRECT",
        page_number: 1,
        vertical_bounds: { top_percent: 0.5, bottom_percent: 0.6 },
      },
    ]);
    expect(result.map((q) => q.canonical_key)).toEqual(["A:1", "B:1"]);
  });
});
