import { generateText } from "ai";
import { extractText as extractPdfText } from "unpdf";
import { getGeminiFlashModel, requireGoogleGenerativeAiApiKey } from "@/lib/ai/vision-model";

export const MAX_TXT_BYTES = 2 * 1024 * 1024;
export const MAX_BINARY_BYTES = 5 * 1024 * 1024;

export const SUPPORTED_MIME_TYPES = [
  "text/plain",
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type ResourceFormat = "txt" | "pdf" | "image";

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

export function detectResourceFormat(
  fileName: string,
  mimeType: string
): ResourceFormat | null {
  const lowerName = fileName.toLowerCase();
  const normalizedMime = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";

  if (normalizedMime === "text/plain" || lowerName.endsWith(".txt")) {
    return "txt";
  }

  if (normalizedMime === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "pdf";
  }

  if (
    normalizedMime === "image/jpeg" ||
    normalizedMime === "image/png" ||
    /\.(jpe?g|png)$/.test(lowerName)
  ) {
    return "image";
  }

  return null;
}

export function maxBytesForFormat(format: ResourceFormat): number {
  return format === "txt" ? MAX_TXT_BYTES : MAX_BINARY_BYTES;
}

export function unsupportedTypeMessage() {
  return "Unsupported file type. Upload a .txt, .pdf, .jpg, or .png file.";
}

async function extractTextFromPdf(bytes: Uint8Array): Promise<string> {
  // unpdf may detach the underlying ArrayBuffer; always pass a copy.
  const { text } = await extractPdfText(bytes.slice(), { mergePages: true });
  return text.trim();
}

async function extractTextFromImage(bytes: Uint8Array, mimeType: string): Promise<string> {
  requireGoogleGenerativeAiApiKey();

  const { text } = await generateText({
    model: getGeminiFlashModel(),
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
    if (message.includes("GOOGLE_GENERATIVE_AI_API_KEY")) {
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
