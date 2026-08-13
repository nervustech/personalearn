import { describe, expect, it } from "vitest";
import { deriveTeacherBatchStage } from "@/lib/evaluation/batch-stage";

describe("deriveTeacherBatchStage", () => {
  it("shows Ready when pages exist but scripts have not been created yet", () => {
    const stage = deriveTeacherBatchStage([], "draft", 4);
    expect(stage.label).toBe("Ready");
    expect(stage.cta).toBe("Continue evaluation");
    expect(stage.summary).toContain("4 pages uploaded");
  });

  it("shows Upload only when there are no pages and no scripts", () => {
    const stage = deriveTeacherBatchStage([], "draft", 0);
    expect(stage.label).toBe("Upload");
    expect(stage.cta).toBe("Upload scans");
    expect(stage.summary).toBe("No scans uploaded yet");
  });
});
