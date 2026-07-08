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
        onClick={() => setOpen(true)}
      >
        <UserPlus className="h-4 w-4" />
        Add student
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
