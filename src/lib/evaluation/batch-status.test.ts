import { describe, expect, it } from "vitest";
import { deriveBatchStatus } from "@/lib/evaluation/batch-status";

describe("deriveBatchStatus", () => {
  it("returns draft when no scripts", () => {
    expect(deriveBatchStatus([])).toBe("draft");
  });

  it("returns processing when any script is in flight", () => {
    expect(
      deriveBatchStatus(["evaluating", "signed_off"])
    ).toBe("processing");
    expect(deriveBatchStatus(["uploaded", "signed_off"])).toBe("processing");
    expect(deriveBatchStatus(["indexing"])).toBe("processing");
  });

  it("returns in_review when ready scripts exist and none in flight", () => {
    expect(
      deriveBatchStatus(["identity_amber", "ready", "evaluating"])
    ).toBe("processing");
    expect(deriveBatchStatus(["identity_amber", "ready"])).toBe("in_review");
  });

  it("returns signed_off only when every script is signed off", () => {
    expect(deriveBatchStatus(["signed_off", "signed_off"])).toBe("signed_off");
  });

  it("keeps the session open when signed_off is mixed with identity exceptions", () => {
    expect(deriveBatchStatus(["signed_off", "identity_amber"])).toBe(
      "in_review"
    );
    expect(deriveBatchStatus(["signed_off", "unmatched"])).toBe("in_review");
    expect(deriveBatchStatus(["signed_off", "failed"])).toBe("in_review");
  });

  it("returns draft when only identity setup states remain", () => {
    expect(deriveBatchStatus(["identity_amber", "unmatched"])).toBe("draft");
  });
});
