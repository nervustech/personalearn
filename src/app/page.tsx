import Image from "next/image";
import Link from "next/link";
import { BookOpen, Bot, GraduationCap, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: GraduationCap,
    title: "CBC-aligned planning",
    description:
      "Generate lesson notes and activities grounded in your schemes of work and grade level.",
  },
  {
    icon: Users,
    title: "Class-first workflow",
    description:
      "Manage rosters, switch between classes, and keep every student within reach.",
  },
  {
    icon: Bot,
    title: "AI teaching co-pilot",
    description:
      "Get quick answers and feedback tailored to your class — not generic chatbot replies.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative min-h-[92vh] overflow-hidden">
        <Image
          src="/images/hero-classroom.jpg"
          alt="Kenyan teacher engaging students in a bright classroom"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/75 to-slate-900/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-slate-900/30" />

        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-white">
            <BookOpen className="h-6 w-6 text-teal-300" />
            <span>PersonaLearn</span>
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20"
            )}
          >
            Sign in
          </Link>
        </header>

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col justify-center px-4 pb-20 pt-12 sm:min-h-[calc(92vh-5rem)] sm:pt-0">
          <p className="mb-4 inline-flex w-fit items-center rounded-full border border-teal-400/30 bg-teal-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-teal-200">
            CBC Educator Co-pilot
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Teach with clarity.
            <span className="mt-1 block text-teal-300">Not more paperwork.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-200">
            PersonaLearn helps Kenyan teachers plan CBC lessons, manage classes,
            and give personalized feedback — grounded in your schemes of work.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "bg-teal-600 hover:bg-teal-500"
              )}
            >
              Get started free
            </Link>
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20"
              )}
            >
              Open dashboard
            </Link>
          </div>

          <div className="mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-white/15 pt-8">
            {[
              { value: "Grades 1–9", label: "CBC coverage" },
              { value: "Class-scoped", label: "AI context" },
              { value: "Mobile-first", label: "Built for teachers" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-lg font-semibold text-white sm:text-xl">{stat.value}</p>
                <p className="text-xs text-slate-300 sm:text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-background px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Built for how Kenyan teachers actually work
            </h2>
            <p className="mt-3 text-muted-foreground">
              From first class setup to lesson generation — everything stays
              scoped to your active class.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="border-t border-border bg-primary px-4 py-14 text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
          <div>
            <h2 className="text-2xl font-semibold">Ready to reclaim your evenings?</h2>
            <p className="mt-2 text-primary-foreground/80">
              Set up your first class in under two minutes.
            </p>
          </div>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "secondary", size: "lg" }),
              "shrink-0 bg-white text-primary hover:bg-white/90"
            )}
          >
            Start teaching smarter
          </Link>
        </div>
      </section>

      <footer className="px-4 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} PersonaLearn · Nervus Technologies
      </footer>
    </div>
  );
}
