"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Optional control rendered before the close button (e.g. download). */
  headerAction?: React.ReactNode;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  headerAction,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "fixed inset-0 z-50 m-auto flex h-fit max-h-[min(92vh,54rem)] w-[calc(100%-2rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/60",
        className
      )}
      onClose={() => onOpenChange(false)}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {headerAction}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
    </dialog>
  );
}
