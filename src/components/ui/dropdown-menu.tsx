"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type DropdownMenuProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  /** Where the panel opens relative to the trigger. Use `top` for bottom tab bars. */
  side?: "top" | "bottom";
  contentClassName?: string;
  /** Classes for the relative positioning wrapper. */
  rootClassName?: string;
};

const DropdownMenuContext = createContext<{ close: () => void } | null>(null);

export function DropdownMenu({
  trigger,
  children,
  align = "end",
  side = "bottom",
  contentClassName,
  rootClassName,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <DropdownMenuContext.Provider value={{ close: () => setOpen(false) }}>
      <div className={cn("relative", rootClassName)} ref={ref}>
        <div onClick={() => setOpen((value) => !value)}>{trigger}</div>
        {open ? (
          <div
            className={cn(
              "absolute z-50 w-max rounded-xl bg-card/95 p-1 shadow-lg backdrop-blur-xl",
              side === "top" ? "bottom-full mb-2" : "top-full mt-2",
              align === "end" ? "right-0" : "left-0",
              contentClassName
            )}
          >
            {children}
          </div>
        ) : null}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuItem({
  className,
  onClick,
  children,
}: {
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const menu = useContext(DropdownMenuContext);

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
        className
      )}
      onClick={() => {
        onClick?.();
        menu?.close();
      }}
    >
      {children}
    </button>
  );
}
