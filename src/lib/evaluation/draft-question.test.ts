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
      bounding_box: null,
    });
  });

  it("parses bounding_box regions when present", () => {
    expect(
      parseDraftQuestionJson(
        JSON.stringify({
          awarded: 1,
          max: 2,
          feedback: "ok",
          student_answer: "x",
          expected_answer: "y",
          bounding_box: [{ page: 0, ymin: 100, xmin: 50, ymax: 400, xmax: 900 }],
        })
      )
    ).toEqual({
      awarded: 1,
      max: 2,
      feedback: "ok",
      student_answer: "x",
      expected_answer: "y",
      bounding_box: [{ page: 0, ymin: 100, xmin: 50, ymax: 400, xmax: 900 }],
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
      bounding_box: null,
    });
  });

  it("returns nulls for malformed JSON", () => {
    expect(parseDraftQuestionJson("not json")).toEqual({
      awarded: null,
      max: null,
      feedback: null,
      student_answer: null,
      expected_answer: null,
      bounding_box: null,
    });
    expect(parseDraftQuestionJson("{")).toEqual({
      awarded: null,
      max: null,
      feedback: null,
      student_answer: null,
      expected_answer: null,
      bounding_box: null,
    });
  });
});
