import { GoogleGenAI, JobState } from "@google/genai";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { requireGoogleGenerativeAiApiKey } from "@/lib/ai/vision-model";
import {
  buildEvaluatePrompt,
  evaluateGeminiSchema,
} from "@/lib/evaluation/evaluate-schema";
import {
  buildIndexPrompt,
  indexGeminiSchema,
} from "@/lib/evaluation/index-schema";
import { getDefaultModelId } from "@/lib/evaluation/escalate";

export type BatchRequestLine = {
  key: string;
  request: Record<string, unknown>;
};

function createGenAiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: requireGoogleGenerativeAiApiKey() });
}

export function buildIndexBatchLine(input: {
  key: string;
  imageBase64: string;
  mimeType: string;
}): BatchRequestLine {
  return {
    key: input.key,
    request: {
      contents: [
        {
          role: "user",
          parts: [
            { text: buildIndexPrompt() },
            {
              inlineData: {
                mimeType: input.mimeType,
                data: input.imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: indexGeminiSchema,
      },
    },
  };
}

export function buildEvaluateBatchLine(input: {
  key: string;
  images: { base64: string; mimeType: string }[];
  markingScheme: string | null;
}): BatchRequestLine {
  const imageParts = input.images.map((img) => ({
    inlineData: { mimeType: img.mimeType, data: img.base64 },
  }));

  return {
    key: input.key,
    request: {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildEvaluatePrompt({ markingScheme: input.markingScheme }),
            },
            ...imageParts,
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: evaluateGeminiSchema,
      },
    },
  };
}

export function batchLinesToJsonl(lines: BatchRequestLine[]): string {
  return lines
    .map(({ key, request }) => JSON.stringify({ key, request }))
    .join("\n");
}

export async function submitBatchJob(input: {
  displayName: string;
  lines: BatchRequestLine[];
  modelId?: string;
}): Promise<{ providerBatchName: string }> {
  const ai = createGenAiClient();
  const modelId = input.modelId ?? getDefaultModelId();
  const jsonl = batchLinesToJsonl(input.lines);

  const file = await ai.files.upload({
    file: new Blob([jsonl], { type: "application/jsonl" }),
    config: { mimeType: "application/jsonl" },
  });

  if (!file.name) throw new Error("Failed to upload batch input file");

  const batch = await ai.batches.create({
    model: `models/${modelId}`,
    src: file.name,
    config: { displayName: input.displayName },
  });

  if (!batch.name) throw new Error("Batch create returned no name");
  return { providerBatchName: batch.name };
}

export type BatchJobStatus = {
  state: string;
  done: boolean;
  failed: boolean;
  error?: string;
};

export async function getBatchJobStatus(
  providerBatchName: string
): Promise<BatchJobStatus> {
  const ai = createGenAiClient();
  const batch = await ai.batches.get({ name: providerBatchName });
  const state = batch.state ?? JobState.JOB_STATE_PENDING;
  const failed =
    state === JobState.JOB_STATE_FAILED ||
    state === JobState.JOB_STATE_CANCELLED;
  const done =
    state === JobState.JOB_STATE_SUCCEEDED ||
    state === JobState.JOB_STATE_FAILED ||
    state === JobState.JOB_STATE_CANCELLED;

  return {
    state: String(state),
    done,
    failed,
    error: batch.error?.message,
  };
}

export type BatchResultLine = {
  key: string;
  text: string | null;
  error: string | null;
};

export async function downloadBatchResults(
  providerBatchName: string
): Promise<BatchResultLine[]> {
  const ai = createGenAiClient();
  const batch = await ai.batches.get({ name: providerBatchName });

  if (!batch.dest?.fileName) {
    throw new Error("Batch has no result file");
  }

  const tempDir = await mkdtemp(join(tmpdir(), "gemini-batch-"));
  const downloadPath = join(tempDir, "results.jsonl");

  try {
    await ai.files.download({
      file: batch.dest.fileName,
      downloadPath,
    });
    const text = await readFile(downloadPath, "utf8");

    const results: BatchResultLine[] = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as {
        key?: string;
        response?: {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        error?: { message?: string };
      };
      const key = row.key ?? "";
      const responseText =
        row.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      results.push({
        key,
        text: responseText,
        error: row.error?.message ?? null,
      });
    }
    return results;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
