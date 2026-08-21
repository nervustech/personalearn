import { describe, expect, it } from "vitest";
import { getLandingCtas, getPostLoginPath } from "./post-login-path";

describe("getPostLoginPath", () => {
  it("returns onboarding when the teacher has no classes", () => {
    expect(getPostLoginPath(false)).toBe("/onboarding");
  });

  it("returns dashboard when the teacher has classes", () => {
    expect(getPostLoginPath(true)).toBe("/dashboard");
  });
});

describe("getLandingCtas", () => {
  it("keeps public login and dashboard links when signed out", () => {
    expect(getLandingCtas(false, false)).toEqual({
      signedIn: false,
      headerHref: "/login",
      headerLabel: "Sign in",
      primaryHref: "/login",
      secondaryHref: "/dashboard",
      footerHref: "/login",
    });
  });

  it("sends signed-in teachers with no class to onboarding, including Open dashboard", () => {
    expect(getLandingCtas(true, false)).toEqual({
      signedIn: true,
      headerHref: "/onboarding",
      headerLabel: "Create class",
      primaryHref: "/onboarding",
      secondaryHref: "/onboarding",
      footerHref: "/onboarding",
    });
  });

  it("sends signed-in teachers with classes to dashboard", () => {
    expect(getLandingCtas(true, true)).toEqual({
      signedIn: true,
      headerHref: "/dashboard",
      headerLabel: "Open dashboard",
      primaryHref: "/dashboard",
      secondaryHref: "/dashboard",
      footerHref: "/dashboard",
    });
  });
});
