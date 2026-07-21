import type { ResourceType } from "@/types/database";

export const RESOURCE_TYPE_OPTIONS = [
  "scheme_of_work",
  "assignment",
  "lesson_notes",
  "marking_scheme",
  "quiz",
  "examination",
  "teaching_aid",
  "other",
] as const satisfies readonly ResourceType[];

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  scheme_of_work: "Scheme of work",
  assignment: "Assignment",
  lesson_notes: "Lesson notes",
  marking_scheme: "Marking scheme",
  quiz: "Quiz",
  examination: "Examination",
  teaching_aid: "Teaching aid",
  other: "Other",
};

export function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPE_OPTIONS as readonly string[]).includes(value);
}

export function formatResourceType(resourceType: ResourceType | null) {
  if (!resourceType) return "Material";
  return RESOURCE_TYPE_LABELS[resourceType] ?? "Resource";
}

export function formatResourceDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(iso));
}

export function resourcePreviewText(rawContent: Record<string, unknown>) {
  const text = rawContent.text;
  return typeof text === "string" ? text : "";
}

/**
 * Normalize OCR / PDF-extracted plain text for readable display
 * (preserve line breaks; collapse runaway blank lines).
 */
export function formatExtractedPlainText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** ASCII-safe filename for Content-Disposition (HTTP headers reject non-ByteString). */
export function contentDispositionFileName(fileName: string) {
  const trimmed = fileName.trim() || "resource";
  const dot = trimmed.lastIndexOf(".");
  const ext =
    dot > 0 ? trimmed.slice(dot).replace(/[^\w.]/g, "").slice(0, 12) : "";
  const stemSource = dot > 0 ? trimmed.slice(0, dot) : trimmed;
  const stem =
    stemSource
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "resource";
  return `${stem}${ext}`;
}

export function resourceFileName(rawContent: Record<string, unknown>) {
  const fileName = rawContent.fileName;
  return typeof fileName === "string" ? fileName : "resource";
}

export function resourceMimeType(rawContent: Record<string, unknown>) {
  const mimeType = rawContent.mimeType;
  return typeof mimeType === "string" ? mimeType.toLowerCase().split(";")[0]?.trim() ?? "" : "";
}

export function resourceStoragePath(rawContent: Record<string, unknown>) {
  const storagePath = rawContent.storagePath;
  return typeof storagePath === "string" ? storagePath : null;
}

/** Uploaded PDF or image whose original bytes should be shown/downloaded. */
export function isBinaryOriginalResource(rawContent: Record<string, unknown>) {
  const mime = resourceMimeType(rawContent);
  return mime === "application/pdf" || mime.startsWith("image/");
}

/**
 * Text/AI resources are editable (title + body). Binary PDF/image uploads are not.
 */
export function isEditableTextResource(resource: {
  ai_generated: boolean;
  raw_content: Record<string, unknown>;
}) {
  if (isBinaryOriginalResource(resource.raw_content)) return false;
  const mime = resourceMimeType(resource.raw_content);
  return (
    resource.ai_generated ||
    mime === "text/plain" ||
    mime === "text/markdown" ||
    mime === ""
  );
}

/**
 * Downloads: binary uploads → original file; AI/text → synthesized PDF
 * (even when a .txt storagePath exists).
 */
export function shouldExportResourceAsPdf(resource: {
  ai_generated: boolean;
  raw_content: Record<string, unknown>;
}) {
  if (isBinaryOriginalResource(resource.raw_content)) return false;
  const mime = resourceMimeType(resource.raw_content);
  return (
    resource.ai_generated ||
    mime === "text/plain" ||
    mime === "text/markdown" ||
    Boolean(resourcePreviewText(resource.raw_content).trim())
  );
}
