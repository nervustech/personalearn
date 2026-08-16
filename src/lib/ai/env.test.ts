import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CHAT_PROVIDER,
  DEFAULT_VOYAGE_MODEL,
  assertChatConfigured,
  getChatProvider,
  getVoyageEmbeddingModel,
  requireChatApiKey,
  requireVoyageApiKey,
} from "./env";

const ENV_KEYS = [
  "VOYAGE_API_KEY",
  "VOYAGE_EMBEDDING_MODEL",
  "DEEPSEEK_API_KEY",
  "XAI_API_KEY",
  "CHAT_PROVIDER",
] as const;

function clearAiEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe("ai env", () => {
  afterEach(() => {
    clearAiEnv();
  });

  it("defaults voyage model and chat provider", () => {
    expect(getVoyageEmbeddingModel()).toBe(DEFAULT_VOYAGE_MODEL);
    expect(getChatProvider()).toBe(DEFAULT_CHAT_PROVIDER);
  });

  it("reads VOYAGE_EMBEDDING_MODEL and CHAT_PROVIDER", () => {
    process.env.VOYAGE_EMBEDDING_MODEL = "voyage-3.5";
    process.env.CHAT_PROVIDER = "xai";
    expect(getVoyageEmbeddingModel()).toBe("voyage-3.5");
    expect(getChatProvider()).toBe("xai");
  });

  it("treats grok as xai provider", () => {
    process.env.CHAT_PROVIDER = "grok";
    expect(getChatProvider()).toBe("xai");
  });

  it("throws when voyage key missing", () => {
    expect(() => requireVoyageApiKey()).toThrow(/VOYAGE_API_KEY/);
  });

  it("throws when deepseek key missing", () => {
    expect(() => requireChatApiKey("deepseek")).toThrow(/DEEPSEEK_API_KEY/);
  });

  it("throws when xai key missing", () => {
    expect(() => requireChatApiKey("xai")).toThrow(/XAI_API_KEY/);
  });

  it("assertChatConfigured fails without DEEPSEEK_API_KEY", () => {
    expect(() => assertChatConfigured()).toThrow(/DEEPSEEK_API_KEY/);
  });
});
