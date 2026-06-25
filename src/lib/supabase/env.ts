export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Supabase dashboard labels this "anon" or "publishable" depending on project age.
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL plus NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_PUBLISHABLE_KEY — same anon/publishable key, not service_role). Restart `npm run dev` after saving."
    );
  }

  return { url, anonKey };
}
