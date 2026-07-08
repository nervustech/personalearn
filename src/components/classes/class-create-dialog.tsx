"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ClassForm } from "@/components/onboarding/class-form";

type ClassCreateDialogProps = {
  /** Controlled open state (e.g. when trigger lives in a dropdown). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Custom trigger; omit when using controlled mode without a built-in trigger. */
  trigger?: React.ReactNode;
  /** Show default "New class" button when uncontrolled and no custom trigger. */
  showDefaultTrigger?: boolean;
};

export function ClassCreateDialog({
  open: controlledOpen,
  onOpenChange,
  trigger,
  showDefaultTrigger = true,
}: ClassCreateDialogProps) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  function setOpen(next: boolean) {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  return (
    <>
      {trigger ? (
        <span
          role="presentation"
          onClick={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") setOpen(true);
          }}
        >
          {trigger}
        </span>
      ) : showDefaultTrigger && !isControlled ? (
        <Button type="button" onClick={() => setOpen(true)}>
          New class
        </Button>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen} title="Create class">
        <ClassForm
          submitLabel="Create class"
          redirectOnSuccess={null}
          onSuccess={(created) => {
            setOpen(false);
            router.push(`/classes/${created.id}`);
            router.refresh();
          }}
        />
      </Dialog>
    </>
  );
}
