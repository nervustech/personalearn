"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchWelcomeTourCompleted,
  isWelcomeTourCompleteInStorage,
  markWelcomeTourCompleteInStorage,
  persistWelcomeTourCompleted,
  shouldShowWelcomeTour,
  shouldSyncLocalCompletionToProfile,
} from "@/lib/onboarding/welcome-tour";
import { createClient } from "@/lib/supabase/client";

const steps = [
  {
    title: "Welcome to PersonaLearn",
    body: "Your AI co-pilot for CBC lesson planning, resources, and student feedback.",
  },
  {
    title: "Active class",
    body: "Everything is scoped to your active class. Switch classes from the pill in the header.",
  },
  {
    title: "Manage students",
    body: "Add students manually or import a CSV from the Classes page.",
  },
  {
    title: "AI Hub",
    body: "Upload a .txt scheme on your class page, then ask the co-pilot in AI Hub.",
  },
];

export function WelcomeTour() {
  const [localCompleted] = useState(() =>
    isWelcomeTourCompleteInStorage(
      typeof window === "undefined" ? null : window.localStorage
    )
  );
  const [dbLoaded, setDbLoaded] = useState(false);
  const [dbCompleted, setDbCompleted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setDbCompleted(true);
          setDbLoaded(true);
        }
        return;
      }

      try {
        const completed = await fetchWelcomeTourCompleted(supabase, user.id);
        if (cancelled) return;

        setDbCompleted(completed);
        setDbLoaded(true);

        if (
          shouldSyncLocalCompletionToProfile({
            localCompleted,
            dbCompleted: completed,
          })
        ) {
          await persistWelcomeTourCompleted(supabase, user.id);
          if (!cancelled) setDbCompleted(true);
        }
      } catch {
        if (!cancelled) {
          setDbCompleted(localCompleted);
          setDbLoaded(true);
        }
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [localCompleted]);

  const visible = shouldShowWelcomeTour({
    dismissed,
    localCompleted,
    dbLoaded,
    dbCompleted,
  });

  if (!visible) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  async function finish() {
    markWelcomeTourCompleteInStorage(window.localStorage);
    setDismissed(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await persistWelcomeTourCompleted(supabase, user.id);
    } catch {
      // localStorage still hides the tour on this browser
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-card/95 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-primary">
              Step {step + 1} of {steps.length}
            </p>
            <h2 className="mt-1 text-lg font-semibold">{current.title}</h2>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            onClick={() => void finish()}
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{current.body}</p>
        <div className="mt-6 flex justify-between gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            Back
          </Button>
          {isLast ? (
            <Button type="button" size="sm" onClick={() => void finish()}>
              Get started
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={() => setStep((s) => s + 1)}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
