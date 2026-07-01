import { afterEach, describe, expect, it, vi } from "vitest";
import { embedText, embedTexts } from "./embeddings";

const ENV_KEYS = ["VOYAGE_API_KEY", "VOYAGE_EMBEDDING_MODEL"] as const;

function clearEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe("embeddings", () => {
  afterEach(() => {
    clearEnv();
    vi.restoreAllMocks();
  });

  it("returns empty array for empty input", async () => {
    await expect(embedTexts([], "document")).resolves.toEqual([]);
  });

  it("calls Voyage API and returns embeddings", async () => {
    process.env.VOYAGE_API_KEY = "test-voyage-key";
    process.env.VOYAGE_EMBEDDING_MODEL = "voyage-3.5";

    const vector = Array.from({ length: 1024 }, (_, i) => i / 1024);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: vector }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await embedText("hello class", "query");

    expect(result).toEqual(vector);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.voyageai.com/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-voyage-key",
        }),
      })
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      input: ["hello class"],
      model: "voyage-3.5",
      input_type: "query",
      output_dimension: 1024,
    });
  });
});
