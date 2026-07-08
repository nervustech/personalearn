import type { Resource, Student } from "@/types/database";
import { formatResourceType } from "@/lib/resources/format";

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function filterResourcesByQuery(
  resources: Resource[],
  query: string
): Resource[] {
  const q = normalize(query);
  if (!q) return resources;

  return resources.filter((resource) => {
    const haystack = [
      resource.title,
      formatResourceType(resource.resource_type),
      resource.ai_generated ? "ai-generated" : "uploaded",
      resource.ai_generated ? "ai" : "upload",
      resource.resource_type ?? "",
    ]
      .map(normalize)
      .join(" ");

    return haystack.includes(q);
  });
}

export function filterStudentsByQuery(
  students: Student[],
  query: string
): Student[] {
  const q = normalize(query);
  if (!q) return students;

  return students.filter((student) => {
    const haystack = [
      student.full_name,
      student.admission_number,
      student.gender,
    ]
      .map(normalize)
      .join(" ");

    return haystack.includes(q);
  });
}
