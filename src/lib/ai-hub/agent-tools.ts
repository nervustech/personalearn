import { generateText, tool } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getChatModel } from "@/lib/ai/llm";
import { queryClassResources } from "@/lib/ai/rag";
import type { ClassContext } from "@/lib/ai-hub/class-context";

export const RESOURCE_TYPES = [
  "scheme_of_work",
  "assignment",
  "lesson_notes",
  "marking_scheme",
  "other",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

const resourceTypeSchema = z.enum(RESOURCE_TYPES);

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  scheme_of_work: "scheme of work",
  assignment: "assignment",
  lesson_notes: "lesson notes",
  marking_scheme: "marking scheme",
  other: "learning resource",
};

export type AgentToolDeps = {
  supabase: SupabaseClient;
  classId: string;
  classContext: ClassContext;
};

function userSafeError(message: string) {
  return { error: message };
}

export async function executeSearchClassResources(
  deps: AgentToolDeps,
  input: { query: string }
) {
  try {
    const result = await queryClassResources(
      deps.supabase,
      deps.classId,
      input.query
    );

    return {
      answer: result.answer,
      sources: result.sources.map((source) => ({
        title: source.title,
        resourceId: source.resourceId,
      })),
    };
  } catch {
    return userSafeError(
      "Could not search class resources right now. Please try again."
    );
  }
}

export async function executeGenerateLearningResource(
  deps: AgentToolDeps,
  input: { resourceType: ResourceType; title: string; instructions?: string }
) {
  try {
    const typeLabel = RESOURCE_TYPE_LABELS[input.resourceType];
    const section = deps.classContext.section
      ? `, ${deps.classContext.section}`
      : "";
    const extra = input.instructions?.trim()
      ? `\n\nTeacher instructions:\n${input.instructions.trim()}`
      : "";

    const { text } = await generateText({
      model: getChatModel(),
      system: `You are a CBC teaching assistant for PersonaLearn. Create practical ${typeLabel} content for Kenyan classrooms. Use clear Markdown with headings and bullet lists where helpful. Output only the resource content — no preamble about being an AI.`,
      prompt: `Class: ${deps.classContext.name}${section}
Subject: ${deps.classContext.subject}
Grade: ${deps.classContext.grade_level}
Term: ${deps.classContext.term} (${deps.classContext.academic_year})

Create a ${typeLabel} titled "${input.title}".${extra}`,
    });

    const content = text.trim();
    if (!content) {
      return userSafeError(
        "Could not generate the resource draft. Please try again."
      );
    }

    return {
      title: input.title,
      resourceType: input.resourceType,
      content,
    };
  } catch {
    return userSafeError(
      "Could not generate the resource draft. Please try again."
    );
  }
}

export async function executeListStudents(deps: AgentToolDeps) {
  try {
    const { data, error } = await deps.supabase
      .from("students")
      .select("full_name, admission_number")
      .eq("class_id", deps.classId)
      .order("full_name", { ascending: true });

    if (error) {
      return userSafeError("Could not load the class roster. Please try again.");
    }

    return {
      students: (data ?? []).map((student) => ({
        fullName: student.full_name as string,
        admissionNumber: (student.admission_number as string | null) ?? null,
      })),
    };
  } catch {
    return userSafeError("Could not load the class roster. Please try again.");
  }
}

export function createAgentTools(deps: AgentToolDeps) {
  return {
    search_class_resources: tool({
      description:
        "Search the teacher's uploaded class resources and return an answer with source titles. Use when the teacher asks about their scheme of work, notes, or other uploaded materials.",
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe("The question to answer from class resources"),
      }),
      execute: async (input) => executeSearchClassResources(deps, input),
    }),
    generate_learning_resource: tool({
      description:
        "Generate a draft learning resource (scheme of work, assignment, lesson notes, marking scheme, or other). Returns markdown content only — never saves automatically.",
      inputSchema: z.object({
        resourceType: resourceTypeSchema.describe("Type of resource to generate"),
        title: z.string().min(1).describe("Title for the draft resource"),
        instructions: z
          .string()
          .optional()
          .describe("Optional teacher instructions or constraints"),
      }),
      execute: async (input) => executeGenerateLearningResource(deps, input),
    }),
    list_students: tool({
      description:
        "List students in the active class roster with names and admission numbers. Use when the teacher asks about their students or class size.",
      inputSchema: z.object({}),
      execute: async () => executeListStudents(deps),
    }),
  };
}
