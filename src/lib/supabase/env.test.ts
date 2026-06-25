import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseEnv, getSupabaseEnvDiagnostics } from "./env";

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
] as const;

function clearSupabaseEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe("getSupabaseEnv", () => {
  afterEach(() => {
    clearSupabaseEnv();
  });

  it("reads NEXT_PUBLIC vars", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    expect(getSupabaseEnv()).toEqual({
      url: "https://test.supabase.co",
      anonKey: "anon-key",
    });
  });

  it("falls back to runtime server env vars", () => {
    process.env.SUPABASE_URL = "https://runtime.supabase.co";
    process.env.SUPABASE_ANON_KEY = "runtime-anon";

    expect(getSupabaseEnv()).toEqual({
      url: "https://runtime.supabase.co",
      anonKey: "runtime-anon",
    });
  });

  it("prefers NEXT_PUBLIC url over SUPABASE_URL", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://public.supabase.co";
    process.env.SUPABASE_URL = "https://runtime.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    expect(getSupabaseEnv().url).toBe("https://public.supabase.co");
  });

  it("throws with diagnostics when vars are missing", () => {
    expect(() => getSupabaseEnv()).toThrow(/Present: url=\[none\]/);
    expect(getSupabaseEnvDiagnostics().configured).toBe(false);
  });

  it("trims whitespace from values", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "  https://test.supabase.co  ";
    process.env.NEXT_PUBLIC_PUBLISHABLE_KEY = "  publishable-key  ";

    expect(getSupabaseEnv()).toEqual({
      url: "https://test.supabase.co",
      anonKey: "publishable-key",
    });
  });
});
