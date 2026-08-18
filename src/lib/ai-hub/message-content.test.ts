import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { truncateMessagesBefore } from "@/lib/ai-hub/message-content";

function userMessage(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

describe("truncateMessagesBefore", () => {
  it("removes the target message and everything after it", () => {
    const messages = [
      userMessage("1", "first"),
      userMessage("2", "second"),
      userMessage("3", "third"),
    ];

    expect(truncateMessagesBefore(messages, "2")).toEqual([userMessage("1", "first")]);
  });

  it("returns the original list when the message is missing", () => {
    const messages = [userMessage("1", "first")];

    expect(truncateMessagesBefore(messages, "missing")).toEqual(messages);
  });
});
