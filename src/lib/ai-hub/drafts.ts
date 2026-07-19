import type { SupabaseClient } from "@supabase/supabase-js";

export type AgentDraftKind = "text" | "image";

export type AgentDraftStatus = "pending" | "saved";

export type AgentDraft = {
  id: string;
  class_id: string;
  teacher_id: string;
  kind: AgentDraftKind;
  title: string;
  resource_type: string;
  content_text: string | null;
  storage_path: string | null;
  mime_type: string | null;
  metadata: Record<string, unknown>;
  status: AgentDraftStatus;
  created_at: string;
  updated_at: string;
};

export type CreateAgentDraftInput = {
  classId: string;
  teacherId: string;
  kind: AgentDraftKind;
  title: string;
  resourceType: string;
  contentText?: string | null;
  storagePath?: string | null;
  mimeType?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createAgentDraft(
  supabase: SupabaseClient,
  input: CreateAgentDraftInput
): Promise<AgentDraft> {
  const { data, error } = await supabase
    .from("ai_hub_drafts")
    .insert({
      class_id: input.classId,
      teacher_id: input.teacherId,
      kind: input.kind,
      title: input.title.trim(),
      resource_type: input.resourceType,
      content_text: input.contentText ?? null,
      storage_path: input.storagePath ?? null,
      mime_type: input.mimeType ?? null,
      metadata: input.metadata ?? {},
      status: "pending",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create draft");
  }

  return data as AgentDraft;
}

export async function getAgentDraft(
  supabase: SupabaseClient,
  input: { draftId: string; classId: string; teacherId: string }
): Promise<AgentDraft | null> {
  const { data, error } = await supabase
    .from("ai_hub_drafts")
    .select("*")
    .eq("id", input.draftId)
    .eq("class_id", input.classId)
    .eq("teacher_id", input.teacherId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as AgentDraft | null) ?? null;
}

export async function updateAgentDraft(
  supabase: SupabaseClient,
  input: {
    draftId: string;
    classId: string;
    teacherId: string;
    title?: string;
    contentText?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<AgentDraft> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) {
    patch.title = input.title.trim();
  }
  if (input.contentText !== undefined) {
    patch.content_text = input.contentText;
  }
  if (input.metadata !== undefined) {
    patch.metadata = input.metadata;
  }

  const { data, error } = await supabase
    .from("ai_hub_drafts")
    .update(patch)
    .eq("id", input.draftId)
    .eq("class_id", input.classId)
    .eq("teacher_id", input.teacherId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Draft not found or already saved");
  }

  return data as AgentDraft;
}

export async function markAgentDraftSaved(
  supabase: SupabaseClient,
  input: { draftId: string; classId: string; teacherId: string }
): Promise<void> {
  const { error } = await supabase
    .from("ai_hub_drafts")
    .update({
      status: "saved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.draftId)
    .eq("class_id", input.classId)
    .eq("teacher_id", input.teacherId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function uploadDraftImageBytes(
  supabase: SupabaseClient,
  input: {
    classId: string;
    draftId: string;
    bytes: Uint8Array;
    mimeType: string;
    extension: string;
  }
): Promise<string> {
  const storagePath = `${input.classId}/drafts/${input.draftId}.${input.extension}`;
  const { error } = await supabase.storage
    .from("resources")
    .upload(storagePath, input.bytes, {
      contentType: input.mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Draft image upload failed: ${error.message}`);
  }

  return storagePath;
}

export async function downloadDraftImageBytes(
  supabase: SupabaseClient,
  storagePath: string
): Promise<Uint8Array> {
  const { data, error } = await supabase.storage
    .from("resources")
    .download(storagePath);

  if (error || !data) {
    throw new Error(error?.message ?? "Draft image not found");
  }

  return new Uint8Array(await data.arrayBuffer());
}
