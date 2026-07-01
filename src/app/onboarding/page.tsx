import { GraduationCap, Layers, Sparkles } from "lucide-react";
import { ClassForm } from "@/components/onboarding/class-form";

const highlights = [
  {
    icon: GraduationCap,
    text: "Scoped to your CBC grade and subject",
  },
  {
    icon: Layers,
    text: "One place for classes, students, and AI",
  },
  {
    icon: Sparkles,
    text: "Ready for lesson generation in Sprint 2",
  },
];

export default function OnboardingPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-hero-accent/30 bg-primary/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-hero-accent">
          <Sparkles className="h-3.5 w-3.5" />
          Step 1 · Set up your class
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Welcome, teacher!
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-hero-muted">
          Create your first class to get started. Every AI feature will be
          tailored to this class context.
        </p>
      </div>

      <ul className="mx-auto flex w-fit flex-col items-center gap-1.5">
        {highlights.map(({ icon: Icon, text }) => (
          <li
            key={text}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-center text-xs text-hero-muted backdrop-blur-sm sm:text-sm"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-hero-accent" />
            {text}
          </li>
        ))}
      </ul>

      <div className="hero-glass rounded-2xl p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Create your first class
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Grade, subject, term, and academic year help PersonaLearn tailor
            content to your CBC context.
          </p>
        </div>
        <ClassForm />
      </div>

      <p className="text-center text-xs text-hero-muted/70">
        You can add more classes and import students after this step.
      </p>
    </div>
  );
}
