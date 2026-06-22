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

type ClassFormProps = {
  onSuccess?: () => void;
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
      await createClass.mutateAsync(values);
      onSuccess?.();
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
      <div className="space-y-1.5">
        <Label htmlFor="name">Class name</Label>
        <Input id="name" placeholder="e.g. Grade 5 Mathematics" {...register("name")} />
        {errors.name ? (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="grade_level">Grade level</Label>
          <Select id="grade_level" {...register("grade_level")}>
            {Array.from({ length: 9 }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="term">Term</Label>
          <Select id="term" {...register("term")}>
            <option value={1}>Term 1</option>
            <option value={2}>Term 2</option>
            <option value={3}>Term 3</option>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" placeholder="e.g. Mathematics" {...register("subject")} />
        {errors.subject ? (
          <p className="text-xs text-destructive">{errors.subject.message}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="section">Section (optional)</Label>
          <Input id="section" placeholder="e.g. A" {...register("section")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="academic_year">Academic year</Label>
          <Input id="academic_year" placeholder="2026" {...register("academic_year")} />
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
