import {
  getVoyageEmbeddingModel,
  requireVoyageApiKey,
  VOYAGE_EMBEDDING_DIM,
} from "@/lib/ai/env";

const VOYAGE_EMBED_URL = "https://api.voyageai.com/v1/embeddings";

export type VoyageInputType = "document" | "query";

type VoyageEmbedResponse = {
  data: Array<{ embedding: number[] }>;
};

export async function embedTexts(
  texts: string[],
  inputType: VoyageInputType
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const apiKey = requireVoyageApiKey();
  const model = getVoyageEmbeddingModel();

  const response = await fetch(VOYAGE_EMBED_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts,
      model,
      input_type: inputType,
      output_dimension: VOYAGE_EMBEDDING_DIM,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Voyage embed failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as VoyageEmbedResponse;
  const embeddings = payload.data.map((row) => row.embedding);

  for (const embedding of embeddings) {
    if (embedding.length !== VOYAGE_EMBEDDING_DIM) {
      throw new Error(
        `Expected ${VOYAGE_EMBEDDING_DIM}-dim embedding, got ${embedding.length}`
      );
    }
  }

  return embeddings;
}

export async function embedText(
  text: string,
  inputType: VoyageInputType
): Promise<number[]> {
  const [embedding] = await embedTexts([text], inputType);
  return embedding;
}
