import { describe, expect, it } from "vitest";
import { identityPanelState } from "@/lib/evaluation/identity-panel-state";

describe("identityPanelState", () => {
  it("hides the panel for uploaded pages waiting to grade", () => {
    const state = identityPanelState([
      { status: "uploaded", alreadyEvaluated: false },
    ]);
    expect(state.needsTeacherAttention).toBe(false);
    expect(state.needsGradingKick).toBe(false);
    expect(state.panelVisible).toBe(false);
  });

  it("hides the panel when grading is already ready", () => {
    const state = identityPanelState([
      { status: "ready", alreadyEvaluated: false },
    ]);
    expect(state.needsGradingKick).toBe(false);
    expect(state.panelVisible).toBe(false);
  });

  it("hides the panel while a matched script is evaluating", () => {
    const state = identityPanelState([
      { status: "evaluating", alreadyEvaluated: false },
    ]);
    expect(state.panelVisible).toBe(false);
  });

  it("shows identity exceptions that need a teacher", () => {
    const state = identityPanelState([
      { status: "identity_amber", alreadyEvaluated: false },
    ]);
    expect(state.needsTeacherAttention).toBe(true);
    expect(state.amberCount).toBe(1);
    expect(state.panelVisible).toBe(true);
  });

  it("offers a grading retry only when identity is cleared and nothing is in flight", () => {
    expect(
      identityPanelState([{ status: "identity_cleared" }]).needsGradingKick
    ).toBe(true);
    expect(
      identityPanelState([
        { status: "identity_cleared" },
        { status: "evaluating" },
      ]).needsGradingKick
    ).toBe(false);
  });
});
