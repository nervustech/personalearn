"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { classSchema, type ClassFormValues } from "@/lib/validations/class";
import { useCreateClass } from "@/lib/hooks/use-classes";
import type { Class } from "@/types/database";

const fieldClass =
  "h-9 rounded-lg px-2.5 py-1.5 shadow-none";

type ClassFormProps = {
  onSuccess?: (created: Class) => void;
  submitLabel?: string;
  redirectOnSuccess?: string | null;
};

export function ClassForm({
  onSuccess,
  submitLabel = "Create class",
  redirectOnSuccess = "/dashboard",
}: ClassFormProps) {
  const router = useRouter();
  const createClass = useCreateClass();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: "",
      grade_level: 1,
      subject: "",
      term: 1,
      academic_year: new Date().getFullYear().toString(),
      section: "",
    },
  });

  async function onSubmit(values: ClassFormValues) {
    try {
      const created = await createClass.mutateAsync(values);
      onSuccess?.(created);
      if (redirectOnSuccess) {
        router.push(redirectOnSuccess);
        router.refresh();
      }
    } catch {
      // mutation error surfaced via createClass.error
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="name">Class name</Label>
        <Input
          id="name"
          placeholder="e.g. Grade 5 Mathematics"
          className={fieldClass}
          {...register("name")}
        />
        {errors.name ? (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="grade_level">Grade</Label>
          <Select id="grade_level" className={fieldClass} {...register("grade_level")}>
            {Array.from({ length: 9 }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="term">Term</Label>
          <Select id="term" className={fieldClass} {...register("term")}>
            <option value={1}>Term 1</option>
            <option value={2}>Term 2</option>
            <option value={3}>Term 3</option>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          placeholder="e.g. Mathematics"
          className={fieldClass}
          {...register("subject")}
        />
        {errors.subject ? (
          <p className="text-xs text-destructive">{errors.subject.message}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-[5.5rem_1fr] gap-3">
        <div className="space-y-2">
          <Label htmlFor="section">Section</Label>
          <Input
            id="section"
            placeholder="A"
            className={fieldClass}
            {...register("section")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="academic_year">Academic year</Label>
          <Input
            id="academic_year"
            placeholder="2026"
            className={fieldClass}
            {...register("academic_year")}
          />
          {errors.academic_year ? (
            <p className="text-xs text-destructive">{errors.academic_year.message}</p>
          ) : null}
        </div>
      </div>

      {createClass.error ? (
        <p className="text-sm text-destructive">{createClass.error.message}</p>
      ) : null}

      <Button type="submit" className="w-full" disabled={createClass.isPending}>
        {createClass.isPending ? "Creating…" : submitLabel}
      </Button>
    </form>
  );
}
