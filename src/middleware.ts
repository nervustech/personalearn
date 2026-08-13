import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPostLoginPath } from "@/lib/auth/post-login-path";
import { getSupabaseEnv } from "@/lib/supabase/env";

const loginPath = "/login";
const onboardingPath = "/onboarding";
const protectedPrefixes = ["/dashboard", "/classes", "/ai-hub"];
const authAwarePrefixes = [loginPath, onboardingPath, ...protectedPrefixes];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isProtectedRoute(pathname: string) {
  return protectedPrefixes.some((prefix) => matchesPrefix(pathname, prefix));
}

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

  const { pathname } = request.nextUrl;

  // Only the login/onboarding/protected routes need a session check.
  if (!authAwarePrefixes.some((prefix) => matchesPrefix(pathname, prefix))) {
    return NextResponse.next({ request });
  }

  try {
    let response = NextResponse.next({ request });
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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Unauthenticated: only the login page is reachable.
    if (!user) {
      if (pathname === loginPath) {
        return response;
      }
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = loginPath;
      redirectUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Authenticated: route based on whether they've created their first class.
    const hasClasses = await teacherHasClasses(supabase, user.id);

    if (pathname === loginPath) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = getPostLoginPath(hasClasses);
      redirectUrl.searchParams.delete("redirectTo");
      return NextResponse.redirect(redirectUrl);
    }

    if (pathname === onboardingPath && hasClasses) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      return NextResponse.redirect(redirectUrl);
    }

    if (isProtectedRoute(pathname) && !hasClasses) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = onboardingPath;
      return NextResponse.redirect(redirectUrl);
    }

    return response;
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
