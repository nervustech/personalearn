import { NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { url } = getSupabaseEnv();
  const supabaseOrigin = new URL(url).origin;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return NextResponse.json({
    supabaseProjectUrl: supabaseOrigin,
    googleAuthorizedRedirectUri: `${supabaseOrigin}/auth/v1/callback`,
    supabaseSiteUrl: siteUrl,
    supabaseRedirectUrls: [`${siteUrl}/**`],
    checklist: [
      `Google Cloud Console → Credentials → OAuth client → Authorized redirect URIs: ${supabaseOrigin}/auth/v1/callback`,
      "Supabase → Authentication → Providers → Google: same Client ID and Secret as Google",
      `Supabase → URL Configuration → Site URL: ${siteUrl}`,
      `Supabase → URL Configuration → Redirect URLs: ${siteUrl}/**`,
    ],
  });
}
