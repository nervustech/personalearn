/** OAuth callback URL for the current app origin (must match Supabase redirect allowlist). */
export function buildOAuthCallbackUrl(redirectPath: string, origin: string) {
  const base = origin.replace(/\/$/, "");
  const path = redirectPath.startsWith("/") ? redirectPath : "/dashboard";
  return `${base}/auth/callback?next=${encodeURIComponent(path)}`;
}
