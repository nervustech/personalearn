import { describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { ensureUserProfile } from "./ensure-user-profile";

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: "teacher-1",
    email: "teacher@school.ke",
    app_metadata: {},
    user_metadata: { full_name: "Jane Wanjiku" },
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as User;
}

function createMockSupabase(options: {
  existing?: boolean;
  selectError?: Error | null;
  insertError?: Error | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.existing ? { id: "teacher-1" } : null,
    error: options.selectError ?? null,
  });
  const insert = vi.fn().mockResolvedValue({
    error: options.insertError ?? null,
  });

  const from = vi.fn(() => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ maybeSingle }),
    }),
    insert,
  }));

  return { from, insert, maybeSingle };
}

describe("ensureUserProfile", () => {
  it("inserts a profile when one does not exist", async () => {
    const supabase = createMockSupabase({ existing: false });

    await ensureUserProfile(supabase as never, createUser());

    expect(supabase.insert).toHaveBeenCalledWith({
      id: "teacher-1",
      full_name: "Jane Wanjiku",
      email: "teacher@school.ke",
      phone: null,
    });
  });

  it("does not insert when a profile already exists", async () => {
    const supabase = createMockSupabase({ existing: true });

    await ensureUserProfile(supabase as never, createUser());

    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("throws when the account has no email", async () => {
    const supabase = createMockSupabase({ existing: false });

    await expect(
      ensureUserProfile(
        supabase as never,
        createUser({ email: undefined, user_metadata: {} })
      )
    ).rejects.toThrow("Your account is missing an email");
  });

  it("falls back to metadata name and email prefix for display name", async () => {
    const supabase = createMockSupabase({ existing: false });

    await ensureUserProfile(
      supabase as never,
      createUser({
        user_metadata: { name: "Metadata Name" },
        email: "metadata@school.ke",
      })
    );

    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: "Metadata Name" })
    );
  });
});
