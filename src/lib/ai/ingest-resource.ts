import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkText } from "@/lib/ai/chunk-text";
import { embedTexts } from "@/lib/ai/embeddings";

export const MAX_TXT_BYTES = 2 * 1024 * 1024;
export const EMBED_BATCH_SIZE = 32;

export type IngestTxtInput = {
  classId: string;
  fileName: string;
  text: string;
};

export type IngestTxtResult = {
  resourceId: string;
  chunkCount: number;
  title: string;
};

function formatEmbedding(vector: number[]) {
  return `[${vector.join(",")}]`;
}

export async function ingestTxtResource(
  supabase: SupabaseClient,
  input: IngestTxtInput
): Promise<IngestTxtResult> {
  const { classId, fileName, text } = input;
  const title = fileName.replace(/\.txt$/i, "") || "Uploaded resource";
  const chunks = chunkText(text);

  if (chunks.length === 0) {
    throw new Error("File is empty or contains no readable text.");
  }

  const resourceId = crypto.randomUUID();
  const storagePath = `${classId}/${resourceId}.txt`;

  const { error: uploadError } = await supabase.storage
    .from("resources")
    .upload(storagePath, new Blob([text], { type: "text/plain" }), {
      contentType: "text/plain",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { error: resourceError } = await supabase.from("resources").insert({
    id: resourceId,
    class_id: classId,
    title,
    raw_content: {
      text,
      fileName,
      mimeType: "text/plain",
      storagePath,
    },
    ai_generated: false,
    status: "active",
  });

  if (resourceError) {
    await supabase.storage.from("resources").remove([storagePath]);
    throw new Error(`Resource insert failed: ${resourceError.message}`);
  }

  const allEmbeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const embeddings = await embedTexts(batch, "document");
    allEmbeddings.push(...embeddings);
  }

  const chunkRows = chunks.map((content, index) => ({
    resource_id: resourceId,
    content,
    embedding: formatEmbedding(allEmbeddings[index]!),
    metadata: { index, fileName },
  }));

  const { error: chunksError } = await supabase
    .from("resource_chunks")
    .insert(chunkRows);

  if (chunksError) {
    await supabase.from("resources").delete().eq("id", resourceId);
    await supabase.storage.from("resources").remove([storagePath]);
    throw new Error(`Chunk insert failed: ${chunksError.message}`);
  }

  return { resourceId, chunkCount: chunks.length, title };
}
