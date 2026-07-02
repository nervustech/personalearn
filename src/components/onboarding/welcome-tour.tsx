"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOUR_KEY = "personalearn-tour-complete";

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
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(TOUR_KEY) !== "true";
  });
  const [step, setStep] = useState(0);

  if (!visible) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  function finish() {
    localStorage.setItem(TOUR_KEY, "true");
    setVisible(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
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
            onClick={finish}
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
            <Button type="button" size="sm" onClick={finish}>
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
