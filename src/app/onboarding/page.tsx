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
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-teal-200">
          <Sparkles className="h-3.5 w-3.5" />
          Step 1 · Set up your class
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Welcome, teacher!
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-slate-200">
          Create your first class to get started. Every AI feature will be
          tailored to this class context.
        </p>
      </div>

      <ul className="mx-auto flex w-fit flex-col items-center gap-1.5">
        {highlights.map(({ icon: Icon, text }) => (
          <li
            key={text}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-center text-xs text-slate-200 backdrop-blur-sm sm:text-sm"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-teal-300" />
            {text}
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border border-white/25 bg-white/90 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl dark:bg-slate-950/90 sm:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground">
            Create your first class
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Grade, subject, term, and academic year help PersonaLearn tailor
            content to your CBC context.
          </p>
        </div>
        <ClassForm />
      </div>

      <p className="text-center text-xs text-slate-400">
        You can add more classes and import students after this step.
      </p>
    </div>
  );
}
