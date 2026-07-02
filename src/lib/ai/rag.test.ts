import { describe, expect, it, vi, beforeEach } from "vitest";
import { queryClassResources } from "./rag";

vi.mock("@/lib/ai/embeddings", () => ({
  embedText: vi.fn(async () => Array.from({ length: 1024 }, () => 0.2)),
}));

vi.mock("@/lib/ai/llm", () => ({
  getChatModel: vi.fn(() => ({ modelId: "mock" })),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(async () => ({ text: "Term 1 covers algebra basics." })),
}));

function createSupabaseMock(options: {
  resourceCount: number;
  matches?: Array<{
    id: string;
    resource_id: string;
    content: string;
    metadata: Record<string, unknown>;
    similarity: number;
  }>;
}) {
  return {
    from: (table: string) => {
      if (table !== "resources") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) {
            return {
              eq: () => ({
                eq: async () => ({
                  count: options.resourceCount,
                  error: null,
                }),
              }),
            };
          }

          return {
            in: async () => ({
              data: [{ id: "res-1", title: "Scheme of Work" }],
              error: null,
            }),
          };
        },
      };
    },
    rpc: async () => ({
      data: options.matches ?? [],
      error: null,
    }),
  };
}

describe("queryClassResources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty-state when class has no resources", async () => {
    const supabase = createSupabaseMock({ resourceCount: 0 });
    const result = await queryClassResources(
      supabase as never,
      "class-1",
      "What is term 1?"
    );
    expect(result.sources).toEqual([]);
    expect(result.answer).toMatch(/No class resources/);
  });

  it("returns cited answer when chunks match", async () => {
    const supabase = createSupabaseMock({
      resourceCount: 1,
      matches: [
        {
          id: "chunk-1",
          resource_id: "res-1",
          content: "Term 1: Number work and algebra.",
          metadata: {},
          similarity: 0.9,
        },
      ],
    });

    const result = await queryClassResources(
      supabase as never,
      "class-1",
      "What is covered in term 1?"
    );

    expect(result.answer).toContain("algebra");
    expect(result.sources).toEqual([
      { resourceId: "res-1", title: "Scheme of Work" },
    ]);
  });
});
