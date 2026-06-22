"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { classSchema, type ClassFormValues } from "@/lib/validations/class";
import { useArchiveClass, useUpdateClass } from "@/lib/hooks/use-classes";
import type { Class } from "@/types/database";

export function ClassEditDialog({ cls }: { cls: Class }) {
  const [open, setOpen] = useState(false);
  const updateClass = useUpdateClass();
  const archiveClass = useArchiveClass();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: cls.name,
      grade_level: cls.grade_level,
      subject: cls.subject,
      term: cls.term,
      academic_year: cls.academic_year,
      section: cls.section ?? "",
    },
  });

  async function onSubmit(values: ClassFormValues) {
    await updateClass.mutateAsync({ classId: cls.id, values });
    setOpen(false);
  }

  async function handleArchive() {
    if (!confirm(`Archive "${cls.name}"? Students will remain but the class will be hidden.`)) {
      return;
    }
    await archiveClass.mutateAsync(cls.id);
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="mr-2 h-4 w-4" />
        Edit
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Edit class"
        description="Update class details or archive this class."
      >
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-1.5">
            <Label htmlFor={`name-${cls.id}`}>Class name</Label>
            <Input id={`name-${cls.id}`} {...register("name")} />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Grade</Label>
              <Select {...register("grade_level")}>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Term</Label>
              <Select {...register("term")}>
                <option value={1}>Term 1</option>
                <option value={2}>Term 2</option>
                <option value={3}>Term 3</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input {...register("subject")} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Section</Label>
              <Input {...register("section")} />
            </div>
            <div className="space-y-1.5">
              <Label>Academic year</Label>
              <Input {...register("academic_year")} />
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="text-destructive"
              onClick={handleArchive}
              disabled={archiveClass.isPending}
            >
              Archive class
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateClass.isPending}>
                Save
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </>
  );
}
