import { describe, expect, it } from "vitest";
import { generateConversationTitle } from "./conversation-title";

describe("generateConversationTitle", () => {
  it("uses the first message when it is short", () => {
    expect(generateConversationTitle("  What does Week 3 cover?  ")).toBe(
      "What does Week 3 cover?"
    );
  });

  it("falls back when the message is empty", () => {
    expect(generateConversationTitle("   ")).toBe("New conversation");
  });

  it("truncates long titles with an ellipsis", () => {
    const longMessage = "a".repeat(80);
    const title = generateConversationTitle(longMessage);

    expect(title.length).toBe(60);
    expect(title.endsWith("…")).toBe(true);
  });
});
