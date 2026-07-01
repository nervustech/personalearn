"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Bot, Home, Menu, School, User, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ClassSelector } from "@/components/classes/class-selector";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/ai-hub", label: "AI Hub", icon: Bot },
  { href: "/classes", label: "Classes", icon: School },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 shadow-xs backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card shadow-xs transition-colors hover:bg-muted md:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href="/dashboard" className="flex items-center gap-2 font-display font-semibold">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <BookOpen className="h-4 w-4 text-primary" />
              </span>
              <span className="hidden sm:inline">PersonaLearn</span>
            </Link>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map(({ href, label }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                  {active ? (
                    <span className="absolute inset-x-3 -bottom-[1.125rem] h-0.5 rounded-full bg-primary" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ClassSelector />
            <ThemeToggle />
            <DropdownMenu
              align="end"
              trigger={
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Account menu"
                >
                  <User className="h-4 w-4" />
                </button>
              }
            >
              <SignOutButton />
            </DropdownMenu>
          </div>
        </div>

        {menuOpen ? (
          <nav className="border-t border-border px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    pathname.startsWith(href)
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
