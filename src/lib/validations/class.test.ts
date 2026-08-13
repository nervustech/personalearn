import { describe, expect, it } from "vitest";
import { classSchema, studentSchema } from "./class";

describe("classSchema", () => {
  const validClass = {
    name: "Grade 5 Mathematics",
    grade_level: 5,
    subject: "Mathematics",
    term: 2,
    academic_year: "2026",
    section: "A",
  };

  it("accepts valid class data", () => {
    expect(classSchema.safeParse(validClass).success).toBe(true);
  });

  it("rejects grade levels below 1", () => {
    expect(classSchema.safeParse({ ...validClass, grade_level: 0 }).success).toBe(
      false
    );
  });

  it("rejects grade levels above 9", () => {
    expect(classSchema.safeParse({ ...validClass, grade_level: 10 }).success).toBe(
      false
    );
  });

  it("rejects invalid terms", () => {
    expect(classSchema.safeParse({ ...validClass, term: 4 }).success).toBe(false);
  });
});

describe("studentSchema", () => {
  it("accepts valid student data", () => {
    const result = studentSchema.safeParse({
      full_name: "Jane Doe",
      admission_number: "ADM001",
      gender: "Female",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty student names", () => {
    const result = studentSchema.safeParse({
      full_name: "J",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid gender values", () => {
    const result = studentSchema.safeParse({
      full_name: "Jane Doe",
      gender: "Other",
    });
    expect(result.success).toBe(false);
  });
});
