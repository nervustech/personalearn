import type { ResourceType } from "@/types/database";

/** Resource types that publish a class assessment on save (AC-5.16). */
export const GRADABLE_RESOURCE_TYPES = [
  "assignment",
  "quiz",
  "examination",
] as const satisfies readonly ResourceType[];

export type GradableResourceType = (typeof GRADABLE_RESOURCE_TYPES)[number];

export function isGradableResourceType(
  resourceType: string
): resourceType is GradableResourceType {
  return (GRADABLE_RESOURCE_TYPES as readonly string[]).includes(resourceType);
}

/** Map library resource type → assessments.type CHECK values. */
export function assessmentTypeForResource(
  resourceType: GradableResourceType
): "written" | "formative" | "summative" {
  switch (resourceType) {
    case "quiz":
      return "formative";
    case "examination":
      return "summative";
    case "assignment":
    default:
      return "written";
  }
}
