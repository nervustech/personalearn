import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPostLoginPath } from "@/lib/auth/post-login-path";
import { getSupabaseEnv } from "@/lib/supabase/env";

const protectedPrefixes = ["/dashboard", "/classes", "/ai-hub"];
const onboardingPath = "/onboarding";

/** Supabase Site URL fallback returns ?code= on `/`; forward it to the callback route. */
function forwardOAuthCode(request: NextRequest) {
  if (
    request.nextUrl.pathname !== "/" ||
    !request.nextUrl.searchParams.has("code")
  ) {
    return null;
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/auth/callback";
  if (!redirectUrl.searchParams.has("next")) {
    redirectUrl.searchParams.set("next", "/dashboard");
  }
  return NextResponse.redirect(redirectUrl);
}

async function teacherHasClasses(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
) {
  const { count } = await supabase
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", userId)
    .eq("is_active", true);

  return (count ?? 0) > 0;
}

function configurationErrorResponse(message: string) {
  return new NextResponse(`PersonaLearn configuration error\n\n${message}`, {
    status: 503,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function middleware(request: NextRequest) {
  const oauthForward = forwardOAuthCode(request);
  if (oauthForward) {
    return oauthForward;
  }

  try {
    let supabaseResponse = NextResponse.next({ request });
    const { url, anonKey } = getSupabaseEnv();

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;
    const isProtected = protectedPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
    const isOnboarding = pathname === onboardingPath;

    if (!user && (isProtected || isOnboarding)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    if (user) {
      const hasClasses = await teacherHasClasses(supabase, user.id);

      if (pathname === "/login") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = getPostLoginPath(hasClasses);
        redirectUrl.searchParams.delete("redirectTo");
        return NextResponse.redirect(redirectUrl);
      }

      if (isOnboarding && hasClasses) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/dashboard";
        return NextResponse.redirect(redirectUrl);
      }

      if (isProtected && !hasClasses) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = onboardingPath;
        return NextResponse.redirect(redirectUrl);
      }
    }

    return supabaseResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Middleware failed";
    if (message.includes("Missing Supabase env")) {
      return configurationErrorResponse(message);
    }
    throw error;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|monitoring|api/health|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
