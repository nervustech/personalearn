import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "./auth";

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "teacher@school.ke",
      password: "secret1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "secret1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects passwords shorter than 6 characters", () => {
    const result = loginSchema.safeParse({
      email: "teacher@school.ke",
      password: "12345",
    });
    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("requires a full name", () => {
    const result = signupSchema.safeParse({
      email: "teacher@school.ke",
      password: "secret1",
      fullName: "J",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid signup data", () => {
    const result = signupSchema.safeParse({
      email: "teacher@school.ke",
      password: "secret1",
      fullName: "Jane Wanjiku",
    });
    expect(result.success).toBe(true);
  });
});
