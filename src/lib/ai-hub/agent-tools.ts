import { generateImage, generateText, tool } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getChatModel } from "@/lib/ai/llm";
import { ingestResource, ingestTxtResource } from "@/lib/ai/ingest-resource";
import { queryClassResources } from "@/lib/ai/rag";
import { getImageGenerationModel } from "@/lib/ai/vision-model";
import type { ClassContext } from "@/lib/ai-hub/class-context";
import {
  createAgentDraft,
  downloadDraftImageBytes,
  getAgentDraft,
  markAgentDraftSaved,
  updateAgentDraft,
  uploadDraftImageBytes,
  type AgentDraft,
} from "@/lib/ai-hub/drafts";
import { createEvaluationBatch } from "@/lib/evaluation/batches";
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
  "teaching_aid",
  "other",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** Types the text generator may produce (teaching aids use image gen). */
const GENERATABLE_RESOURCE_TYPES = [
  "scheme_of_work",
  "assignment",
  "lesson_notes",
  "marking_scheme",
  "quiz",
  "examination",
  "other",
] as const;

const generatableResourceTypeSchema = z.enum(GENERATABLE_RESOURCE_TYPES);

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  scheme_of_work: "scheme of work",
  assignment: "assignment",
  lesson_notes: "lesson notes",
  marking_scheme: "marking scheme",
  quiz: "quiz",
  examination: "examination",
  teaching_aid: "teaching aid",
  other: "learning resource",
};

const genderSchema = z.enum(["Male", "Female"]);

export type AgentToolDeps = {
  supabase: SupabaseClient;
  classId: string;
  teacherId: string;
  classContext: ClassContext;
};

function userSafeError(message: string) {
  return { error: message };
}

