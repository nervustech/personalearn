import { isFileUIPart, type UIMessage } from "ai";
import {
  detectResourceFormat,
  extractTextFromUpload,
  maxBytesForFormat,
  unsupportedTypeMessage,
  type ResourceFormat,
} from "@/lib/ai/extract-text";

const MAX_ATTACHMENTS = 5;

export type PendingAttachment = {
  id: string;
  file: File;
};

export function validateChatAttachment(file: File): string | null {
  const format = detectResourceFormat(file.name, file.type);
  if (!format) {
    return unsupportedTypeMessage();
  }

  const maxBytes = maxBytesForFormat(format);
  if (file.size > maxBytes) {
    const limitMb = maxBytes / (1024 * 1024);
    return `${file.name} must be ${limitMb} MB or smaller.`;
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

function parseDataUrl(
  url: string
): { mimeType: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(url);
  if (!match) return null;

  const mimeType = match[1]?.trim() || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const data = match[3] ?? "";

  try {
    if (isBase64) {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return { mimeType, bytes };
    }

    return {
      mimeType,
      bytes: new TextEncoder().encode(decodeURIComponent(data)),
    };
  } catch {
    return null;
  }
}

function formatLabel(format: ResourceFormat): string {
  if (format === "txt") return "text";
  if (format === "pdf") return "pdf";
  return "image";
}

/**
 * Convert file parts (data URLs) into plain text the chat model can use.
 * Chat providers are text-first; attachments stay in-conversation only.
 */
export async function materializeAttachmentText(
  messages: UIMessage[]
): Promise<UIMessage[]> {
  return Promise.all(
    messages.map(async (message) => {
      if (message.role !== "user") {
        return message;
      }

      const fileParts = message.parts.filter(isFileUIPart);
      if (fileParts.length === 0) {
        return message;
      }

      const extractedBlocks: string[] = [];

      for (const part of fileParts) {
        const parsed = parseDataUrl(part.url);
        if (!parsed) {
          extractedBlocks.push(
            `[Attached file: ${part.filename ?? "file"} — could not read contents]`
          );
          continue;
        }

        const fileName = part.filename ?? "attachment";
        const format = detectResourceFormat(fileName, part.mediaType || parsed.mimeType);
        if (!format) {
          extractedBlocks.push(
            `[Attached file: ${fileName} — unsupported type]`
          );
          continue;
        }

        try {
          const text = await extractTextFromUpload({
            fileName,
            mimeType: part.mediaType || parsed.mimeType,
            bytes: parsed.bytes,
          });
          extractedBlocks.push(
            `[Attached ${formatLabel(format)}: ${fileName}]\n${text}`
          );
        } catch (error) {
          const detail =
            error instanceof Error ? error.message : "Could not extract text";
          extractedBlocks.push(`[Attached file: ${fileName} — ${detail}]`);
        }
      }

      const nonFileParts = message.parts.filter((part) => !isFileUIPart(part));
      const attachmentText = extractedBlocks.join("\n\n");

      return {
        ...message,
        parts: [
          ...nonFileParts,
          { type: "text" as const, text: `\n\n${attachmentText}` },
        ],
      };
    })
  );
}
