"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ClassForm } from "@/components/onboarding/class-form";

export function ClassCreateDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        New class
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Create class">
        <ClassForm
          submitLabel="Create class"
          redirectOnSuccess={null}
          onSuccess={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
