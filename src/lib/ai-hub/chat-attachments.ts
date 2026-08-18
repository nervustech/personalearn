import type { FileUIPart } from "ai";
import {
  detectResourceFormat,
  maxBytesForFormat,
  unsupportedTypeMessage,
  type ResourceFormat,
} from "@/lib/ai/resource-format";

const MAX_ATTACHMENTS = 5;
/** Stay under Vercel Functions' 4.5 MB request body (FUNCTION_PAYLOAD_TOO_LARGE). */
export const MAX_CHAT_REQUEST_BYTES = 4 * 1024 * 1024;
/** Non-image file cap (txt, pdf). */
export const MAX_CHAT_FILE_BYTES = 2 * 1024 * 1024;
/** Images are accepted up to this raw size; they'll be compressed before send. */
export const MAX_CHAT_IMAGE_PICK_BYTES = 5 * 1024 * 1024;
/** Target wire size after compression (raw bytes before base64). */
const IMAGE_COMPRESS_TARGET_BYTES = 1.5 * 1024 * 1024;

export type PendingAttachment = {
  id: string;
  file: File;
};

export function validateChatAttachment(file: File): string | null {
  const format = detectResourceFormat(file.name, file.type);
  if (!format) {
    return unsupportedTypeMessage();
  }

  const isImage = format === "image";
  const maxBytes = isImage
    ? MAX_CHAT_IMAGE_PICK_BYTES
    : Math.min(maxBytesForFormat(format), MAX_CHAT_FILE_BYTES);
  if (file.size > maxBytes) {
    const limitMb = maxBytes / (1024 * 1024);
    return `${file.name} must be ${limitMb} MB or smaller for chat.`;
  }

  return null;
}

export function validateChatAttachments(
  files: File[],
  existingCount = 0
): { accepted: File[]; error: string | null } {
  if (existingCount + files.length > MAX_ATTACHMENTS) {
    return {
      accepted: [],
      error: `You can attach up to ${MAX_ATTACHMENTS} files per message.`,
    };
  }

  const accepted: File[] = [];
  for (const file of files) {
    const error = validateChatAttachment(file);
    if (error) {
      return { accepted: [], error };
    }
    accepted.push(file);
  }

  return { accepted, error: null };
}

export function chatAttachmentAccept(): string {
  return ".txt,.pdf,.jpg,.jpeg,.png,text/plain,application/pdf,image/jpeg,image/png";
}

export function formatAttachmentLabel(format: ResourceFormat): string {
  if (format === "txt") return "text";
  if (format === "pdf") return "pdf";
  return "image";
}

export function mediaTypeForFile(file: File): string {
  if (file.type) return file.type;

  const format = detectResourceFormat(file.name, "");
  if (format === "txt") return "text/plain";
  if (format === "pdf") return "application/pdf";
  if (format === "image") {
    return file.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  }

  return "application/octet-stream";
}

export async function filesToFileUIParts(files: File[]): Promise<FileUIPart[]> {
  return Promise.all(files.map(fileToFileUIPart));
}

async function fileToFileUIPart(file: File): Promise<FileUIPart> {
  const mediaType = mediaTypeForFile(file);
  const isImage = mediaType.startsWith("image/");

  if (isImage && file.size > IMAGE_COMPRESS_TARGET_BYTES) {
    const compressed = await compressImage(file);
    return {
      type: "file",
      mediaType: "image/jpeg",
      filename: file.name,
      url: toDataUrl("image/jpeg", compressed),
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  return {
    type: "file",
    mediaType,
    filename: file.name,
    url: toDataUrl(mediaType, bytes),
  };
}

/**
 * Compress an image using canvas. Iteratively reduces quality/dimensions
 * until the result fits within IMAGE_COMPRESS_TARGET_BYTES.
 */
async function compressImage(file: File): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 2048;
  let { width, height } = bitmap;

  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.8, 0.6, 0.4, 0.3]) {
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    if (blob.size <= IMAGE_COMPRESS_TARGET_BYTES) {
      return new Uint8Array(await blob.arrayBuffer());
    }
  }

  // Last resort: scale down further
  const smallW = Math.round(width * 0.5);
  const smallH = Math.round(height * 0.5);
  const small = new OffscreenCanvas(smallW, smallH);
  const sCtx = small.getContext("2d")!;
  sCtx.drawImage(canvas, 0, 0, smallW, smallH);
  const blob = await small.convertToBlob({ type: "image/jpeg", quality: 0.5 });
  return new Uint8Array(await blob.arrayBuffer());
}

function toDataUrl(mediaType: string, bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return `data:${mediaType};base64,${btoa(binary)}`;
}

type ChatTransportMessage = {
  role?: string;
  parts?: Array<{
    type?: string;
    filename?: string;
    url?: string;
    mediaType?: string;
  }>;
};

export function compactChatTransportBody(bodyStr: string): {
  bodyStr: string;
  beforeBytes: number;
  afterBytes: number;
  strippedFileParts: number;
} {
  const beforeBytes = bodyStr.length;
  let parsed: { messages?: ChatTransportMessage[] };
  try {
    parsed = JSON.parse(bodyStr) as { messages?: ChatTransportMessage[] };
  } catch {
    return {
      bodyStr,
      beforeBytes,
      afterBytes: beforeBytes,
      strippedFileParts: 0,
    };
  }

  const messages = parsed.messages;
  if (!Array.isArray(messages)) {
    return {
      bodyStr,
      beforeBytes,
      afterBytes: beforeBytes,
      strippedFileParts: 0,
    };
  }

  let lastUserIndex = -1;
  for (let i = 0; i < messages.length; i += 1) {
    if (messages[i]?.role === "user") lastUserIndex = i;
  }

  let strippedFileParts = 0;
  parsed.messages = messages.map((message, index) => {
    if (index === lastUserIndex || !message.parts) return message;
    return {
      ...message,
      parts: message.parts.map((part) => {
        if (
          part.type === "file" &&
          typeof part.url === "string" &&
          part.url.length > 32
        ) {
          strippedFileParts += 1;
          return { ...part, url: "data:," };
        }
        return part;
      }),
    };
  });

  const next = JSON.stringify(parsed);
  return {
    bodyStr: next,
    beforeBytes,
    afterBytes: next.length,
    strippedFileParts,
  };
}

export function chatPayloadTooLargeMessage(bodyBytes: number): string {
  const mb = (bodyBytes / (1024 * 1024)).toFixed(1);
  return `This file is too large to send in chat (${mb} MB request; Vercel limit is 4.5 MB). Try a smaller image or fewer attachments.`;
}
