import { afterEach, describe, expect, it, vi } from "vitest";
import {
  evalPromptCacheKey,
  getEvalVisionModelId,
  getEvalVisionProvider,
  GROK_EVAL_MODEL,
} from "@/lib/evaluation/eval-provider";
import { GEMINI_FLASH_LITE_MODEL } from "@/lib/ai/vision-model";

describe("eval-provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers explicit EVAL_VISION_PROVIDER=xai", () => {
    vi.stubEnv("EVAL_VISION_PROVIDER", "xai");
    vi.stubEnv("XAI_API_KEY", "");
    expect(getEvalVisionProvider()).toBe("xai");
    expect(getEvalVisionModelId()).toBe(GROK_EVAL_MODEL);
  });

  it("uses gemini when EVAL_VISION_PROVIDER=gemini", () => {
    vi.stubEnv("EVAL_VISION_PROVIDER", "gemini");
    vi.stubEnv("XAI_API_KEY", "xai-key");
    expect(getEvalVisionProvider()).toBe("gemini");
    expect(getEvalVisionModelId()).toBe(GEMINI_FLASH_LITE_MODEL);
  });

  it("defaults to xai when XAI_API_KEY is set and provider unset", () => {
    vi.stubEnv("EVAL_VISION_PROVIDER", "");
    vi.stubEnv("XAI_API_KEY", "xai-key");
    expect(getEvalVisionProvider()).toBe("xai");
  });

  it("defaults to gemini when no provider and no XAI key", () => {
    vi.stubEnv("EVAL_VISION_PROVIDER", "");
    vi.stubEnv("XAI_API_KEY", "");
    expect(getEvalVisionProvider()).toBe("gemini");
  });

  it("honors EVAL_VISION_MODEL override", () => {
    vi.stubEnv("EVAL_VISION_PROVIDER", "xai");
    vi.stubEnv("EVAL_VISION_MODEL", "grok-custom");
    expect(getEvalVisionModelId()).toBe("grok-custom");
  });

  it("builds stable prompt cache keys per batch phase", () => {
    expect(
      evalPromptCacheKey({ batchId: "batch-1", phase: "index" })
    ).toBe("pl-eval:batch-1:index");
    expect(
      evalPromptCacheKey({ batchId: "batch-1", phase: "evaluate" })
    ).toBe("pl-eval:batch-1:evaluate");
  });
});
