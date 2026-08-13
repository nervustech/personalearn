import type { SupabaseClient, User } from "@supabase/supabase-js";

function getDisplayName(user: User): string {
  const metadata = user.user_metadata ?? {};
  return (
    (metadata.full_name as string | undefined) ??
    (metadata.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Teacher"
  );
}

export async function ensureUserProfile(supabase: SupabaseClient, user: User) {
  const { data: existing, error: selectError } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return;

  if (!user.email) {
    throw new Error("Your account is missing an email. Cannot create teacher profile.");
  }

  const { error: insertError } = await supabase.from("users").insert({
    id: user.id,
    full_name: getDisplayName(user),
    email: user.email,
    phone: user.phone ?? null,
  });

  if (insertError) throw insertError;
}
