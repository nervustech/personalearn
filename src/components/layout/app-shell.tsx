"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Menu, MoreHorizontal, School, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/layout/brand-mark";
import { ClassSelector } from "@/components/classes/class-selector";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/ai-hub", label: "AI Hub", icon: WandSparkles },
  { href: "/classes", label: "Classes", icon: School },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/";
  }
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [railExpanded, setRailExpanded] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="min-h-screen bg-background md:flex print:block print:bg-white">
      {/* Desktop left rail — fixed width; only the center nav cube expands */}
      <aside className="sticky top-0 z-40 hidden h-screen w-[4.5rem] shrink-0 flex-col items-center py-3 md:flex print:hidden">
        <Link
          href="/dashboard"
          title="PersonaLearn"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"
        >
          <BrandMark className="h-4 w-4" />
        </Link>

        {/* Vertically centered nav cube — expands right over content on hover */}
        <div className="relative flex min-h-0 w-full flex-1 items-center">
          <nav
            className={cn(
              "absolute left-2 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-1 overflow-hidden rounded-3xl bg-card/95 p-2 shadow-lg backdrop-blur-xl transition-[width] duration-200",
              railExpanded ? "w-52" : "w-14"
            )}
            onMouseEnter={() => setRailExpanded(true)}
            onMouseLeave={() => setRailExpanded(false)}
          >
            <div
              className={cn(
                "mb-1 transition-opacity",
                railExpanded
                  ? "opacity-100"
                  : "pointer-events-none h-0 overflow-hidden opacity-0"
              )}
            >
              <ClassSelector />
            </div>

            {navItems.map(({ href, label, icon: Icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-2xl px-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span
                    className={cn(
                      "truncate transition-opacity",
                      railExpanded ? "opacity-100" : "sr-only opacity-0"
                    )}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="relative" ref={moreRef}>
          <button
            type="button"
            title="More"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "inline-flex h-11 w-11 items-center justify-center rounded-2xl transition-colors",
              moreOpen
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Menu className="h-5 w-5" />
          </button>
          {moreOpen ? (
            <div className="absolute bottom-0 left-full z-50 ml-2 w-40 rounded-2xl bg-card/95 p-1 shadow-lg backdrop-blur-xl">
              <ThemeToggle
                label="Appearance"
                className="h-8 w-8 shrink-0"
                menuClassName="-left-1 -right-1 w-auto"
              />
              <div className="my-0.5 h-px bg-border/60" />
              <SignOutButton className="gap-1.5 px-2 py-1.5" />
            </div>
          ) : null}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-20 md:pb-0 print:min-h-0 print:pb-0">
        {/* Mobile top strip: class selector only */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-background/80 px-4 py-3 backdrop-blur-xl md:hidden print:hidden">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 font-display text-sm font-semibold"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BrandMark className="h-4 w-4" />
            </span>
            PersonaLearn
          </Link>
          <ClassSelector />
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8 print:max-w-none print:px-0 print:py-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 bg-background/90 px-2 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-8px_24px_rgb(0_0_0_/0.06)] backdrop-blur-xl md:hidden print:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
          <DropdownMenu
            align="end"
            side="top"
            trigger={
              <button
                type="button"
                className="flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-[11px] font-medium text-muted-foreground"
                aria-label="More"
              >
                <MoreHorizontal className="h-5 w-5" />
                More
              </button>
            }
          >
            <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm">
              <span className="text-muted-foreground">Appearance</span>
              <ThemeToggle />
            </div>
            <div className="my-1 h-px bg-border/60" />
            <SignOutButton />
          </DropdownMenu>
        </div>
      </nav>
    </div>
  );
}
