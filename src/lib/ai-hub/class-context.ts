import type { SupabaseClient } from "@supabase/supabase-js";

export type ClassContext = {
  id: string;
  name: string;
  subject: string;
  grade_level: number;
  term: number;
  section: string | null;
  academic_year: string;
};

export async function getClassContext(
  supabase: SupabaseClient,
  classId: string
): Promise<ClassContext> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, subject, grade_level, term, section, academic_year")
    .eq("id", classId)
    .single();

  if (error || !data) {
    throw new Error("Class not found");
  }

  return data as ClassContext;
}

export function buildClassAssistantSystemPrompt(classContext: ClassContext): string {
  const section = classContext.section ? `, ${classContext.section}` : "";

  return `You are a CBC teaching assistant for PersonaLearn. The teacher is working in their active class — you already know the class details below. Never ask which class, grade, or subject they teach.

Active class:
- Name: ${classContext.name}${section}
- Subject: ${classContext.subject}
- Grade: ${classContext.grade_level}
- Term: ${classContext.term} (${classContext.academic_year})

Help with lesson planning, schemes of work, assignments, student feedback, and class resources. Be practical and concise.

Format replies with Markdown:
- Use **bold** for key terms and headings
- Use ## for section headings when structuring longer answers
- Use bullet lists (- item) for steps or options
- Do not wrap labels in literal asterisks without proper markdown syntax

Class resource search and content generation tools will be available in a future update.`;
}
