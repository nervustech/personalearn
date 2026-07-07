import { describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import {
  appendConversationMessages,
  findNewPersistableMessages,
} from "./conversations";

describe("findNewPersistableMessages", () => {
  it("returns only new user and assistant messages with text", () => {
    const messages: UIMessage[] = [
      {
        id: "existing-user",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      },
      {
        id: "new-user",
        role: "user",
        parts: [{ type: "text", text: "Follow up" }],
      },
      {
        id: "empty-assistant",
        role: "assistant",
        parts: [{ type: "text", text: "   " }],
      },
    ];

    const result = findNewPersistableMessages(
      messages,
      new Set(["existing-user"])
    );

    expect(result.map((message) => message.id)).toEqual(["new-user"]);
  });
});

describe("appendConversationMessages", () => {
  it("inserts messages in request order and touches the conversation", async () => {
    const insertedRows: Array<{ role: string; content: string }> = [];
    const touch = vi.fn().mockResolvedValue({ error: null });

    const supabase = {
      from: (table: string) => {
        if (table === "conversation_messages") {
          return {
            insert: (rows: Array<{ role: string; content: string }>) => {
              insertedRows.push(...rows);
              return {
                select: () =>
                  Promise.resolve({
                    data: rows.map((row, index) => ({
                      id: `msg-${index}`,
                      conversation_id: "conv-1",
                      role: row.role,
                      content: row.content,
                      tool_calls: null,
                      created_at: `2026-07-06T10:00:0${index}Z`,
                    })),
                    error: null,
                  }),
              };
            },
          };
        }

        if (table === "conversations") {
          return {
            update: () => ({
              eq: touch,
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    };

    const result = await appendConversationMessages(supabase as never, "conv-1", [
      { role: "user", content: "First" },
      { role: "assistant", content: "Second" },
    ]);

    expect(insertedRows).toEqual([
      expect.objectContaining({ role: "user", content: "First" }),
      expect.objectContaining({ role: "assistant", content: "Second" }),
    ]);
    expect(result.map((row) => row.content)).toEqual(["First", "Second"]);
    expect(touch).toHaveBeenCalled();
  });
});
