import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkText } from "@/lib/ai/chunk-text";
import { embedTexts } from "@/lib/ai/embeddings";
import {
  ensureAssessmentForGradableResource,
  shouldPublishAssessment,
} from "@/lib/evaluation/create-assessment-from-resource";
import type { GradableResourceType } from "@/lib/evaluation/gradable";

export const MAX_TXT_BYTES = 2 * 1024 * 1024;
export const EMBED_BATCH_SIZE = 32;

export type IngestResourceInput = {
  classId: string;
  fileName: string;
  text: string;
  mimeType: string;
  fileBytes: Uint8Array;
  title?: string;
  aiGenerated?: boolean;
  resourceType?: string;
};

export type IngestTxtInput = {
  classId: string;
  fileName: string;
  text: string;
  title?: string;
  aiGenerated?: boolean;
  resourceType?: string;
};

export type IngestResourceResult = {
  resourceId: string;
  chunkCount: number;
  title: string;
};

function formatEmbedding(vector: number[]) {
  return `[${vector.join(",")}]`;
}

function titleFromFileName(fileName: string, titleOverride?: string) {
  return (
    titleOverride?.trim() ||
    fileName.replace(/\.[^.]+$/i, "") ||
    "Uploaded resource"
  );
}

function extensionFromFileName(fileName: string, mimeType: string) {
  const match = fileName.match(/\.([^.]+)$/i);
  if (match?.[1]) {
    return match[1].toLowerCase();
  }

  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  return "txt";
}

export async function ingestResource(
  supabase: SupabaseClient,
  input: IngestResourceInput
): Promise<IngestResourceResult> {
  const {
    classId,
    fileName,
    text,
    mimeType,
    fileBytes,
    title: titleOverride,
    aiGenerated,
    resourceType,
  } = input;
  const title = titleFromFileName(fileName, titleOverride);
  const chunks = chunkText(text);

  if (chunks.length === 0) {
    throw new Error("File is empty or contains no readable text.");
  }

  const resourceId = crypto.randomUUID();
  const extension = extensionFromFileName(fileName, mimeType);
  const storagePath = `${classId}/${resourceId}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("resources")
    .upload(storagePath, Buffer.from(fileBytes), {
      contentType: mimeType,
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
      mimeType,
      storagePath,
    },
    ai_generated: aiGenerated ?? false,
    resource_type: resourceType ?? null,
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

  if (resourceType && shouldPublishAssessment(resourceType)) {
    await ensureAssessmentForGradableResource(supabase, {
      classId,
      resourceId,
      title,
      resourceType: resourceType as GradableResourceType,
    });
  }

  return { resourceId, chunkCount: chunks.length, title };
}

export async function ingestTxtResource(
  supabase: SupabaseClient,
  input: IngestTxtInput
): Promise<IngestResourceResult> {
  const { classId, fileName, text, title, aiGenerated, resourceType } = input;

  return ingestResource(supabase, {
    classId,
    fileName,
    text,
    mimeType: "text/plain",
    fileBytes: new TextEncoder().encode(text),
    title,
    aiGenerated,
    resourceType,
  });
}

export type UpdateTextResourceInput = {
  title: string;
  text: string;
};

export type UpdateTextResourceResult = {
  resourceId: string;
  chunkCount: number;
  title: string;
};

/**
 * Update title + body for text/AI resources, then re-chunk and re-embed.
 * Does not support binary PDF/image edit.
 */
export async function updateTextResource(
  supabase: SupabaseClient,
  resourceId: string,
  input: UpdateTextResourceInput
): Promise<UpdateTextResourceResult> {
  const title = input.title.trim();
  const text = input.text;
  if (!title) {
    throw new Error("Title is required");
  }

  const { data: resource, error: fetchError } = await supabase
    .from("resources")
    .select("id, title, raw_content, ai_generated")
    .eq("id", resourceId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Resource lookup failed: ${fetchError.message}`);
  }
  if (!resource) {
    throw new Error("Resource not found");
  }

  const rawContent = (resource.raw_content ?? {}) as {
    text?: string;
    fileName?: string;
    mimeType?: string;
    storagePath?: string;
  };
  const mimeType = (rawContent.mimeType ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
  const isBinary =
    mimeType === "application/pdf" || mimeType.startsWith("image/");

  if (isBinary) {
    throw new Error("PDF and image uploads cannot be edited as text");
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    throw new Error("Content is empty or contains no readable text.");
  }

  const { error: deleteChunksError } = await supabase
    .from("resource_chunks")
    .delete()
    .eq("resource_id", resourceId);

  if (deleteChunksError) {
    throw new Error(`Chunk delete failed: ${deleteChunksError.message}`);
  }

  const allEmbeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const embeddings = await embedTexts(batch, "document");
    allEmbeddings.push(...embeddings);
  }

  const fileName = rawContent.fileName ?? "resource.txt";
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
    throw new Error(`Chunk insert failed: ${chunksError.message}`);
  }

  const nextRaw = {
    ...rawContent,
    text,
    mimeType: rawContent.mimeType || "text/plain",
    fileName,
  };

  const { error: updateError } = await supabase
    .from("resources")
    .update({
      title,
      raw_content: nextRaw,
    })
    .eq("id", resourceId);

  if (updateError) {
    throw new Error(`Resource update failed: ${updateError.message}`);
  }

  // Keep .txt storage object in sync when present (AI Hub / text uploads).
  if (rawContent.storagePath && !isBinary) {
    const bytes = Buffer.from(text, "utf8");
    const { error: uploadError } = await supabase.storage
      .from("resources")
      .upload(rawContent.storagePath, bytes, {
        contentType: "text/plain",
        upsert: true,
      });
    if (uploadError) {
      throw new Error(`Storage update failed: ${uploadError.message}`);
    }
  }

  return { resourceId, chunkCount: chunks.length, title };
}

export async function deleteResource(
  supabase: SupabaseClient,
  resourceId: string
): Promise<void> {
  const { data: resource, error: fetchError } = await supabase
    .from("resources")
    .select("id, raw_content")
    .eq("id", resourceId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Resource lookup failed: ${fetchError.message}`);
  }

  if (!resource) {
    throw new Error("Resource not found");
  }

  const rawContent = resource.raw_content as {
    storagePath?: string;
  };
  const storagePath = rawContent.storagePath;

  const { error: deleteError } = await supabase
    .from("resources")
    .delete()
    .eq("id", resourceId);

  if (deleteError) {
    throw new Error(`Resource delete failed: ${deleteError.message}`);
  }

  if (storagePath) {
    await supabase.storage.from("resources").remove([storagePath]);
  }
}
