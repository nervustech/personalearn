import { describe, expect, it } from "vitest";
import {
  assessmentTypeForResource,
  isGradableResourceType,
} from "./gradable";

describe("isGradableResourceType", () => {
  it("returns true for assignment, quiz, examination", () => {
    expect(isGradableResourceType("assignment")).toBe(true);
    expect(isGradableResourceType("quiz")).toBe(true);
    expect(isGradableResourceType("examination")).toBe(true);
  });

  it("returns false for non-gradable library types", () => {
    expect(isGradableResourceType("lesson_notes")).toBe(false);
    expect(isGradableResourceType("scheme_of_work")).toBe(false);
    expect(isGradableResourceType("marking_scheme")).toBe(false);
    expect(isGradableResourceType("other")).toBe(false);
  });
});

describe("assessmentTypeForResource", () => {
  it("maps resource types to assessment CHECK values", () => {
    expect(assessmentTypeForResource("assignment")).toBe("written");
    expect(assessmentTypeForResource("quiz")).toBe("formative");
    expect(assessmentTypeForResource("examination")).toBe("summative");
  });
});
