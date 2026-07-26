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
  /** Extra classes for the theme options panel. */
  menuClassName?: string;
  /**
   * When set, renders a full-width labeled row (e.g. "Appearance") and
   * anchors the theme menu to that row so it stacks flush with a parent popover.
   */
  label?: string;
};

function ThemeTriggerIcon({ theme }: { theme: Theme | undefined }) {
  if (theme === "system") return <Monitor className="h-4 w-4" />;
  if (theme === "dark") return <Moon className="h-4 w-4" />;
  return <Sun className="h-4 w-4" />;
}

export function ThemeToggle({
  className,
  variant = "default",
  menuClassName,
  label,
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const iconClassName = cn(
    "inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
    variant === "hero"
      ? "border border-white/20 bg-white/10 text-white hover:bg-white/20"
      : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
    className
  );

  if (!mounted) {
    if (label) {
      return (
        <div className="flex w-full items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className={iconClassName}>
            <Monitor className="h-4 w-4 opacity-0" />
          </span>
        </div>
      );
    }
    return (
      <button type="button" aria-label="Theme" className={iconClassName}>
        <Monitor className="h-4 w-4 opacity-0" />
      </button>
    );
  }

  const activeTheme = (theme ?? "system") as Theme;

  const options = themeOptions.map(({ value, label: optionLabel, icon: Icon }) => {
    const selected = activeTheme === value;
    return (
      <DropdownMenuItem
        key={value}
        onClick={() => setTheme(value)}
        className={cn(
          "gap-1.5 px-2 py-1.5",
          selected && "bg-primary/10 text-primary"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{optionLabel}</span>
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
          {selected ? <Check className="h-4 w-4" /> : null}
        </span>
      </DropdownMenuItem>
    );
  });

  if (label) {
    return (
      <DropdownMenu
        align="start"
        side="top"
        rootClassName="w-full"
        contentClassName={cn("left-0 right-0 w-auto", menuClassName)}
        trigger={
          <div
            role="button"
            tabIndex={0}
            aria-label={`${label}: choose theme`}
            aria-haspopup="menu"
            className="flex w-full cursor-pointer items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 text-sm"
          >
            <span className="text-muted-foreground">{label}</span>
            <span className={iconClassName} aria-hidden>
              <ThemeTriggerIcon theme={activeTheme} />
            </span>
          </div>
        }
      >
        {options}
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu
      align="end"
      side="top"
      contentClassName={menuClassName}
      trigger={
        <button
          type="button"
          aria-label="Choose theme"
          aria-haspopup="menu"
          className={iconClassName}
        >
          <ThemeTriggerIcon theme={activeTheme} />
        </button>
      }
    >
      {options}
    </DropdownMenu>
  );
}
