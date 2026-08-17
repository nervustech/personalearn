import { describe, expect, it } from "vitest";
import {
  admissionDigits,
  admissionLookupKeys,
  compactAdmissionNumber,
  findUniqueDigitPrefixStudent,
  normalizeAdmissionNumber,
} from "@/lib/evaluation/normalize-admission";

describe("normalizeAdmissionNumber", () => {
  it("trims, collapses spaces, and uppercases", () => {
    expect(normalizeAdmissionNumber("  adm 1196 ")).toBe("ADM 1196");
  });

  it("returns null for empty values", () => {
    expect(normalizeAdmissionNumber(null)).toBeNull();
    expect(normalizeAdmissionNumber("   ")).toBeNull();
  });
});

describe("compactAdmissionNumber", () => {
  it("drops punctuation and spaces", () => {
    expect(compactAdmissionNumber("ADM-1196")).toBe("ADM1196");
    expect(compactAdmissionNumber("No. 1196")).toBe("NO1196");
  });
});

describe("admissionLookupKeys", () => {
  it("includes digit-core so ADM prefixes match roster numbers", () => {
    expect(admissionDigits("ADM-1196")).toBe("1196");
    expect(admissionLookupKeys("ADM-1196")).toEqual([
      "ADM-1196",
      "ADM1196",
      "1196",
    ]);
  });
});

describe("findUniqueDigitPrefixStudent", () => {
  const roster = [
    { id: "sally", admission_number: "8149" },
    { id: "ada", admission_number: "1196" },
  ];

  it("recovers a glued page suffix onto a unique roster number", () => {
    expect(findUniqueDigitPrefixStudent("814910", roster)?.id).toBe("sally");
  });

  it("does not match an unknown number that is not a roster prefix", () => {
    expect(findUniqueDigitPrefixStudent("8888", roster)).toBeNull();
  });

  it("keeps the longest unique prefix when several roster numbers match", () => {
    const overlapping = [
      { id: "short", admission_number: "814" },
      { id: "sally", admission_number: "8149" },
    ];
    expect(findUniqueDigitPrefixStudent("814910", overlapping)?.id).toBe(
      "sally"
    );
  });
});
