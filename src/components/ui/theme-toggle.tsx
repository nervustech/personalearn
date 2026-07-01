"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

type ThemeToggleProps = {
  className?: string;
  variant?: "default" | "hero";
};

function ThemeTriggerIcon({ theme }: { theme: Theme | undefined }) {
  if (theme === "system") return <Monitor className="h-4 w-4" />;
  if (theme === "dark") return <Moon className="h-4 w-4" />;
  return <Sun className="h-4 w-4" />;
}

export function ThemeToggle({ className, variant = "default" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const triggerClassName = cn(
    "inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
    variant === "hero"
      ? "border border-white/20 bg-white/10 text-white hover:bg-white/20"
      : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
    className
  );

  if (!mounted) {
    return (
      <button type="button" aria-label="Theme" className={triggerClassName}>
        <Monitor className="h-4 w-4 opacity-0" />
      </button>
    );
  }

  const activeTheme = (theme ?? "system") as Theme;

  return (
    <DropdownMenu
      align="end"
      trigger={
        <button
          type="button"
          aria-label="Choose theme"
          aria-haspopup="menu"
          className={triggerClassName}
        >
          <ThemeTriggerIcon theme={activeTheme} />
        </button>
      }
    >
      {themeOptions.map(({ value, label, icon: Icon }) => {
        const selected = activeTheme === value;
        return (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              "gap-2",
              selected && "bg-primary/10 text-primary"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
          </DropdownMenuItem>
        );
      })}
    </DropdownMenu>
  );
}
