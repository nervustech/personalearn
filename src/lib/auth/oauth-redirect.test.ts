import { describe, expect, it } from "vitest";
import { buildOAuthCallbackUrl } from "./oauth-redirect";

describe("buildOAuthCallbackUrl", () => {
  it("builds callback URL with encoded next path", () => {
    expect(
      buildOAuthCallbackUrl(
        "/dashboard",
        "https://personalearn-70oq4c09d-raphael-malims-projects.vercel.app"
      )
    ).toBe(
      "https://personalearn-70oq4c09d-raphael-malims-projects.vercel.app/auth/callback?next=%2Fdashboard"
    );
  });

  it("strips trailing slash from origin", () => {
    expect(buildOAuthCallbackUrl("/onboarding", "http://localhost:3000/")).toBe(
      "http://localhost:3000/auth/callback?next=%2Fonboarding"
    );
  });
});
