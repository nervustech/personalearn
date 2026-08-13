import {
  buildEvaluateSystemPrompt,
  buildEvaluateUserPrompt,
  evaluateJsonSchema,
} from "@/lib/evaluation/evaluate-schema";
import {
  getEvalVisionModelId,
  requireEvalVisionApiKey,
} from "@/lib/evaluation/eval-provider";
import {
  buildIndexPrompt,
  buildIndexUserPrompt,
  indexJsonSchema,
} from "@/lib/evaluation/index-schema";

export const XAI_BATCH_NAME_PREFIX = "xai:";
const XAI_API_BASE = "https://api.x.ai/v1";

export type XaiBatchRequestLine = {
  key: string;
  /** Body for POST /v1/responses */
  request: Record<string, unknown>;
};

function authHeaders(extra?: HeadersInit): HeadersInit {
  return {
    Authorization: `Bearer ${requireEvalVisionApiKey()}`,
    ...extra,
  };
}

function dataUrl(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}

function imageInputParts(
  images: { base64: string; mimeType: string }[]
): Array<{ type: "input_image"; image_url: string; detail: "high" }> {
  return images.map((img) => ({
    type: "input_image" as const,
    image_url: dataUrl(img.mimeType, img.base64),
    detail: "high" as const,
  }));
}

