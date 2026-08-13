import { generateText } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedText } from "@/lib/ai/embeddings";
import { getChatModel } from "@/lib/ai/llm";

export type RagSource = {
  resourceId: string;
  title: string;
};

export type RagAnswer = {
  answer: string;
  sources: RagSource[];
};

type MatchRow = {
  id: string;
  resource_id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
};

const EMPTY_ANSWER =
  "No class resources are indexed yet. Upload materials on the class page, then ask again.";

export async function queryClassResources(
  supabase: SupabaseClient,
  classId: string,
  question: string
): Promise<RagAnswer> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Question is required");
  }

  const { count, error: countError } = await supabase
    .from("resources")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId)
    .eq("status", "active");

  if (countError) {
    throw new Error(`Resource lookup failed: ${countError.message}`);
  }

  if (!count) {
    return { answer: EMPTY_ANSWER, sources: [] };
  }

  const queryEmbedding = await embedText(trimmed, "query");
  const { data: matches, error: matchError } = await supabase.rpc(
    "match_resource_chunks",
    {
      query_embedding: `[${queryEmbedding.join(",")}]`,
      match_class_id: classId,
      match_count: 8,
    }
  );

  if (matchError) {
    throw new Error(`Vector search failed: ${matchError.message}`);
  }

  const rows = (matches ?? []) as MatchRow[];
  if (rows.length === 0) {
    return {
      answer:
        "I could not find relevant passages in your uploaded materials for that question.",
      sources: [],
    };
  }

  const resourceIds = [...new Set(rows.map((row) => row.resource_id))];
  const { data: resources, error: resourcesError } = await supabase
    .from("resources")
    .select("id, title")
    .in("id", resourceIds);

  if (resourcesError) {
    throw new Error(`Resource metadata failed: ${resourcesError.message}`);
  }

  const titleById = new Map(
    (resources ?? []).map((resource) => [resource.id, resource.title as string])
  );

  const context = rows
    .map((row, index) => {
      const title = titleById.get(row.resource_id) ?? "Resource";
      return `[${index + 1}] (${title})\n${row.content}`;
    })
    .join("\n\n");

  const { text } = await generateText({
    model: getChatModel(),
    system:
      "You are a CBC teaching assistant. Answer only using the provided context. If the context is insufficient, say you do not have enough information. Be concise.",
    prompt: `Context:\n${context}\n\nQuestion: ${trimmed}\n\nAnswer:`,
  });

  const sources: RagSource[] = resourceIds.map((resourceId) => ({
    resourceId,
    title: titleById.get(resourceId) ?? "Resource",
  }));

  return { answer: text.trim(), sources };
}
