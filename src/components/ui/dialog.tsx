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
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
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
        "fixed inset-0 z-50 m-auto w-[calc(100%-2rem)] max-w-md h-fit rounded-2xl border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/60",
        className
      )}
      onClose={() => onOpenChange(false)}
    >
      <div className="flex items-start justify-between border-b border-border px-6 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 w-8 shrink-0 p-0"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="px-6 py-4">{children}</div>
    </dialog>
  );
}
