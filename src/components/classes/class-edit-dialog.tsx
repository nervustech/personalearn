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

const fieldClass = "h-9 rounded-lg px-2.5 py-1.5 shadow-none";

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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-label="Edit class"
        title="Edit class"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Edit class"
        description="Update class details or archive this class."
        className="max-w-sm"
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor={`name-${cls.id}`}>Class name</Label>
            <Input
              id={`name-${cls.id}`}
              className={fieldClass}
              {...register("name")}
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`grade-${cls.id}`}>Grade</Label>
              <Select
                id={`grade-${cls.id}`}
                className={fieldClass}
                {...register("grade_level")}
              >
                {Array.from({ length: 9 }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`term-${cls.id}`}>Term</Label>
              <Select
                id={`term-${cls.id}`}
                className={fieldClass}
                {...register("term")}
              >
                <option value={1}>Term 1</option>
                <option value={2}>Term 2</option>
                <option value={3}>Term 3</option>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`subject-${cls.id}`}>Subject</Label>
            <Input
              id={`subject-${cls.id}`}
              className={fieldClass}
              {...register("subject")}
            />
          </div>

          <div className="grid grid-cols-[5.5rem_1fr] gap-3">
            <div className="space-y-2">
              <Label htmlFor={`section-${cls.id}`}>Section</Label>
              <Input
                id={`section-${cls.id}`}
                className={fieldClass}
                {...register("section")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`year-${cls.id}`}>Academic year</Label>
              <Input
                id={`year-${cls.id}`}
                className={fieldClass}
                {...register("academic_year")}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="text-destructive"
              onClick={handleArchive}
              disabled={archiveClass.isPending}
            >
              Archive class
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={updateClass.isPending}>
                Save
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </>
  );
}
