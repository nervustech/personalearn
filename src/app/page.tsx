import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-2xl text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-primary">
          CBC Educator Co-pilot
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Stop drowning in CBC paperwork
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          PersonaLearn helps Kenyan teachers plan lessons, manage classes, and
          give personalized feedback — grounded in your schemes of work.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/login" className={cn(buttonVariants({ variant: "primary" }))}>
            Get started
          </Link>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
