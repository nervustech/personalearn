import { describe, expect, it } from "vitest";
import { getPostLoginPath } from "./post-login-path";

describe("getPostLoginPath", () => {
  it("returns onboarding when the teacher has no classes", () => {
    expect(getPostLoginPath(false)).toBe("/onboarding");
  });

  it("returns dashboard when the teacher has classes", () => {
    expect(getPostLoginPath(true)).toBe("/dashboard");
  });
});
