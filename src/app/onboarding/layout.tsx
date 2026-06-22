import Image from "next/image";
import Link from "next/link";
import { BookOpen } from "lucide-react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -inset-10">
          <Image
            src="/images/hero-classroom.jpg"
            alt=""
            fill
            priority
            className="object-cover object-center blur-sm"
            sizes="100vw"
          />
        </div>
      </div>
      <div className="fixed inset-0 bg-gradient-to-br from-teal-950/88 via-slate-900/82 to-slate-950/90" />
      <div className="fixed inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-teal-900/20" />

      <header className="relative z-10 px-4 py-6">
        <Link
          href="/"
          className="mx-auto flex w-fit items-center justify-center gap-2 font-semibold text-white transition-opacity hover:opacity-90"
        >
          <BookOpen className="h-6 w-6 text-teal-300" />
          <span>PersonaLearn</span>
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-12 pt-2">
        {children}
      </main>
    </div>
  );
}
