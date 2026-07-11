import { describe, expect, it } from "vitest";
import {
  parseDraftQuestionJson,
  questionEvaluationStatusForScheme,
} from "./draft-question";

describe("questionEvaluationStatusForScheme", () => {
  it("returns ai_draft when scheme text is present", () => {
    expect(questionEvaluationStatusForScheme("Q1: 2 marks")).toBe("ai_draft");
  });

  it("returns ai_estimate when scheme is missing or empty", () => {
    expect(questionEvaluationStatusForScheme(null)).toBe("ai_estimate");
    expect(questionEvaluationStatusForScheme(undefined)).toBe("ai_estimate");
    expect(questionEvaluationStatusForScheme("")).toBe("ai_estimate");
    expect(questionEvaluationStatusForScheme("   ")).toBe("ai_estimate");
  });
});

describe("parseDraftQuestionJson", () => {
  it("parses awarded, max, and feedback", () => {
    expect(
      parseDraftQuestionJson(
        '{"awarded": 3, "max": 5, "feedback": "Good method marks."}'
      )
    ).toEqual({
      awarded: 3,
      max: 5,
      feedback: "Good method marks.",
    });
  });

  it("tolerates markdown fences and string numbers", () => {
    expect(
      parseDraftQuestionJson(
        '```json\n{"awarded": "2.5", "max": "4", "feedback": "Partial"}\n```'
      )
    ).toEqual({
      awarded: 2.5,
      max: 4,
      feedback: "Partial",
    });
  });

  it("returns nulls for malformed JSON", () => {
    expect(parseDraftQuestionJson("not json")).toEqual({
      awarded: null,
      max: null,
      feedback: null,
    });
    expect(parseDraftQuestionJson("{")).toEqual({
      awarded: null,
      max: null,
      feedback: null,
    });
  });
});
