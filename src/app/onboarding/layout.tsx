import Link from "next/link";
import { BookOpen } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { HeroBackdrop } from "@/components/layout/hero-backdrop";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="fixed inset-0" aria-hidden>
        <HeroBackdrop blur />
      </div>

      <header className="relative z-20 flex items-center justify-center px-4 py-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-display font-semibold text-white transition-opacity hover:opacity-90"
        >
          <BookOpen className="h-6 w-6 text-hero-accent" />
          <span>PersonaLearn</span>
        </Link>
        <div className="absolute right-4 top-6 flex items-center gap-2">
          <SignOutButton variant="hero" />
          <ThemeToggle variant="hero" />
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-12 pt-2">
        {children}
      </main>
    </div>
  );
}
