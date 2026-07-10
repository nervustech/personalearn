import type { SupabaseClient } from "@supabase/supabase-js";
import type { Assessment, EvaluationBatch } from "@/types/database";
import {
  ensureAssessmentForGradableResource,
  shouldPublishAssessment,
} from "@/lib/evaluation/create-assessment-from-resource";
import type { GradableResourceType } from "@/lib/evaluation/gradable";
import { isGradableResourceType } from "@/lib/evaluation/gradable";

export async function listClassAssessments(
  supabase: SupabaseClient,
  classId: string
): Promise<Assessment[]> {
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Assessment[];
}

export async function listClassEvaluationBatches(
  supabase: SupabaseClient,
  classId: string
): Promise<EvaluationBatch[]> {
  const { data, error } = await supabase
    .from("evaluation_batches")
    .select("*")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as EvaluationBatch[];
}

export type CreateEvaluationBatchInput = {
  classId: string;
  /** Existing assessment id, or omit when creating from a resource. */
  assessmentId?: string | null;
  /** Gradable resource to promote/link when assessmentId is omitted. */
  resourceId?: string | null;
  markingSchemeResourceId?: string | null;
  /** Explicit proceed without a marking scheme. */
  proceedWithoutScheme?: boolean;
};

export async function createEvaluationBatch(
  supabase: SupabaseClient,
  input: CreateEvaluationBatchInput
): Promise<EvaluationBatch> {
  let assessmentId = input.assessmentId ?? null;

  if (assessmentId) {
    const { data: assessment, error: assessmentError } = await supabase
      .from("assessments")
      .select("id")
      .eq("id", assessmentId)
      .eq("class_id", input.classId)
      .maybeSingle();

    if (assessmentError || !assessment) {
      throw new Error("Assessment not found");
    }
  } else if (input.resourceId) {
    const { data: resource, error } = await supabase
      .from("resources")
      .select("id, title, resource_type, class_id")
      .eq("id", input.resourceId)
      .eq("class_id", input.classId)
      .maybeSingle();

    if (error || !resource) {
      throw new Error("Resource not found");
    }

    const resourceType = resource.resource_type as string | null;
    if (!resourceType || !shouldPublishAssessment(resourceType)) {
      throw new Error(
        "Only assignment, quiz, or examination resources can start an evaluation"
      );
    }

    const linked = await ensureAssessmentForGradableResource(supabase, {
      classId: input.classId,
      resourceId: resource.id as string,
      title: resource.title as string,
      resourceType: resourceType as GradableResourceType,
    });
    assessmentId = linked.assessmentId;
  }

  if (!assessmentId) {
    throw new Error("assessmentId or a gradable resourceId is required");
  }

  const markingSchemeResourceId = input.markingSchemeResourceId ?? null;
  if (markingSchemeResourceId) {
    const { data: scheme, error: schemeError } = await supabase
      .from("resources")
      .select("id, resource_type, class_id")
      .eq("id", markingSchemeResourceId)
      .eq("class_id", input.classId)
      .maybeSingle();

    if (schemeError || !scheme) {
      throw new Error("Marking scheme resource not found");
    }
    if (scheme.resource_type !== "marking_scheme") {
      throw new Error("Selected resource is not a marking scheme");
    }
  } else if (!input.proceedWithoutScheme) {
    throw new Error(
      "Attach a marking scheme or set proceedWithoutScheme to continue"
    );
  }

  const { data: batch, error: batchError } = await supabase
    .from("evaluation_batches")
    .insert({
      class_id: input.classId,
      assessment_id: assessmentId,
      marking_scheme_resource_id: markingSchemeResourceId,
      status: "draft",
    })
    .select("*")
    .single();

  if (batchError || !batch) {
    throw new Error(batchError?.message ?? "Could not create evaluation batch");
  }

  return batch as EvaluationBatch;
}

export async function requireTeacherEvaluationBatch(
  supabase: SupabaseClient,
  batchId: string
): Promise<EvaluationBatch> {
  const { data: batch, error } = await supabase
    .from("evaluation_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();

  if (error || !batch) {
    throw new Error("Evaluation batch not found");
  }

  return batch as EvaluationBatch;
}

export { isGradableResourceType };
