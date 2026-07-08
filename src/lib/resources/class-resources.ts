import type { SupabaseClient } from "@supabase/supabase-js";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";

export type TeacherResource = {
  id: string;
  class_id: string;
  title: string;
  raw_content: Record<string, unknown>;
  ai_generated: boolean;
  resource_type: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export async function requireTeacherResource(
  supabase: SupabaseClient,
  resourceId: string
): Promise<TeacherResource> {
  const { data: resource, error } = await supabase
    .from("resources")
    .select("*")
    .eq("id", resourceId)
    .maybeSingle();

  if (error || !resource) {
    throw new Error("Resource not found");
  }

  await requireTeacherClass(supabase, resource.class_id as string);
  return resource as TeacherResource;
}

export async function listClassResources(
  supabase: SupabaseClient,
  classId: string
) {
  const { data, error } = await supabase
    .from("resources")
    .select(
      "id, class_id, title, raw_content, ai_generated, resource_type, status, created_at, updated_at"
    )
    .eq("class_id", classId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Resource list failed: ${error.message}`);
  }

  return (data ?? []) as TeacherResource[];
}