function responsesBody(input: {
  modelId: string;
  promptCacheKey: string;
  system: string;
  userText: string;
  images: { base64: string; mimeType: string }[];
  schemaName: string;
  schema: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    model: input.modelId,
    prompt_cache_key: input.promptCacheKey,
    input: [
      // Stable prefix first (system + identical user text) → higher cache hit rate.
      { role: "system", content: input.system },
      {
        role: "user",
        content: [
          { type: "input_text", text: input.userText },
          ...imageInputParts(input.images),
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: input.schemaName,
        schema: input.schema,
        strict: false,
      },
    },
  };
}

export function buildXaiIndexBatchLine(input: {
  key: string;
  imageBase64: string;
  mimeType: string;
  modelId?: string;
  promptCacheKey?: string;
}): XaiBatchRequestLine {
  return {
    key: input.key,
    request: responsesBody({
      modelId: input.modelId ?? getEvalVisionModelId(),
      promptCacheKey: input.promptCacheKey ?? "pl-eval:index",
      system: buildIndexPrompt(),
      userText: buildIndexUserPrompt(),
      images: [{ base64: input.imageBase64, mimeType: input.mimeType }],
      schemaName: "index_result",
      schema: indexJsonSchema as unknown as Record<string, unknown>,
    }),
  };
}

export function buildXaiEvaluateBatchLine(input: {
  key: string;
  images: { base64: string; mimeType: string }[];
  markingScheme: string | null;
  modelId?: string;
  promptCacheKey?: string;
}): XaiBatchRequestLine {
  return {
    key: input.key,
    request: responsesBody({
      modelId: input.modelId ?? getEvalVisionModelId(),
      promptCacheKey: input.promptCacheKey ?? "pl-eval:evaluate",
      system: buildEvaluateSystemPrompt({
        markingScheme: input.markingScheme,
      }),
      userText: buildEvaluateUserPrompt(),
      images: input.images,
      schemaName: "evaluate_result",
      schema: evaluateJsonSchema as unknown as Record<string, unknown>,
    }),
  };
}

function batchLinesToJsonl(
  lines: XaiBatchRequestLine[],
  promptCacheKey: string,
  modelId: string
): string {
  return lines
    .map(({ key, request }) =>
      JSON.stringify({
        custom_id: key,
        method: "POST",
        url: "/v1/responses",
        body: {
          ...request,
          model: modelId,
          prompt_cache_key: promptCacheKey,
        },
      })
    )
    .join("\n");
}

async function xaiFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const method = init?.method ?? "GET";
  const res = await fetch(`${XAI_API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `xAI ${method} ${path} failed (${res.status}): ${body.slice(0, 500)}`
    );
  }
  return res;
}

export async function submitXaiBatchJob(input: {
  displayName: string;
  lines: XaiBatchRequestLine[];
  modelId?: string;
  promptCacheKey: string;
}): Promise<{ providerBatchName: string }> {
  const modelId = input.modelId ?? getEvalVisionModelId();
  const jsonl = batchLinesToJsonl(input.lines, input.promptCacheKey, modelId);

  const form = new FormData();
  form.append(
    "file",
    new Blob([jsonl], { type: "application/jsonl" }),
    `${input.displayName}.jsonl`
  );

  const uploadRes = await xaiFetch("/files", {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  const file = (await uploadRes.json()) as { id?: string };
  if (!file.id) throw new Error("xAI files.upload returned no id");

  const batchRes = await xaiFetch("/batches", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      name: input.displayName,
      input_file_id: file.id,
    }),
  });
  const batch = (await batchRes.json()) as { batch_id?: string };
  if (!batch.batch_id) throw new Error("xAI batches.create returned no batch_id");

  return { providerBatchName: `${XAI_BATCH_NAME_PREFIX}${batch.batch_id}` };
}

export function parseXaiProviderBatchId(providerBatchName: string): string {
  if (!providerBatchName.startsWith(XAI_BATCH_NAME_PREFIX)) {
    throw new Error(`Not an xAI batch name: ${providerBatchName}`);
  }
  return providerBatchName.slice(XAI_BATCH_NAME_PREFIX.length);
}

export type XaiBatchJobStatus = {
  state: string;
  done: boolean;
  failed: boolean;
  error?: string;
};

export async function getXaiBatchJobStatus(
  providerBatchName: string
): Promise<XaiBatchJobStatus> {
  const batchId = parseXaiProviderBatchId(providerBatchName);
  const res = await xaiFetch(`/batches/${batchId}`, {
    headers: authHeaders(),
  });
  const batch = (await res.json()) as {
    cancel_by_xai_message?: string | null;
    state?: {
      num_pending?: number;
      num_success?: number;
      num_error?: number;
      num_cancelled?: number;
      num_requests?: number;
    };
  };

  const pending = batch.state?.num_pending ?? 0;
  const errors = batch.state?.num_error ?? 0;
  const cancelled = batch.state?.num_cancelled ?? 0;
  const success = batch.state?.num_success ?? 0;
  const done = pending === 0;
  const failed = done && success === 0 && (errors > 0 || cancelled > 0);

  return {
    state: done
      ? failed
        ? "JOB_STATE_FAILED"
        : "JOB_STATE_SUCCEEDED"
      : "JOB_STATE_RUNNING",
    done,
    failed,
    error: batch.cancel_by_xai_message ?? undefined,
  };
}

export type XaiBatchResultLine = {
  key: string;
  text: string | null;
  error: string | null;
  cachedTokens?: number;
  promptTokens?: number;
};

function extractChatCompletionText(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") {
    return null;
  }
  const content = (
    choices[0] as { message?: { content?: string | null } }
  ).message?.content;
  return typeof content === "string" ? content : null;
}

/** Pull assistant text from xAI batch result envelopes (Responses or Chat). */
export function extractResponsesText(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const r = response as Record<string, unknown>;

  // Responses API shape
  if (typeof r.output_text === "string") return r.output_text;
  if (Array.isArray(r.output)) {
    for (const item of r.output) {
      if (!item || typeof item !== "object") continue;
      const msg = item as { type?: string; content?: unknown[] };
      if (msg.type !== "message" || !Array.isArray(msg.content)) continue;
      for (const part of msg.content) {
        if (
          part &&
          typeof part === "object" &&
          (part as { type?: string }).type === "output_text" &&
          typeof (part as { text?: string }).text === "string"
        ) {
          return (part as { text: string }).text;
        }
      }
    }
  }

  // Batch oneof envelope: { chat_get_completion: {...} } or { responses: {...} }
  const nestedChat = extractChatCompletionText(r.chat_get_completion);
  if (nestedChat) return nestedChat;
  if (r.responses != null) {
    const nestedResponses = extractResponsesText(r.responses);
    if (nestedResponses) return nestedResponses;
  }

  // Unwrapped chat.completion object (common in xAI batch results today)
  return extractChatCompletionText(r);
}

function extractUsage(response: unknown): {
  cachedTokens?: number;
  promptTokens?: number;
} {
  if (!response || typeof response !== "object") return {};
  const r = response as Record<string, unknown>;
  const usage =
    (r.usage as Record<string, unknown> | undefined) ??
    (
      (r.chat_get_completion as { usage?: Record<string, unknown> } | undefined)
        ?.usage
    );
  if (!usage) return {};

  const promptDetails = usage.prompt_tokens_details as
    | { cached_tokens?: number }
    | undefined;
  const inputDetails = usage.input_tokens_details as
    | { cached_tokens?: number }
    | undefined;

  return {
    cachedTokens:
      promptDetails?.cached_tokens ?? inputDetails?.cached_tokens,
    promptTokens:
      typeof usage.prompt_tokens === "number"
        ? usage.prompt_tokens
        : typeof usage.input_tokens === "number"
          ? usage.input_tokens
          : undefined,
  };
}

export async function downloadXaiBatchResults(
  providerBatchName: string
): Promise<XaiBatchResultLine[]> {
  const batchId = parseXaiProviderBatchId(providerBatchName);
  const results: XaiBatchResultLine[] = [];
  let paginationToken: string | null = null;

  do {
    const qs = new URLSearchParams({ limit: "100" });
    if (paginationToken) qs.set("pagination_token", paginationToken);

    const res = await xaiFetch(`/batches/${batchId}/results?${qs}`, {
      headers: authHeaders(),
    });
    const page = (await res.json()) as {
      pagination_token?: string | null;
      results?: Array<{
        batch_request_id?: string;
        error_message?: string | null;
        batch_result?: {
          error?: string;
          response?: unknown;
        };
      }>;
    };

    for (const row of page.results ?? []) {
      const key = row.batch_request_id ?? "";
      const err =
        row.error_message ??
        (typeof row.batch_result?.error === "string"
          ? row.batch_result.error
          : null);
      const responseEnvelope = row.batch_result?.response;
      // Pass the full envelope — extractResponsesText handles chat/responses oneofs.
      const text = err ? null : extractResponsesText(responseEnvelope);
      const usage = extractUsage(responseEnvelope);

      results.push({
        key,
        text,
        error: err,
        cachedTokens: usage.cachedTokens,
        promptTokens: usage.promptTokens,
      });
    }

    paginationToken = page.pagination_token ?? null;
  } while (paginationToken);

  return results;
}

/** Sync (live) Responses call — used for N=1 / re-eval paths. */
export async function xaiSyncStructuredJson(input: {
  system: string;
  userText: string;
  images: { base64: string; mimeType: string }[];
  schemaName: string;
  schema: Record<string, unknown>;
  modelId?: string;
  promptCacheKey: string;
}): Promise<{ text: string; modelId: string; cachedTokens?: number }> {
  const modelId = input.modelId ?? getEvalVisionModelId();
  const body = responsesBody({
    modelId,
    promptCacheKey: input.promptCacheKey,
    system: input.system,
    userText: input.userText,
    images: input.images,
    schemaName: input.schemaName,
    schema: input.schema,
  });

  const res = await xaiFetch("/responses", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as unknown;
  const text = extractResponsesText(json);
  if (!text) throw new Error("Empty xAI response");
  const usage = extractUsage(json);
  return { text, modelId, cachedTokens: usage.cachedTokens };
}
