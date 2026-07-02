import type { SupabaseClient } from "@supabase/supabase-js";

export async function requireTeacherClass(
  supabase: SupabaseClient,
  classId: string
) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not authenticated");
  }

  const { data: cls, error: classError } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (classError || !cls) {
    throw new Error("Class not found");
  }

  return user;
}
