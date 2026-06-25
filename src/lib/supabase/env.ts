function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Env vars MUST be read via STATIC `process.env.X` references (never
 * `process.env[dynamicKey]`). Next.js only inlines values into the Edge
 * (middleware) bundle at build time when the access is a static literal.
 * Dynamic access leaves the lookup until runtime, where the Edge runtime has no
 * `NEXT_PUBLIC_*` values — which broke middleware on Vercel preview/production.
 */
function urlCandidates(): Array<[string, string | undefined]> {
  return [
    ["NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL],
    ["SUPABASE_URL", process.env.SUPABASE_URL],
  ];
}

function anonCandidates(): Array<[string, string | undefined]> {
  return [
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY],
    ["NEXT_PUBLIC_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_PUBLISHABLE_KEY],
    ["SUPABASE_ANON_KEY", process.env.SUPABASE_ANON_KEY],
  ];
}

/** Keys checked in order — first match wins. */
export const SUPABASE_URL_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
] as const;

export const SUPABASE_ANON_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
] as const;

function firstValue(candidates: Array<[string, string | undefined]>) {
  for (const [, value] of candidates) {
    const cleaned = clean(value);
    if (cleaned) {
      return cleaned;
    }
  }
  return undefined;
}

export function getSupabaseEnvDiagnostics() {
  const url = urlCandidates();
  const anon = anonCandidates();

  const present = (candidates: Array<[string, string | undefined]>) =>
    candidates.filter(([, value]) => clean(value) !== undefined).map(([key]) => key);
  const missing = (candidates: Array<[string, string | undefined]>) =>
    candidates.filter(([, value]) => clean(value) === undefined).map(([key]) => key);

  return {
    configured: Boolean(firstValue(url) && firstValue(anon)),
    url: {
      present: present(url),
      missing: missing(url),
    },
    anonKey: {
      present: present(anon),
      missing: missing(anon),
    },
    vercelEnv: process.env.VERCEL_ENV ?? null,
  };
}

export function getSupabaseEnv() {
  const url = firstValue(urlCandidates());
  const anonKey = firstValue(anonCandidates());

  if (!url || !anonKey) {
    const diagnostics = getSupabaseEnvDiagnostics();
    const vercelEnv = process.env.VERCEL_ENV;
    const vercelHint =
      vercelEnv === "preview" || vercelEnv === "production"
        ? ` Set vars for the **${vercelEnv}** scope in Vercel, then redeploy (NEXT_PUBLIC_* are baked in at build time).`
        : "";

    throw new Error(
      `Missing Supabase env vars. Need URL (${SUPABASE_URL_ENV_KEYS.join(" or ")}) and anon key (${SUPABASE_ANON_ENV_KEYS.join(" or ")}). Present: url=[${diagnostics.url.present.join(", ") || "none"}], key=[${diagnostics.anonKey.present.join(", ") || "none"}].${vercelHint}`
    );
  }

  return { url, anonKey };
}
