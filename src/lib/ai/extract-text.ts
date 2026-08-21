import { generateText } from "ai";
import { extractText as extractPdfText } from "unpdf";
import { getVisionExtractionModel } from "@/lib/ai/llm";
import {
  detectResourceFormat,
  maxBytesForFormat,
  unsupportedTypeMessage,
} from "@/lib/ai/resource-format";

export {
  MAX_TXT_BYTES,
  MAX_BINARY_BYTES,
  SUPPORTED_MIME_TYPES,
  detectResourceFormat,
  maxBytesForFormat,
  unsupportedTypeMessage,
  type ResourceFormat,
} from "@/lib/ai/resource-format";

export class ExtractTextError extends Error {
  constructor(
    message: string,
    readonly code: "unsupported" | "empty" | "config" | "extract"
  ) {
    super(message);
    this.name = "ExtractTextError";
  }
}

const IMAGE_OCR_PROMPT =
  "Extract all readable text from this image. Preserve paragraph breaks where possible. Return only the extracted text with no commentary.";

async function extractTextFromPdf(bytes: Uint8Array): Promise<string> {
  // unpdf may detach the underlying ArrayBuffer; always pass a copy.
  const { text } = await extractPdfText(bytes.slice(), { mergePages: true });
  return text.trim();
}

async function extractTextFromImage(bytes: Uint8Array, mimeType: string): Promise<string> {
  const { text } = await generateText({
    model: getVisionExtractionModel(),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: bytes,
            mediaType: mimeType,
          },
          { type: "text", text: IMAGE_OCR_PROMPT },
        ],
      },
    ],
  });

  return text.trim();
}

export async function extractTextFromUpload(input: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<string> {
  const format = detectResourceFormat(input.fileName, input.mimeType);
  if (!format) {
    throw new ExtractTextError(unsupportedTypeMessage(), "unsupported");
  }

  const maxBytes = maxBytesForFormat(format);
  if (input.bytes.byteLength > maxBytes) {
    const limitMb = maxBytes / (1024 * 1024);
    throw new ExtractTextError(
      `File must be ${limitMb} MB or smaller.`,
      "unsupported"
    );
  }

  let text: string;
  try {
    if (format === "txt") {
      text = new TextDecoder().decode(input.bytes).trim();
    } else if (format === "pdf") {
      text = await extractTextFromPdf(input.bytes);
    } else {
      text = await extractTextFromImage(input.bytes, input.mimeType || "image/jpeg");
    }
  } catch (error) {
    if (error instanceof ExtractTextError) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Could not extract text from file.";
    if (message.includes("GOOGLE_GENERATIVE_AI_API_KEY") || message.includes("XAI_API_KEY")) {
      throw new ExtractTextError(message, "config");
    }

    throw new ExtractTextError(
      "Could not extract text from this file. Try a clearer scan or a different format.",
      "extract"
    );
  }

  if (!text) {
    throw new ExtractTextError(
      "File is empty or contains no readable text.",
      "empty"
    );
  }

  return text;
}
