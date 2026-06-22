"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Bot, Home, Menu, School, User, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useActiveClassStore } from "@/lib/store/active-class";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/ai-hub", label: "AI Hub", icon: Bot },
  { href: "/classes", label: "Classes", icon: School },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeClass = useActiveClassStore((state) => state.activeClass);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border md:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="hidden sm:inline">PersonaLearn</span>
            </Link>
          </div>

          <div className="hidden items-center gap-6 md:flex">
            {navItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  pathname.startsWith(href) ? "text-primary" : "text-muted-foreground"
                )}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground sm:block">
              {activeClass ? activeClass.name : "No active class"}
            </div>
            <DropdownMenu
              align="end"
              trigger={
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-muted"
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
            <div className="flex flex-col gap-2">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
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

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
