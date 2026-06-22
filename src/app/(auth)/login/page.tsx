import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpen } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Image
        src="/images/hero-classroom.jpg"
        alt=""
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-900/80 to-slate-900/50" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-slate-900/40" />

      <header className="relative z-10 px-4 py-6">
        <Link
          href="/"
          className="mx-auto flex w-fit items-center gap-2 font-semibold text-white transition-opacity hover:opacity-90"
        >
          <BookOpen className="h-6 w-6 text-teal-300" />
          <span>PersonaLearn</span>
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-12 pt-4">
        <div className="w-full max-w-md rounded-2xl border border-white/25 bg-white/90 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl dark:bg-slate-950/90 sm:p-8">
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
