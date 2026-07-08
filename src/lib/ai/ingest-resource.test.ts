import { describe, expect, it, vi } from "vitest";
import { ingestTxtResource } from "./ingest-resource";

vi.mock("@/lib/ai/embeddings", () => ({
  embedTexts: vi.fn(async (texts: string[]) =>
    texts.map(() => Array.from({ length: 1024 }, () => 0.1))
  ),
}));

describe("ingestTxtResource", () => {
  it("chunks, embeds, and inserts resource rows", async () => {
    const storageUpload = vi.fn().mockResolvedValue({ error: null });
    const storageRemove = vi.fn().mockResolvedValue({ error: null });
    const resourceInsert = vi.fn().mockResolvedValue({ error: null });
    const chunksInsert = vi.fn().mockResolvedValue({ error: null });

    const supabase = {
      storage: {
        from: () => ({
          upload: storageUpload,
          remove: storageRemove,
        }),
      },
      from: (table: string) => {
        if (table === "resources") {
          return { insert: resourceInsert };
        }
        if (table === "resource_chunks") {
          return { insert: chunksInsert };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    };

    const text = `${"word ".repeat(400)}end`;
    const result = await ingestTxtResource(
      supabase as never,
      {
        classId: "class-1",
        fileName: "scheme.txt",
        text,
      }
    );

    expect(result.title).toBe("scheme");
    expect(result.chunkCount).toBeGreaterThan(0);
    expect(storageUpload).toHaveBeenCalled();
    expect(resourceInsert).toHaveBeenCalled();
    expect(chunksInsert).toHaveBeenCalled();
  });

  it("sets ai_generated and resource_type for agent saves", async () => {
    const storageUpload = vi.fn().mockResolvedValue({ error: null });
    const resourceInsert = vi.fn().mockResolvedValue({ error: null });
    const chunksInsert = vi.fn().mockResolvedValue({ error: null });

    const supabase = {
      storage: {
        from: () => ({
          upload: storageUpload,
          remove: vi.fn().mockResolvedValue({ error: null }),
        }),
      },
      from: (table: string) => {
        if (table === "resources") {
          return { insert: resourceInsert };
        }
        if (table === "resource_chunks") {
          return { insert: chunksInsert };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    };

    const text = `${"word ".repeat(400)}end`;
    await ingestTxtResource(supabase as never, {
      classId: "class-1",
      fileName: "fractions-quiz.txt",
      text,
      title: "Fractions Quiz",
      aiGenerated: true,
      resourceType: "quiz",
    });

    expect(resourceInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Fractions Quiz",
        ai_generated: true,
        resource_type: "quiz",
      })
    );
  });
});
