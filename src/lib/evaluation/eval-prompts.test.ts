import { describe, expect, it } from "vitest";
import {
  buildEvaluatePrompt,
  buildEvaluateSystemPrompt,
  buildEvaluateUserPrompt,
} from "@/lib/evaluation/evaluate-schema";
import {
  buildIndexPrompt,
  buildIndexUserPrompt,
} from "@/lib/evaluation/index-schema";

describe("eval prompts (cache-friendly split)", () => {
  it("keeps index system prompt stable and user prompt short", () => {
    const system = buildIndexPrompt();
    expect(system).toContain("admission_number");
    expect(system).toMatch(/clearly readable/i);
    expect(system).not.toMatch(/Be conservative/i);
    expect(buildIndexUserPrompt()).toMatch(/attached page/i);
  });

  it("puts marking scheme only in the evaluate system prompt", () => {
    const scheme = "Q1: award 2 marks for correct formula";
    const system = buildEvaluateSystemPrompt({ markingScheme: scheme });
    const user = buildEvaluateUserPrompt();

    expect(system).toContain(scheme);
    expect(system).toMatch(/SECTIONS/i);
    expect(user).not.toContain(scheme);
    expect(user).toMatch(/Grade the attached/i);
  });

  it("asks index to prefer section-qualified question labels", () => {
    expect(buildIndexPrompt()).toMatch(/section-qualified/i);
  });

  it("keeps question focus out of the shared system prompt", () => {
    const system = buildEvaluateSystemPrompt({ markingScheme: "scheme" });
    const focused = buildEvaluateUserPrompt({ questionFocus: "7c" });

    expect(system).not.toContain("7c");
    expect(focused).toContain("7c");
  });

  it("combines system + focus for Gemini single-text prompt", () => {
    const combined = buildEvaluatePrompt({
      markingScheme: "MS",
      questionFocus: "7c",
    });
    expect(combined).toContain("MS");
    expect(combined).toContain("7c");
  });
});
