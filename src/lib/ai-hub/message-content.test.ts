import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import {
  getAssistantDisplayBlocks,
  getAssistantPersistContent,
  getMessageReasoning,
  getVisibleDrafts,
  stripDatabaseIdsFromTeacherText,
  toUIMessageFromRow,
  truncateMessagesBefore,
} from "@/lib/ai-hub/message-content";

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

describe("getVisibleDrafts", () => {
  it("extracts stored markdown from generate and update draft tools", () => {
    const message: UIMessage = {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "text", text: "Short blueprint" },
        {
          type: "tool-generate_learning_resource",
          toolCallId: "call-1",
          state: "output-available",
          input: {},
          output: {
            draftId: "draft-1",
            title: "Fractions exam",
            resourceType: "examination",
            content: "# Question 1\n\nSolve 1/2 + 1/4.",
          },
        } as UIMessage["parts"][number],
      ],
    };

    expect(getVisibleDrafts(message)).toEqual([
      {
        title: "Fractions exam",
        resourceType: "examination",
        content: "# Question 1\n\nSolve 1/2 + 1/4.",
      },
    ]);
  });

  it("ignores search tools and drafts without content", () => {
    const message: UIMessage = {
      id: "a2",
      role: "assistant",
      parts: [
        {
          type: "tool-search_class_resources",
          toolCallId: "call-2",
          state: "output-available",
          input: {},
          output: { answer: "Week 3", sources: [] },
        } as UIMessage["parts"][number],
        {
          type: "tool-generate_learning_resource",
          toolCallId: "call-3",
          state: "output-available",
          input: {},
          output: { draftId: "draft-2", title: "Empty" },
        } as UIMessage["parts"][number],
      ],
    };

    expect(getVisibleDrafts(message)).toEqual([]);
  });
});

describe("getMessageReasoning", () => {
  it("extracts reasoning text from reasoning UI parts", () => {
    const message: UIMessage = {
      id: "a-reason",
      role: "assistant",
      parts: [
        { type: "reasoning", text: "Let's first analyze the syllabus requirement." } as UIMessage["parts"][number],
        { type: "reasoning", text: " Then construct the lesson plan." } as UIMessage["parts"][number],
        { type: "text", text: "Here is the lesson plan." },
      ],
    };

    expect(getMessageReasoning(message)).toBe(
      "Let's first analyze the syllabus requirement. Then construct the lesson plan."
    );
  });

  it("returns empty string when message has no reasoning parts", () => {
    const message: UIMessage = {
      id: "a-no-reason",
      role: "assistant",
      parts: [{ type: "text", text: "Direct response" }],
    };

    expect(getMessageReasoning(message)).toBe("");
  });
});

describe("getAssistantPersistContent", () => {
  it("persists stored draft markdown even when the model only summarised", () => {
    const message: UIMessage = {
      id: "a3",
      role: "assistant",
      parts: [
        { type: "text", text: "Here is a short outline. Save it?" },
        {
          type: "tool-generate_learning_resource",
          toolCallId: "call-4",
          state: "output-available",
          input: {},
          output: {
            title: "Fractions quiz",
            resourceType: "quiz",
            content: "# Q1\n\nAdd 1/2 + 1/4.",
          },
        } as UIMessage["parts"][number],
      ],
    };

    const persisted = getAssistantPersistContent(message);
    expect(persisted.indexOf("Save it?")).toBeLessThan(
      persisted.indexOf("# Q1")
    );
    expect(persisted).toContain("# Q1\n\nAdd 1/2 + 1/4.");
    expect(persisted).toContain("Save it?");
  });

  it("keeps reasoning, draft, then save prompt in part order", () => {
    const message: UIMessage = {
      id: "a4",
      role: "assistant",
      parts: [
        { type: "text", text: "Let me generate it now." },
        {
          type: "tool-generate_learning_resource",
          toolCallId: "call-5",
          state: "output-available",
          input: {},
          output: {
            title: "Fractions quiz",
            resourceType: "quiz",
            content: "# Q1\n\nAdd 1/2 + 1/4.",
          },
        } as UIMessage["parts"][number],
        {
          type: "text",
          text: "Would you like me to save it, or revise anything first?",
        },
      ],
    };

    expect(getAssistantDisplayBlocks(message).map((block) => block.type)).toEqual(
      ["text", "draft", "text"]
    );

    const persisted = getAssistantPersistContent(message);
    expect(persisted.indexOf("Let me generate")).toBeLessThan(
      persisted.indexOf("# Q1")
    );
    expect(persisted.indexOf("# Q1")).toBeLessThan(
      persisted.indexOf("Would you like me to save")
    );
  });

  it("strips database ids from teacher-facing text", () => {
    expect(
      stripDatabaseIdsFromTeacherText(
        "Saved Assignment. resourceId: 11111111-1111-4111-8111-111111111111"
      )
    ).toBe("Saved Assignment.");
  });
});

describe("toUIMessageFromRow", () => {
  it("converts plain assistant messages without drafts", () => {
    const message = toUIMessageFromRow({
      id: "m1",
      role: "assistant",
      content: "Hello teacher",
    });

    expect(message).toEqual({
      id: "m1",
      role: "assistant",
      parts: [{ type: "text", text: "Hello teacher" }],
    });
  });

  it("reconstructs drafts from tool_calls as valid tool parts", async () => {
    const { convertToModelMessages } = await import("ai");
    const row = {
      id: "m2",
      role: "assistant" as const,
      content:
        "Here is the plan:\n\n## Fractions Quiz\n\n# Question 1\n\nSolve 1/2 + 1/4.\n\nShould I save this?",
      tool_calls: {
        drafts: [
          {
            title: "Fractions Quiz",
            resourceType: "quiz",
            content: "# Question 1\n\nSolve 1/2 + 1/4.",
          },
        ],
      },
    };

    const uiMessage = toUIMessageFromRow(row);
    expect(uiMessage.parts).toHaveLength(3);
    expect(uiMessage.parts[0]).toEqual({ type: "text", text: "Here is the plan:" });
    expect(uiMessage.parts[1].type).toBe("tool-generate_learning_resource");
    expect(uiMessage.parts[2]).toEqual({ type: "text", text: "Should I save this?" });

    const visibleDrafts = getVisibleDrafts(uiMessage);
    expect(visibleDrafts).toEqual([
      {
        title: "Fractions Quiz",
        resourceType: "quiz",
        content: "# Question 1\n\nSolve 1/2 + 1/4.",
      },
    ]);

    // Verify it converts to valid model messages without empty text parts
    const modelMessages = await convertToModelMessages([
      userMessage("u1", "Create a quiz"),
      uiMessage,
      userMessage("u2", "Save it"),
    ]);

    expect(modelMessages).toHaveLength(4);
    const assistantMsg = modelMessages[1];
    expect(assistantMsg.role).toBe("assistant");
    if (Array.isArray(assistantMsg.content)) {
      for (const part of assistantMsg.content) {
        if (part.type === "text") {
          expect(part.text.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });
});

