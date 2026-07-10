import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assessmentTypeForResource,
  isGradableResourceType,
  type GradableResourceType,
} from "@/lib/evaluation/gradable";

export type LinkedAssessmentResult = {
  assessmentId: string;
  created: boolean;
};

/**
 * Idempotently create a class assessment linked to a gradable resource.
 * Safe to call on every gradable save_resource (unique on resource_id).
 */
export async function ensureAssessmentForGradableResource(
  supabase: SupabaseClient,
  input: {
    classId: string;
    resourceId: string;
    title: string;
    resourceType: GradableResourceType;
    description?: string | null;
  }
): Promise<LinkedAssessmentResult> {
  const { data: existing, error: lookupError } = await supabase
    .from("assessments")
    .select("id")
    .eq("resource_id", input.resourceId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (existing?.id) {
    return { assessmentId: existing.id as string, created: false };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("assessments")
    .insert({
      class_id: input.classId,
      title: input.title,
      description: input.description ?? null,
      type: assessmentTypeForResource(input.resourceType),
      resource_id: input.resourceId,
    })
    .select("id")
    .single();

  if (insertError) {
    // Race: another request inserted the same resource_id.
    if (insertError.code === "23505") {
      const { data: raced } = await supabase
        .from("assessments")
        .select("id")
        .eq("resource_id", input.resourceId)
        .maybeSingle();
      if (raced?.id) {
        return { assessmentId: raced.id as string, created: false };
      }
    }
    throw new Error(insertError.message);
  }

  return { assessmentId: inserted.id as string, created: true };
}

export function shouldPublishAssessment(resourceType: string): boolean {
  return isGradableResourceType(resourceType);
}
