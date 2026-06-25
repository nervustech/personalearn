import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPostLoginPath } from "@/lib/auth/post-login-path";
import { getSupabaseEnv } from "@/lib/supabase/env";

const protectedPrefixes = ["/dashboard", "/classes", "/ai-hub"];
const onboardingPath = "/onboarding";

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

export async function middleware(request: NextRequest) {
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
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const isOnboarding = pathname === onboardingPath;

  if (!user && (isProtected || isOnboarding)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user) {
    const hasClasses = await teacherHasClasses(supabase, user.id);

    if (pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = getPostLoginPath(hasClasses);
      url.searchParams.delete("redirectTo");
      return NextResponse.redirect(url);
    }

    if (isOnboarding && hasClasses) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    if (isProtected && !hasClasses) {
      const url = request.nextUrl.clone();
      url.pathname = onboardingPath;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
