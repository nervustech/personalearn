import { generateText, tool } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getChatModel } from "@/lib/ai/llm";
import { ingestTxtResource } from "@/lib/ai/ingest-resource";
import { queryClassResources } from "@/lib/ai/rag";
import type { ClassContext } from "@/lib/ai-hub/class-context";
import {
  ensureAssessmentForGradableResource,
  shouldPublishAssessment,
} from "@/lib/evaluation/create-assessment-from-resource";
import type { GradableResourceType } from "@/lib/evaluation/gradable";

export const RESOURCE_TYPES = [
  "scheme_of_work",
  "assignment",
  "lesson_notes",
  "marking_scheme",
  "quiz",
  "examination",
  "other",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

const resourceTypeSchema = z.enum(RESOURCE_TYPES);

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  scheme_of_work: "scheme of work",
  assignment: "assignment",
  lesson_notes: "lesson notes",
  marking_scheme: "marking scheme",
  quiz: "quiz",
  examination: "examination",
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

export function sanitizeResourceFileName(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${base || "resource"}.txt`;
}

export async function executeSaveResource(
  deps: AgentToolDeps,
  input: {
    title: string;
    resourceType: ResourceType;
    content: string;
    teacherConfirmed: true;
  }
) {
  if (input.teacherConfirmed !== true) {
    return userSafeError("Save requires explicit teacher confirmation.");
  }

  const content = input.content.trim();
  if (!content) {
    return userSafeError("Cannot save an empty resource. Please try again.");
  }

  try {
    const fileName = sanitizeResourceFileName(input.title);
    const title = input.title.trim();
    const result = await ingestTxtResource(deps.supabase, {
      classId: deps.classId,
      fileName,
      text: content,
      title,
      aiGenerated: true,
      resourceType: input.resourceType,
    });

    let assessmentId: string | undefined;
    if (shouldPublishAssessment(input.resourceType)) {
      const linked = await ensureAssessmentForGradableResource(deps.supabase, {
        classId: deps.classId,
        resourceId: result.resourceId,
        title,
        resourceType: input.resourceType as GradableResourceType,
      });
      assessmentId = linked.assessmentId;
    }

    return {
      saved: true,
      resourceId: result.resourceId,
      title,
      resourceType: input.resourceType,
      chunkCount: result.chunkCount,
      ...(assessmentId ? { assessmentId } : {}),
    };
  } catch {
    return userSafeError("Could not save the resource. Please try again.");
  }
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
        "Generate a draft learning resource (scheme of work, assignment, lesson notes, marking scheme, quiz, examination, or other). Returns markdown content only — never saves automatically. After showing a draft, offer to save or revise based on teacher feedback.",
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
    save_resource: tool({
      description:
        "Persist the final draft resource to the class library and ingest for RAG. Only call after the teacher has explicitly confirmed they want to save the latest draft (e.g. 'yes, save it'). Never call immediately after generating or while the teacher is still requesting revisions.",
      inputSchema: z.object({
        title: z.string().min(1).describe("Title for the saved resource"),
        resourceType: resourceTypeSchema.describe("Type of resource being saved"),
        content: z
          .string()
          .min(1)
          .describe("Full markdown content of the latest approved draft"),
        teacherConfirmed: z
          .literal(true)
          .describe(
            "Must be true only after the teacher explicitly confirms save in this conversation"
          ),
      }),
      execute: async (input) => executeSaveResource(deps, input),
    }),
  };
}
