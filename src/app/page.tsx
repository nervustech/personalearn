import Link from "next/link";
import { BookOpen, Bot, GraduationCap, Users } from "lucide-react";
import { HeroBackdrop } from "@/components/layout/hero-backdrop";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { getLandingCtas } from "@/lib/auth/post-login-path";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

async function getHomeLandingCtas() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return getLandingCtas(false, false);
  }

  const { count } = await supabase
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", user.id)
    .eq("is_active", true);

  return getLandingCtas(true, (count ?? 0) > 0);
}

export default async function HomePage() {
  const ctas = await getHomeLandingCtas();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative min-h-[92vh] overflow-hidden">
        <HeroBackdrop />

        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
          <Link href="/" className="flex items-center gap-2 font-display font-semibold text-white">
            <BookOpen className="h-6 w-6 text-hero-accent" />
            <span>PersonaLearn</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle variant="hero" />
            {ctas.signedIn ? (
              <SignOutButton variant="hero" />
            ) : (
              <Link href={ctas.headerHref} className={cn(buttonVariants({ variant: "hero", size: "sm" }))}>
                {ctas.headerLabel}
              </Link>
            )}
          </div>
        </header>

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col justify-center px-4 pb-20 pt-12 sm:min-h-[calc(92vh-5rem)] sm:pt-0">
          <p className="mb-4 inline-flex w-fit items-center rounded-full border border-hero-accent/30 bg-primary/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-hero-accent">
            CBC Educator Co-pilot
          </p>
          <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
            Teach with clarity.
            <span className="mt-1 block text-hero-accent">Not more paperwork.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-hero-muted">
            PersonaLearn helps Kenyan teachers plan CBC lessons, manage classes,
            and give personalized feedback — grounded in your schemes of work.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={ctas.primaryHref}
              className={cn(buttonVariants({ variant: "hero-primary", size: "lg" }))}
            >
              Get started free
            </Link>
            <Link
              href={ctas.secondaryHref}
              className={cn(buttonVariants({ variant: "hero", size: "lg" }))}
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
                <p className="font-display text-lg font-semibold text-white sm:text-xl">
                  {stat.value}
                </p>
                <p className="text-xs text-hero-muted sm:text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-background px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-semibold">
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
                className="surface-elevated group rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="relative overflow-hidden border-t border-primary/20 bg-primary px-4 py-14 text-primary-foreground">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 100%, rgb(255 255 255 / 0.3), transparent)",
          }}
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
          <div>
            <h2 className="font-display text-2xl font-semibold">
              Ready to reclaim your evenings?
            </h2>
            <p className="mt-2 text-primary-foreground/85">
              Set up your first class in under two minutes.
            </p>
          </div>
          <Link
            href={ctas.footerHref}
            className={cn(
              buttonVariants({ variant: "secondary", size: "lg" }),
              "shrink-0 bg-white text-primary shadow-md hover:bg-white/90"
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
