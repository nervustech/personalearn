import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPostLoginPath } from "@/lib/auth/post-login-path";
import { getSupabaseEnv } from "@/lib/supabase/env";

const protectedPrefixes = ["/dashboard", "/classes", "/ai-hub"];
const onboardingPath = "/onboarding";
const authAwarePrefixes = [
  "/login",
  onboardingPath,
  ...protectedPrefixes,
];

function isAuthAwareRoute(pathname: string) {
  return authAwarePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Site URL fallback lands on /?code=… — forward to the callback route on this host. */
function redirectOAuthCodeFromSiteRoot(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authCode = request.nextUrl.searchParams.get("code");
  if (pathname !== "/" || !authCode) {
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
  const body = `PersonaLearn configuration error\n\n${message}`;

  return new NextResponse(body, {
    status: 503,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

const HAS_CLASSES_COOKIE = "pl_has_classes";
const HAS_CLASSES_TTL_SECONDS = 300;

function setHasClassesCookie(response: NextResponse) {
  response.cookies.set(HAS_CLASSES_COOKIE, "1", {
    maxAge: HAS_CLASSES_TTL_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function middleware(request: NextRequest) {
  const oauthRedirect = redirectOAuthCodeFromSiteRoot(request);
  if (oauthRedirect) {
    return oauthRedirect;
  }

  const { pathname } = request.nextUrl;

  // Public routes need no auth — skip all Supabase work (no network round-trip).
  if (!isAuthAwareRoute(pathname)) {
    return NextResponse.next({ request });
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
      const cachedHasClasses = request.cookies.get(HAS_CLASSES_COOKIE)?.value === "1";

      const hasClasses = cachedHasClasses
        ? true
        : await teacherHasClasses(supabase, user.id);

      const shouldCache = hasClasses && !cachedHasClasses;

      if (pathname === "/login") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = getPostLoginPath(hasClasses);
        redirectUrl.searchParams.delete("redirectTo");
        const response = NextResponse.redirect(redirectUrl);
        if (shouldCache) setHasClassesCookie(response);
        return response;
      }

      if (isOnboarding && hasClasses) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/dashboard";
        const response = NextResponse.redirect(redirectUrl);
        if (shouldCache) setHasClassesCookie(response);
        return response;
      }

      if (isProtected && !hasClasses) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = onboardingPath;
        return NextResponse.redirect(redirectUrl);
      }

      if (shouldCache) setHasClassesCookie(supabaseResponse);
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
