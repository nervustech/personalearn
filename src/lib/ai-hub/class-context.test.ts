import { describe, expect, it } from "vitest";
import { buildClassAssistantSystemPrompt } from "./class-context";

describe("buildClassAssistantSystemPrompt", () => {
  it("includes class details and tells the model not to ask for them", () => {
    const prompt = buildClassAssistantSystemPrompt({
      id: "class-1",
      name: "7 East",
      subject: "Mathematics",
      grade_level: 7,
      term: 2,
      section: "East",
      academic_year: "2026",
    });

    expect(prompt).toContain("7 East");
    expect(prompt).toContain("Mathematics");
    expect(prompt).toContain("Grade: 7");
    expect(prompt).toContain("Never ask which class");
    expect(prompt).toContain("search_class_resources");
    expect(prompt).toContain("Never save or write");
  });
});
