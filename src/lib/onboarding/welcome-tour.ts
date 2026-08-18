import type { SupabaseClient } from "@supabase/supabase-js";

export const WELCOME_TOUR_STORAGE_KEY = "personalearn-tour-complete";

export function isWelcomeTourCompleteInStorage(
  storage: Pick<Storage, "getItem"> | null | undefined
): boolean {
  return storage?.getItem(WELCOME_TOUR_STORAGE_KEY) === "true";
}

export function markWelcomeTourCompleteInStorage(
  storage: Pick<Storage, "setItem">
) {
  storage.setItem(WELCOME_TOUR_STORAGE_KEY, "true");
}

/** Hide until the profile is loaded so a returning teacher does not flash the tour. */
export function shouldShowWelcomeTour(input: {
  dismissed: boolean;
  localCompleted: boolean;
  dbLoaded: boolean;
  dbCompleted: boolean;
}): boolean {
  if (input.dismissed || input.localCompleted) return false;
  if (!input.dbLoaded) return false;
  return !input.dbCompleted;
}

export function shouldSyncLocalCompletionToProfile(input: {
  localCompleted: boolean;
  dbCompleted: boolean;
}): boolean {
  return input.localCompleted && !input.dbCompleted;
}

export async function fetchWelcomeTourCompleted(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .select("welcome_tour_completed_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.welcome_tour_completed_at);
}

export async function persistWelcomeTourCompleted(
  supabase: SupabaseClient,
  userId: string,
  completedAt: string = new Date().toISOString()
) {
  const { error } = await supabase
    .from("users")
    .update({
      welcome_tour_completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq("id", userId);

  if (error) throw error;
}
