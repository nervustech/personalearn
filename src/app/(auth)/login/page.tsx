import Link from "next/link";
import { Suspense } from "react";
import { BookOpen } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { HeroBackdrop } from "@/components/layout/hero-backdrop";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <HeroBackdrop />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-display font-semibold text-white transition-opacity hover:opacity-90"
        >
          <BookOpen className="h-6 w-6 text-hero-accent" />
          <span>PersonaLearn</span>
        </Link>
        <ThemeToggle variant="hero" />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-12 pt-4">
        <div className="hero-glass w-full max-w-md rounded-2xl p-6 sm:p-8">
          <Suspense
            fallback={
              <p className="text-center text-sm text-muted-foreground">Loading…</p>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
