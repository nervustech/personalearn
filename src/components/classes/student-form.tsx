"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { studentSchema, type StudentFormValues } from "@/lib/validations/class";
import { useCreateStudent } from "@/lib/hooks/use-classes";

type StudentFormProps = {
  classId: string;
  onSuccess?: () => void;
  submitLabel?: string;
};

export function StudentForm({
  classId,
  onSuccess,
  submitLabel = "Add student",
}: StudentFormProps) {
  const createStudent = useCreateStudent(classId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: { full_name: "", admission_number: "", gender: undefined },
  });

  async function onSubmit(values: StudentFormValues) {
    await createStudent.mutateAsync(values);
    reset();
    onSuccess?.();
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-1.5">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" {...register("full_name")} />
        {errors.full_name ? (
          <p className="text-xs text-destructive">{errors.full_name.message}</p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="admission_number">Admission no. (optional)</Label>
          <Input id="admission_number" {...register("admission_number")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gender">Gender (optional)</Label>
          <Select id="gender" defaultValue="" {...register("gender")}>
            <option value="">—</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </Select>
        </div>
      </div>
      {createStudent.error ? (
        <p className="text-sm text-destructive">{createStudent.error.message}</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={createStudent.isPending}>
          {createStudent.isPending ? "Adding…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
