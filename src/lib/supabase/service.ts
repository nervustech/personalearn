import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseEnv,
  requireSupabaseServiceRoleKey,
} from "@/lib/supabase/env";

/** Service-role Supabase client for background eval workers (bypasses RLS). */
export function createServiceClient() {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = requireSupabaseServiceRoleKey();
  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
