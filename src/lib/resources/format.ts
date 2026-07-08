import type { ResourceType } from "@/types/database";

export const RESOURCE_TYPE_OPTIONS = [
  "scheme_of_work",
  "assignment",
  "lesson_notes",
  "marking_scheme",
  "quiz",
  "examination",
  "other",
] as const satisfies readonly ResourceType[];

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  scheme_of_work: "Scheme of work",
  assignment: "Assignment",
  lesson_notes: "Lesson notes",
  marking_scheme: "Marking scheme",
  quiz: "Quiz",
  examination: "Examination",
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

export function resourceFileName(rawContent: Record<string, unknown>) {
  const fileName = rawContent.fileName;
  return typeof fileName === "string" ? fileName : "resource";
}
