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
  it("parses awarded, max, feedback, and analysis fields", () => {
    expect(
      parseDraftQuestionJson(
        JSON.stringify({
          awarded: 3,
          max: 5,
          feedback: "Good method marks.",
          student_answer: "Student wrote 3/4",
          expected_answer: "3/4 in simplest form",
        })
      )
    ).toEqual({
      awarded: 3,
      max: 5,
      feedback: "Good method marks.",
      student_answer: "Student wrote 3/4",
      expected_answer: "3/4 in simplest form",
    });
  });

  it("tolerates markdown fences, string numbers, and missing analysis keys", () => {
    expect(
      parseDraftQuestionJson(
        '```json\n{"awarded": "2.5", "max": "4", "feedback": "Partial"}\n```'
      )
    ).toEqual({
      awarded: 2.5,
      max: 4,
      feedback: "Partial",
      student_answer: null,
      expected_answer: null,
    });
  });

  it("returns nulls for malformed JSON", () => {
    expect(parseDraftQuestionJson("not json")).toEqual({
      awarded: null,
      max: null,
      feedback: null,
      student_answer: null,
      expected_answer: null,
    });
    expect(parseDraftQuestionJson("{")).toEqual({
      awarded: null,
      max: null,
      feedback: null,
      student_answer: null,
      expected_answer: null,
    });
  });
});
