<<<<<<< HEAD
/**
 * Client-safe upload format helpers (no unpdf / vision deps).
 * Keep heavy extraction in `@/lib/ai/extract-text` (server-only).
 */
=======
/** Client-safe upload format helpers — no PDF/OCR runtime deps. */
>>>>>>> 5484545 (fix: keep unpdf out of AI Hub client bundle (PSL-80))

export const MAX_TXT_BYTES = 2 * 1024 * 1024;
export const MAX_BINARY_BYTES = 5 * 1024 * 1024;

export const SUPPORTED_MIME_TYPES = [
  "text/plain",
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type ResourceFormat = "txt" | "pdf" | "image";

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
