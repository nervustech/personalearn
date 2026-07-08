"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { StudentForm } from "@/components/classes/student-form";

type AddStudentDialogProps = {
  classId: string;
};

export function AddStudentDialog({ classId }: AddStudentDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => setOpen(true)}
        aria-label="Add student"
        title="Add student"
      >
        <UserPlus className="h-4 w-4" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Add student"
        description="Add one student to this class roster."
      >
        <StudentForm
          classId={classId}
          onSuccess={() => setOpen(false)}
          submitLabel="Add to roster"
        />
      </Dialog>
    </>
  );
}
