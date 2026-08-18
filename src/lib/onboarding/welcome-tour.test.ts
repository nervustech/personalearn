import { describe, expect, it, vi } from "vitest";
import {
  WELCOME_TOUR_STORAGE_KEY,
  fetchWelcomeTourCompleted,
  isWelcomeTourCompleteInStorage,
  markWelcomeTourCompleteInStorage,
  persistWelcomeTourCompleted,
  shouldShowWelcomeTour,
  shouldSyncLocalCompletionToProfile,
} from "./welcome-tour";

describe("shouldShowWelcomeTour", () => {
  it("hides until the profile has loaded so returning teachers do not flash the tour", () => {
    expect(
      shouldShowWelcomeTour({
        dismissed: false,
        localCompleted: false,
        dbLoaded: false,
        dbCompleted: false,
      })
    ).toBe(false);
  });

  it("hides when the profile already recorded completion", () => {
    expect(
      shouldShowWelcomeTour({
        dismissed: false,
        localCompleted: false,
        dbLoaded: true,
        dbCompleted: true,
      })
    ).toBe(false);
  });

  it("hides when this browser already completed the tour", () => {
    expect(
      shouldShowWelcomeTour({
        dismissed: false,
        localCompleted: true,
        dbLoaded: true,
        dbCompleted: false,
      })
    ).toBe(false);
  });

  it("shows for a first-timer whose profile has no completion", () => {
    expect(
      shouldShowWelcomeTour({
        dismissed: false,
        localCompleted: false,
        dbLoaded: true,
        dbCompleted: false,
      })
    ).toBe(true);
  });

  it("stays hidden after Skip / Get started in the current session", () => {
    expect(
      shouldShowWelcomeTour({
        dismissed: true,
        localCompleted: false,
        dbLoaded: true,
        dbCompleted: false,
      })
    ).toBe(false);
  });
});

describe("welcome tour storage", () => {
  it("reads and writes the shared localStorage key", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };

    expect(isWelcomeTourCompleteInStorage(storage)).toBe(false);
    markWelcomeTourCompleteInStorage(storage);
    expect(store.get(WELCOME_TOUR_STORAGE_KEY)).toBe("true");
    expect(isWelcomeTourCompleteInStorage(storage)).toBe(true);
  });

  it("treats missing storage as incomplete", () => {
    expect(isWelcomeTourCompleteInStorage(null)).toBe(false);
  });
});

describe("shouldSyncLocalCompletionToProfile", () => {
  it("copies a local completion onto the profile once", () => {
    expect(
      shouldSyncLocalCompletionToProfile({
        localCompleted: true,
        dbCompleted: false,
      })
    ).toBe(true);
  });

  it("does not write when the profile is already complete", () => {
    expect(
      shouldSyncLocalCompletionToProfile({
        localCompleted: true,
        dbCompleted: true,
      })
    ).toBe(false);
  });
});

describe("welcome tour profile persistence", () => {
  it("treats a timestamp as completed", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { welcome_tour_completed_at: "2026-08-18T00:00:00.000Z" },
      error: null,
    });
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      })),
    };

    await expect(
      fetchWelcomeTourCompleted(supabase as never, "teacher-1")
    ).resolves.toBe(true);
  });

  it("treats a null timestamp as not completed", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { welcome_tour_completed_at: null },
      error: null,
    });
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      })),
    };

    await expect(
      fetchWelcomeTourCompleted(supabase as never, "teacher-1")
    ).resolves.toBe(false);
  });

  it("writes completion onto the teacher profile", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const supabase = {
      from: vi.fn(() => ({ update })),
    };

    await persistWelcomeTourCompleted(
      supabase as never,
      "teacher-1",
      "2026-08-18T12:00:00.000Z"
    );

    expect(supabase.from).toHaveBeenCalledWith("users");
    expect(update).toHaveBeenCalledWith({
      welcome_tour_completed_at: "2026-08-18T12:00:00.000Z",
      updated_at: "2026-08-18T12:00:00.000Z",
    });
    expect(eq).toHaveBeenCalledWith("id", "teacher-1");
  });
});
