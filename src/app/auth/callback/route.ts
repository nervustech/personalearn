import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/lib/auth/ensure-user-profile";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const oauthError = searchParams.get("error");
  const oauthErrorCode = searchParams.get("error_code");
  const oauthErrorDescription = searchParams.get("error_description");

  if (oauthError) {
    const loginUrl = new URL(`${origin}/login`);
    loginUrl.searchParams.set("error", "auth");
    if (oauthErrorCode) {
      loginUrl.searchParams.set("error_code", oauthErrorCode);
    }
    if (oauthErrorDescription) {
      loginUrl.searchParams.set("error_detail", oauthErrorDescription);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    const safePath = next.startsWith("/") ? next : "/dashboard";
    const response = NextResponse.redirect(`${origin}${safePath}`);
    const cookieStore = await cookies();
    const { url, anonKey } = getSupabaseEnv();

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Route handlers may not always propagate cookieStore writes to redirects.
            }
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      await ensureUserProfile(supabase, data.user);
      return response;
    }

    const loginUrl = new URL(`${origin}/login`);
    loginUrl.searchParams.set("error", "auth");
    if (error?.message) {
      loginUrl.searchParams.set("error_detail", error.message);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