function extensionFromMime(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

export function sanitizeResourceFileName(title: string, extension = "txt"): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${base || "resource"}.${extension}`;
}

function draftPreview(draft: AgentDraft) {
  return {
    draftId: draft.id,
    title: draft.title,
    resourceType: draft.resource_type,
    kind: draft.kind,
    content: draft.kind === "text" ? (draft.content_text ?? "") : undefined,
    prompt:
      draft.kind === "image"
        ? ((draft.metadata.prompt as string | undefined) ?? draft.content_text)
        : undefined,
    mimeType: draft.mime_type,
  };
}

export async function executeSaveResource(
  deps: AgentToolDeps,
  input: {
    draftId: string;
    teacherConfirmed: true;
  }
) {
  if (input.teacherConfirmed !== true) {
    return userSafeError("Save requires explicit teacher confirmation.");
  }

  try {
    const draft = await getAgentDraft(deps.supabase, {
      draftId: input.draftId,
      classId: deps.classId,
      teacherId: deps.teacherId,
    });

    if (!draft) {
      return userSafeError("Draft not found. Generate a new draft and try again.");
    }

    if (draft.status === "saved") {
      return userSafeError("This draft was already saved.");
    }

    const title = draft.title.trim();
    const resourceType = draft.resource_type as ResourceType;

    if (draft.kind === "text") {
      const content = (draft.content_text ?? "").trim();
      if (!content) {
        return userSafeError("Cannot save an empty resource. Please try again.");
      }

      const result = await ingestTxtResource(deps.supabase, {
        classId: deps.classId,
        fileName: sanitizeResourceFileName(title),
        text: content,
        title,
        aiGenerated: true,
        resourceType,
      });

      let assessmentId: string | undefined;
      if (shouldPublishAssessment(resourceType)) {
        const linked = await ensureAssessmentForGradableResource(deps.supabase, {
          classId: deps.classId,
          resourceId: result.resourceId,
          title,
          resourceType: resourceType as GradableResourceType,
        });
        assessmentId = linked.assessmentId;
      }

      await markAgentDraftSaved(deps.supabase, {
        draftId: draft.id,
        classId: deps.classId,
        teacherId: deps.teacherId,
      });

      return {
        saved: true,
        resourceId: result.resourceId,
        draftId: draft.id,
        title,
        resourceType,
        chunkCount: result.chunkCount,
        ...(assessmentId ? { assessmentId } : {}),
      };
    }

    // Image teaching aid — exact stored bytes, never re-generated
    if (!draft.storage_path || !draft.mime_type) {
      return userSafeError(
        "Image draft is incomplete. Generate a new teaching image and try again."
      );
    }

    const imageBytes = await downloadDraftImageBytes(
      deps.supabase,
      draft.storage_path
    );
    const extension = extensionFromMime(draft.mime_type);
    const prompt =
      (draft.metadata.prompt as string | undefined) ??
      draft.content_text ??
      title;
    const ragText = `Teaching aid: ${title}\n\nPrompt: ${prompt}`;

    const result = await ingestResource(deps.supabase, {
      classId: deps.classId,
      fileName: sanitizeResourceFileName(title, extension),
      text: ragText,
      mimeType: draft.mime_type,
      fileBytes: imageBytes,
      title,
      aiGenerated: true,
      resourceType: "teaching_aid",
    });

    await markAgentDraftSaved(deps.supabase, {
      draftId: draft.id,
      classId: deps.classId,
      teacherId: deps.teacherId,
    });

    return {
      saved: true,
      resourceId: result.resourceId,
      draftId: draft.id,
      title,
      resourceType: "teaching_aid" as const,
      chunkCount: result.chunkCount,
    };
  } catch {
    return userSafeError("Could not save the resource. Please try again.");
  }
}

export async function executeUpdateDraft(
  deps: AgentToolDeps,
  input: { draftId: string; title?: string; content?: string }
) {
  if (input.title === undefined && input.content === undefined) {
    return userSafeError("Provide a title and/or content to update the draft.");
  }

  try {
    const existing = await getAgentDraft(deps.supabase, {
      draftId: input.draftId,
      classId: deps.classId,
      teacherId: deps.teacherId,
    });

    if (!existing) {
      return userSafeError("Draft not found.");
    }

    if (existing.status !== "pending") {
      return userSafeError("Only pending drafts can be edited.");
    }

    if (existing.kind === "image" && input.content !== undefined) {
      return userSafeError(
        "Image draft pixels cannot be edited in chat. Generate a new image instead."
      );
    }

    const draft = await updateAgentDraft(deps.supabase, {
      draftId: input.draftId,
      classId: deps.classId,
      teacherId: deps.teacherId,
      title: input.title,
      contentText: input.content,
    });

    return {
      updated: true,
      ...draftPreview(draft),
    };
  } catch {
    return userSafeError("Could not update the draft. Please try again.");
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
  input: {
    resourceType: (typeof GENERATABLE_RESOURCE_TYPES)[number];
    title: string;
    instructions?: string;
  }
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

    const draft = await createAgentDraft(deps.supabase, {
      classId: deps.classId,
      teacherId: deps.teacherId,
      kind: "text",
      title: input.title,
      resourceType: input.resourceType,
      contentText: content,
      metadata: {
        instructions: input.instructions?.trim() || null,
      },
    });

    return {
      draftId: draft.id,
      title: draft.title,
      resourceType: draft.resource_type,
      content,
    };
  } catch {
    return userSafeError(
      "Could not generate the resource draft. Please try again."
    );
  }
}

export async function executeGenerateTeachingImage(
  deps: AgentToolDeps,
  input: { title: string; prompt: string }
) {
  try {
    const prompt = input.prompt.trim();
    if (!prompt) {
      return userSafeError("Provide a clear image prompt.");
    }

    let imageModel;
    try {
      imageModel = getImageGenerationModel();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Image generation unavailable.";
      if (message.includes("GOOGLE_GENERATIVE_AI_API_KEY")) {
        return userSafeError(
          "Image generation is not configured. Set GOOGLE_GENERATIVE_AI_API_KEY on the server."
        );
      }
      return userSafeError(message);
    }

    const section = deps.classContext.section
      ? `, ${deps.classContext.section}`
      : "";
    const enrichedPrompt = `Educational teaching aid for Kenyan CBC classroom.
Class: ${deps.classContext.name}${section}
Subject: ${deps.classContext.subject}
Grade: ${deps.classContext.grade_level}
Title: ${input.title}

${prompt}

Style: clear, age-appropriate diagram or illustration suitable for printing or projecting. No watermarks or logos.`;

    const { image } = await generateImage({
      model: imageModel,
      prompt: enrichedPrompt,
    });

    const mimeType = image.mediaType || "image/png";
    const extension = extensionFromMime(mimeType);
    const draftId = crypto.randomUUID();
    const storagePath = await uploadDraftImageBytes(deps.supabase, {
      classId: deps.classId,
      draftId,
      bytes: image.uint8Array,
      mimeType,
      extension,
    });

    const { data, error } = await deps.supabase
      .from("ai_hub_drafts")
      .insert({
        id: draftId,
        class_id: deps.classId,
        teacher_id: deps.teacherId,
        kind: "image",
        title: input.title.trim(),
        resource_type: "teaching_aid",
        content_text: prompt,
        storage_path: storagePath,
        mime_type: mimeType,
        metadata: {
          prompt,
          kind: "teaching_aid",
          nonGradable: true,
        },
        status: "pending",
      })
      .select("*")
      .single();

    if (error || !data) {
      await deps.supabase.storage.from("resources").remove([storagePath]);
      return userSafeError(
        "Could not store the image draft. Please try again."
      );
    }

    const draft = data as AgentDraft;

    return {
      draftId: draft.id,
      title: draft.title,
      resourceType: "teaching_aid" as const,
      prompt,
      mimeType,
      note: "Image draft stored server-side. Ask the teacher to confirm before calling save_resource with this draftId.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("GOOGLE_GENERATIVE_AI_API_KEY")) {
      return userSafeError(
        "Image generation is not configured. Set GOOGLE_GENERATIVE_AI_API_KEY on the server."
      );
    }
    if (/no longer available|NOT_FOUND|is not found/i.test(message)) {
      return userSafeError(
        "Image model is unavailable for this API key. Set IMAGE_GENERATION_MODEL=gemini-2.5-flash-image (Imagen is blocked for new Gemini keys)."
      );
    }
    if (/quota|rate.?limit|RESOURCE_EXHAUSTED|billing/i.test(message)) {
      return userSafeError(
        "Google image quota exceeded for this API key. Wait for the free-tier reset, or enable billing in Google AI Studio, then try again."
      );
    }
    return userSafeError(
      "Could not generate the teaching image. Please try again."
    );
  }
}

export async function executeListStudents(deps: AgentToolDeps) {
  try {
    const { data, error } = await deps.supabase
      .from("students")
      .select("id, full_name, admission_number, gender")
      .eq("class_id", deps.classId)
      .order("full_name", { ascending: true });

    if (error) {
      return userSafeError("Could not load the class roster. Please try again.");
    }

    return {
      students: (data ?? []).map((student) => ({
        studentId: student.id as string,
        fullName: student.full_name as string,
        admissionNumber: (student.admission_number as string | null) ?? null,
        gender: (student.gender as string | null) ?? null,
      })),
    };
  } catch {
    return userSafeError("Could not load the class roster. Please try again.");
  }
}

/**
 * F2: Create/start an evaluation batch and return immediately.
 * Does NOT run vision grading in the chat transcript (ADR-004).
 */
export async function executeStartEvaluationBatch(
  deps: AgentToolDeps,
  input: {
    assessmentId?: string | null;
    resourceId?: string | null;
    markingSchemeResourceId?: string | null;
    proceedWithoutScheme?: boolean;
    studentId?: string | null;
  }
) {
  try {
    const batch = await createEvaluationBatch(deps.supabase, {
      classId: deps.classId,
      assessmentId: input.assessmentId ?? null,
      resourceId: input.resourceId ?? null,
      markingSchemeResourceId: input.markingSchemeResourceId ?? null,
      proceedWithoutScheme: input.proceedWithoutScheme ?? false,
      studentId: input.studentId ?? null,
    });

    const reviewHref = `/classes/${deps.classId}/evaluations/${batch.id}`;
    return {
      started: true,
      batchId: batch.id,
      status: batch.status,
      assessmentId: batch.assessment_id,
      reviewHref,
      deepLink: reviewHref,
      message:
        "Evaluation batch created. Upload scanned pages from the class page; grading runs in the background. Share the reviewHref deep-link so the teacher can open review when drafts are ready.",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start evaluation batch";
    return userSafeError(message);
  }
}

async function findAdmissionConflict(
  supabase: SupabaseClient,
  classId: string,
  admissionNumber: string,
  excludeStudentId?: string
) {
  const normalized = admissionNumber.trim().toLowerCase();
  const { data, error } = await supabase
    .from("students")
    .select("id, admission_number, full_name")
    .eq("class_id", classId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).find((row) => {
    const existing = (row.admission_number as string | null)?.trim().toLowerCase();
    if (!existing || existing !== normalized) return false;
    if (excludeStudentId && row.id === excludeStudentId) return false;
    return true;
  });
}

export async function executeCreateStudent(
  deps: AgentToolDeps,
  input: {
    fullName: string;
    admissionNumber?: string;
    gender?: "Male" | "Female";
    teacherConfirmed: true;
  }
) {
  if (input.teacherConfirmed !== true) {
    return userSafeError("Create student requires explicit teacher confirmation.");
  }

  const fullName = input.fullName.trim();
  if (fullName.length < 2) {
    return userSafeError("Student name is required.");
  }

  const admissionNumber = input.admissionNumber?.trim() || null;

  try {
    if (admissionNumber) {
      const conflict = await findAdmissionConflict(
        deps.supabase,
        deps.classId,
        admissionNumber
      );
      if (conflict) {
        return userSafeError(
          `Admission number ${admissionNumber} is already used by ${conflict.full_name}.`
        );
      }
    }

    const { data, error } = await deps.supabase
      .from("students")
      .insert({
        class_id: deps.classId,
        full_name: fullName,
        admission_number: admissionNumber,
        gender: input.gender ?? null,
      })
      .select("id, full_name, admission_number, gender")
      .single();

    if (error || !data) {
      if (error?.message?.toLowerCase().includes("idx_students_class_admission")) {
        return userSafeError(
          `Admission number ${admissionNumber} is already used in this class.`
        );
      }
      return userSafeError("Could not create the student. Please try again.");
    }

    return {
      created: true,
      studentId: data.id as string,
      fullName: data.full_name as string,
      admissionNumber: (data.admission_number as string | null) ?? null,
      gender: (data.gender as string | null) ?? null,
    };
  } catch {
    return userSafeError("Could not create the student. Please try again.");
  }
}

export async function executeUpdateStudent(
  deps: AgentToolDeps,
  input: {
    studentId: string;
    fullName?: string;
    admissionNumber?: string | null;
    gender?: "Male" | "Female" | null;
    teacherConfirmed: true;
  }
) {
  if (input.teacherConfirmed !== true) {
    return userSafeError("Update student requires explicit teacher confirmation.");
  }

  if (
    input.fullName === undefined &&
    input.admissionNumber === undefined &&
    input.gender === undefined
  ) {
    return userSafeError("Provide at least one field to update.");
  }

  try {
    const { data: existing, error: lookupError } = await deps.supabase
      .from("students")
      .select("id, full_name, admission_number, gender")
      .eq("id", input.studentId)
      .eq("class_id", deps.classId)
      .maybeSingle();

    if (lookupError) {
      return userSafeError("Could not update the student. Please try again.");
    }
    if (!existing) {
      return userSafeError("Student not found in this class.");
    }

    const patch: Record<string, unknown> = {};
    if (input.fullName !== undefined) {
      const fullName = input.fullName.trim();
      if (fullName.length < 2) {
        return userSafeError("Student name is required.");
      }
      patch.full_name = fullName;
    }

    if (input.admissionNumber !== undefined) {
      const admissionNumber = input.admissionNumber?.trim() || null;
      if (admissionNumber) {
        const conflict = await findAdmissionConflict(
          deps.supabase,
          deps.classId,
          admissionNumber,
          input.studentId
        );
        if (conflict) {
          return userSafeError(
            `Admission number ${admissionNumber} is already used by ${conflict.full_name}.`
          );
        }
      }
      patch.admission_number = admissionNumber;
    }

    if (input.gender !== undefined) {
      patch.gender = input.gender;
    }

    const { data, error } = await deps.supabase
      .from("students")
      .update(patch)
      .eq("id", input.studentId)
      .eq("class_id", deps.classId)
      .select("id, full_name, admission_number, gender")
      .single();

    if (error || !data) {
      if (error?.message?.toLowerCase().includes("idx_students_class_admission")) {
        return userSafeError(
          "That admission number is already used in this class."
        );
      }
      return userSafeError("Could not update the student. Please try again.");
    }

    return {
      updated: true,
      studentId: data.id as string,
      fullName: data.full_name as string,
      admissionNumber: (data.admission_number as string | null) ?? null,
      gender: (data.gender as string | null) ?? null,
    };
  } catch {
    return userSafeError("Could not update the student. Please try again.");
  }
}

export async function executeQueryClassPerformance(
  deps: AgentToolDeps,
  input: { assessmentId?: string; studentId?: string }
) {
  try {
    let assessmentsQuery = deps.supabase
      .from("assessments")
      .select("id, title, type, resource_id, created_at")
      .eq("class_id", deps.classId)
      .order("created_at", { ascending: false });

    if (input.assessmentId) {
      assessmentsQuery = assessmentsQuery.eq("id", input.assessmentId);
    }

    const { data: assessments, error: assessmentsError } =
      await assessmentsQuery;

    if (assessmentsError) {
      return userSafeError(
        "Could not load class performance right now. Please try again."
      );
    }

    const assessmentRows = assessments ?? [];
    const assessmentIds = assessmentRows.map((row) => row.id as string);

    const { data: roster, error: rosterError } = await deps.supabase
      .from("students")
      .select("id, full_name, admission_number")
      .eq("class_id", deps.classId);

    if (rosterError) {
      return userSafeError(
        "Could not load class performance right now. Please try again."
      );
    }

    const studentById = new Map(
      (roster ?? []).map((row) => [
        row.id as string,
        {
          fullName: row.full_name as string,
          admissionNumber: (row.admission_number as string | null) ?? null,
        },
      ])
    );

    let competencyQuery = deps.supabase
      .from("competency_progress")
      .select(
        "student_id, strand, sub_strand, status, evidence_count, last_evidence_at"
      )
      .eq("class_id", deps.classId)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (input.studentId) {
      competencyQuery = competencyQuery.eq("student_id", input.studentId);
    }

    const { data: competency, error: competencyError } = await competencyQuery;

    if (competencyError) {
      return userSafeError(
        "Could not load class performance right now. Please try again."
      );
    }

    let submissions: Array<Record<string, unknown>> = [];
    if (assessmentIds.length > 0) {
      let submissionsQuery = deps.supabase
        .from("student_submissions")
        .select(
          "id, assessment_id, student_id, ai_feedback, teacher_feedback, submitted_at"
        )
        .in("assessment_id", assessmentIds)
        .order("submitted_at", { ascending: false })
        .limit(50);

      if (input.studentId) {
        submissionsQuery = submissionsQuery.eq("student_id", input.studentId);
      }
      if (input.assessmentId) {
        submissionsQuery = submissionsQuery.eq(
          "assessment_id",
          input.assessmentId
        );
      }

      const { data: submissionRows, error: submissionsError } =
        await submissionsQuery;

      if (submissionsError) {
        return userSafeError(
          "Could not load class performance right now. Please try again."
        );
      }
      submissions = (submissionRows ?? []) as Array<Record<string, unknown>>;
    }

    const statusCounts = { mastered: 0, developing: 0, not_yet: 0 };
    for (const row of competency ?? []) {
      const status = row.status as keyof typeof statusCounts;
      if (status in statusCounts) {
        statusCounts[status] += 1;
      }
    }

    return {
      readOnly: true,
      assessmentCount: assessmentRows.length,
      assessments: assessmentRows.map((row) => ({
        assessmentId: row.id as string,
        title: row.title as string,
        type: (row.type as string | null) ?? null,
      })),
      competencyStatusCounts: statusCounts,
      competency: (competency ?? []).map((row) => {
        const student = studentById.get(row.student_id as string);
        return {
          studentId: row.student_id as string,
          fullName: student?.fullName ?? null,
          admissionNumber: student?.admissionNumber ?? null,
          strand: row.strand as string,
          subStrand: (row.sub_strand as string | null) ?? null,
          status: row.status as string,
          evidenceCount: (row.evidence_count as number | null) ?? 0,
          lastEvidenceAt: (row.last_evidence_at as string | null) ?? null,
        };
      }),
      submissions: submissions.map((row) => {
        const student = studentById.get(row.student_id as string);
        return {
          submissionId: row.id as string,
          assessmentId: row.assessment_id as string,
          studentId: row.student_id as string,
          fullName: student?.fullName ?? null,
          admissionNumber: student?.admissionNumber ?? null,
          aiFeedback: (row.ai_feedback as string | null) ?? null,
          teacherFeedback: (row.teacher_feedback as string | null) ?? null,
          submittedAt: (row.submitted_at as string | null) ?? null,
        };
      }),
    };
  } catch {
    return userSafeError(
      "Could not load class performance right now. Please try again."
    );
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
        "Generate a draft learning resource (scheme of work, assignment, lesson notes, marking scheme, quiz, examination, or other). Persists the draft server-side and returns draftId + markdown. Never saves to the class library — use save_resource after teacher confirmation.",
      inputSchema: z.object({
        resourceType: generatableResourceTypeSchema.describe(
          "Type of resource to generate"
        ),
        title: z.string().min(1).describe("Title for the draft resource"),
        instructions: z
          .string()
          .optional()
          .describe("Optional teacher instructions or constraints"),
      }),
      execute: async (input) => executeGenerateLearningResource(deps, input),
    }),
    generate_teaching_image: tool({
      description:
        "Generate a non-gradable teaching-aid image draft (diagram/illustration). Persists bytes server-side and returns draftId. Never saves automatically — call save_resource with draftId after teacher confirmation. Not attached to assessments.",
      inputSchema: z.object({
        title: z.string().min(1).describe("Title for the teaching aid"),
        prompt: z
          .string()
          .min(1)
          .describe("Detailed description of the image to generate"),
      }),
      execute: async (input) => executeGenerateTeachingImage(deps, input),
    }),
    update_draft: tool({
      description:
        "Edit a pending text draft (title and/or content) before save. Use when the teacher requests revisions to an existing draftId. Does not save to the class library.",
      inputSchema: z.object({
        draftId: z.string().uuid().describe("Draft id from generate_* tools"),
        title: z.string().min(1).optional().describe("Updated title"),
        content: z
          .string()
          .min(1)
          .optional()
          .describe("Updated full markdown content for text drafts"),
      }),
      execute: async (input) => executeUpdateDraft(deps, input),
    }),
    list_students: tool({
      description:
        "List students in the active class roster with ids, names, and admission numbers. Use when the teacher asks about their students or class size.",
      inputSchema: z.object({}),
      execute: async () => executeListStudents(deps),
    }),
    create_student: tool({
      description:
        "Create a student in the active class roster. Only call after the teacher explicitly confirms the name/admission details. Never delete students from chat.",
      inputSchema: z.object({
        fullName: z.string().min(2).describe("Student full name"),
        admissionNumber: z
          .string()
          .optional()
          .describe("Optional admission number (unique within the class)"),
        gender: genderSchema.optional().describe("Optional gender"),
        teacherConfirmed: z
          .literal(true)
          .describe(
            "Must be true only after the teacher explicitly confirms creation"
          ),
      }),
      execute: async (input) => executeCreateStudent(deps, input),
    }),
    update_student: tool({
      description:
        "Update a student in the active class roster. Only call after the teacher explicitly confirms the change. Never delete students from chat.",
      inputSchema: z.object({
        studentId: z.string().uuid().describe("Student id from list_students"),
        fullName: z.string().min(2).optional().describe("Updated full name"),
        admissionNumber: z
          .string()
          .nullable()
          .optional()
          .describe("Updated admission number (null clears it)"),
        gender: genderSchema
          .nullable()
          .optional()
          .describe("Updated gender (null clears it)"),
        teacherConfirmed: z
          .literal(true)
          .describe(
            "Must be true only after the teacher explicitly confirms the update"
          ),
      }),
      execute: async (input) => executeUpdateStudent(deps, input),
    }),
    query_class_performance: tool({
      description:
        "Read-only class/assessment performance from competency_progress and student_submissions. Use when the teacher asks about grades, competency, or who needs support. Never writes data.",
      inputSchema: z.object({
        assessmentId: z
          .string()
          .uuid()
          .optional()
          .describe("Optional assessment filter"),
        studentId: z
          .string()
          .uuid()
          .optional()
          .describe("Optional student filter"),
      }),
      execute: async (input) => executeQueryClassPerformance(deps, input),
    }),
    save_resource: tool({
      description:
        "Persist an approved draft to the class library by draftId (exact stored content — never re-supply text/image). Only call after the teacher explicitly confirms save. Works for text resources and teaching_aid images.",
      inputSchema: z.object({
        draftId: z
          .string()
          .uuid()
          .describe("draftId returned by generate_learning_resource or generate_teaching_image"),
        teacherConfirmed: z
          .literal(true)
          .describe(
            "Must be true only after the teacher explicitly confirms save in this conversation"
          ),
      }),
      execute: async (input) => executeSaveResource(deps, input),
    }),
    start_evaluation_batch: tool({
      description:
        "Create an evaluation batch for the active class (and optionally one student). Returns immediately with a deep-link — does not grade scripts in chat. Use when the teacher asks to start grading/evaluating an assessment. Tell them to upload scans on the class page; include the reviewHref deep-link in your reply.",
      inputSchema: z.object({
        assessmentId: z
          .string()
          .uuid()
          .optional()
          .describe("Existing assessment id when known"),
        resourceId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "Gradable resource id to promote when assessmentId is omitted"
          ),
        markingSchemeResourceId: z
          .string()
          .uuid()
          .optional()
          .describe("Marking scheme resource id to attach"),
        proceedWithoutScheme: z
          .boolean()
          .optional()
          .describe(
            "Set true only when the teacher accepts AI estimates without a scheme"
          ),
        studentId: z
          .string()
          .uuid()
          .optional()
          .describe("Optional single-student (N=1) scope"),
      }),
      execute: async (input) =>
        executeStartEvaluationBatch(deps, {
          assessmentId: input.assessmentId ?? null,
          resourceId: input.resourceId ?? null,
          markingSchemeResourceId: input.markingSchemeResourceId ?? null,
          proceedWithoutScheme: input.proceedWithoutScheme ?? false,
          studentId: input.studentId ?? null,
        }),
    }),
  };
}
