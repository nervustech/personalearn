import { studentSchema, type StudentFormValues } from "@/lib/validations/class";

export type ParseStudentRowsResult =
  | { ok: true; students: StudentFormValues[] }
  | { ok: false; errors: string[] };

function normalizeGender(value: string | undefined): "Male" | "Female" | undefined {
  const trimmed = value?.trim();
  if (trimmed === "Male" || trimmed === "Female") {
    return trimmed;
  }
  return undefined;
}

export function parseStudentRows(rows: Record<string, string>[]): ParseStudentRowsResult {
  const students: StudentFormValues[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const candidate = {
      full_name: row.full_name?.trim() ?? "",
      admission_number: row.admission_number?.trim() || undefined,
      gender: normalizeGender(row.gender),
    };

    const result = studentSchema.safeParse(candidate);
    if (result.success) {
      students.push(result.data);
    } else {
      errors.push(`Row ${index + 2}: ${result.error.errors[0]?.message}`);
    }
  });

  if (errors.length) {
    return { ok: false, errors };
  }

  return { ok: true, students };
}
