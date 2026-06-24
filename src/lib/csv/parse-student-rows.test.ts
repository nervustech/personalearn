import { describe, expect, it } from "vitest";
import { parseStudentRows } from "./parse-student-rows";

describe("parseStudentRows", () => {
  it("parses valid student rows", () => {
    const result = parseStudentRows([
      {
        full_name: "Jane Doe",
        admission_number: "ADM001",
        gender: "Female",
      },
      {
        full_name: "John Kamau",
        admission_number: "ADM002",
        gender: "Male",
      },
    ]);

    expect(result).toEqual({
      ok: true,
      students: [
        {
          full_name: "Jane Doe",
          admission_number: "ADM001",
          gender: "Female",
        },
        {
          full_name: "John Kamau",
          admission_number: "ADM002",
          gender: "Male",
        },
      ],
    });
  });

  it("trims whitespace and ignores invalid gender values", () => {
    const result = parseStudentRows([
      {
        full_name: "  Jane Doe  ",
        admission_number: " ADM001 ",
        gender: "unknown",
      },
    ]);

    expect(result).toEqual({
      ok: true,
      students: [
        {
          full_name: "Jane Doe",
          admission_number: "ADM001",
          gender: undefined,
        },
      ],
    });
  });

  it("returns row-specific errors for invalid names", () => {
    const result = parseStudentRows([
      {
        full_name: "J",
        admission_number: "ADM001",
        gender: "Female",
      },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatch(/^Row 2:/);
    }
  });
});
