import type { FileUIPart } from "ai";
import {
  detectResourceFormat,
  maxBytesForFormat,
  unsupportedTypeMessage,
  type ResourceFormat,
} from "@/lib/ai/resource-format";

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
  const bytes = new Uint8Array(await file.arrayBuffer());
  return {
    type: "file",
    mediaType,
    filename: file.name,
    url: toDataUrl(mediaType, bytes),
  };
}

function toDataUrl(mediaType: string, bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return `data:${mediaType};base64,${btoa(binary)}`;
}
