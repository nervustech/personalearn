import { describe, expect, it, vi } from "vitest";
import { generateAiConversationTitle } from "./generate-conversation-title";

vi.mock("@/lib/ai/llm", () => ({
  getChatModel: vi.fn(() => ({ modelId: "mock" })),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(async () => ({ text: "Week 3 fractions planning" })),
}));

describe("generateAiConversationTitle", () => {
  it("returns a trimmed title from the model", async () => {
    const title = await generateAiConversationTitle(
      "Can you help me plan Week 3 fractions?",
      "Here is a draft outline."
    );

    expect(title).toBe("Week 3 fractions planning");
  });

  it("falls back to the first message when generation fails", async () => {
    const { generateText } = await import("ai");
    vi.mocked(generateText).mockRejectedValueOnce(new Error("offline"));

    const title = await generateAiConversationTitle("Plan my Week 3 lesson");

    expect(title).toBe("Plan my Week 3 lesson");
  });
});
