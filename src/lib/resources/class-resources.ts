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

/** List-row shape: metadata + slim raw_content (no extracted text body). */
export type TeacherResourceListItem = Omit<TeacherResource, "raw_content"> & {
  raw_content: {
    fileName?: string;
    mimeType?: string;
    storagePath?: string;
  };
};

function slimRawContent(
  raw: Record<string, unknown> | null | undefined
): TeacherResourceListItem["raw_content"] {
  if (!raw || typeof raw !== "object") return {};
  const slim: TeacherResourceListItem["raw_content"] = {};
  if (typeof raw.fileName === "string") slim.fileName = raw.fileName;
  if (typeof raw.mimeType === "string") slim.mimeType = raw.mimeType;
  if (typeof raw.storagePath === "string") slim.storagePath = raw.storagePath;
  return slim;
}

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
): Promise<TeacherResourceListItem[]> {
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

  return (data ?? []).map((row) => ({
    ...(row as TeacherResource),
    raw_content: slimRawContent(
      row.raw_content as Record<string, unknown> | null | undefined
    ),
  }));
}
