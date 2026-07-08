import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  executeGenerateLearningResource,
  executeListStudents,
  executeSaveResource,
  executeSearchClassResources,
  sanitizeResourceFileName,
  type AgentToolDeps,
} from "./agent-tools";

const classContext = {
  id: "class-1",
  name: "Grade 7 Maths",
  subject: "Mathematics",
  grade_level: 7,
  term: 1,
  section: "East",
  academic_year: "2026",
};

const deps: AgentToolDeps = {
  supabase: {} as AgentToolDeps["supabase"],
  classId: "class-1",
  classContext,
};

vi.mock("@/lib/ai/rag", () => ({
  queryClassResources: vi.fn(),
}));

vi.mock("@/lib/ai/llm", () => ({
  getChatModel: vi.fn(() => ({ modelId: "mock" })),
}));

vi.mock("@/lib/ai/ingest-resource", () => ({
  ingestTxtResource: vi.fn(),
}));

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: vi.fn(async () => ({
      text: "## Fractions assignment\n\n1. Add 1/2 + 1/4",
    })),
  };
});

import { queryClassResources } from "@/lib/ai/rag";
import { ingestTxtResource } from "@/lib/ai/ingest-resource";
import { generateText } from "ai";

const mockQueryClassResources = vi.mocked(queryClassResources);
const mockIngestTxtResource = vi.mocked(ingestTxtResource);
const mockGenerateText = vi.mocked(generateText);

describe("executeSearchClassResources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns answer and source titles from RAG", async () => {
    mockQueryClassResources.mockResolvedValue({
      answer: "Week 3 covers fractions.",
      sources: [
        { resourceId: "res-1", title: "Scheme of Work" },
        { resourceId: "res-2", title: "Term 1 Notes" },
      ],
    });

    const result = await executeSearchClassResources(deps, {
      query: "What does Week 3 cover?",
    });

    expect(result).toEqual({
      answer: "Week 3 covers fractions.",
      sources: [
        { title: "Scheme of Work", resourceId: "res-1" },
        { title: "Term 1 Notes", resourceId: "res-2" },
      ],
    });
    expect(mockQueryClassResources).toHaveBeenCalledWith(
      deps.supabase,
      "class-1",
      "What does Week 3 cover?"
    );
  });

  it("returns a user-safe error when RAG fails", async () => {
    mockQueryClassResources.mockRejectedValue(new Error("Vector search failed"));

    const result = await executeSearchClassResources(deps, {
      query: "Week 3",
    });

    expect(result).toEqual({
      error: "Could not search class resources right now. Please try again.",
    });
  });
});

describe("executeGenerateLearningResource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a markdown draft without saving", async () => {
    const result = await executeGenerateLearningResource(deps, {
      resourceType: "quiz",
      title: "Fractions quiz",
      instructions: "Five short questions",
    });

    expect(result).toEqual({
      title: "Fractions quiz",
      resourceType: "quiz",
      content: "## Fractions assignment\n\n1. Add 1/2 + 1/4",
    });
    expect(mockGenerateText).toHaveBeenCalled();
  });

  it("returns a user-safe error when generation fails", async () => {
    mockGenerateText.mockRejectedValueOnce(new Error("Provider down"));

    const result = await executeGenerateLearningResource(deps, {
      resourceType: "lesson_notes",
      title: "Intro to algebra",
    });

    expect(result).toEqual({
      error: "Could not generate the resource draft. Please try again.",
    });
  });
});

describe("executeListStudents", () => {
  it("returns roster entries for the class", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [
                { full_name: "Ada Lovelace", admission_number: "A001" },
                { full_name: "Grace Hopper", admission_number: null },
              ],
              error: null,
            }),
          }),
        }),
      }),
    };

    const result = await executeListStudents({
      ...deps,
      supabase: supabase as AgentToolDeps["supabase"],
    });

    expect(result).toEqual({
      students: [
        { fullName: "Ada Lovelace", admissionNumber: "A001" },
        { fullName: "Grace Hopper", admissionNumber: null },
      ],
    });
  });

  it("returns a user-safe error when roster lookup fails", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: null,
              error: { message: "db error" },
            }),
          }),
        }),
      }),
    };

    const result = await executeListStudents({
      ...deps,
      supabase: supabase as AgentToolDeps["supabase"],
    });

    expect(result).toEqual({
      error: "Could not load the class roster. Please try again.",
    });
  });
});

describe("sanitizeResourceFileName", () => {
  it("slugifies titles for storage paths", () => {
    expect(sanitizeResourceFileName("Fractions Quiz #1")).toBe(
      "fractions-quiz-1.txt"
    );
  });
});

describe("executeSaveResource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists an approved draft with ai_generated metadata", async () => {
    mockIngestTxtResource.mockResolvedValue({
      resourceId: "res-1",
      chunkCount: 3,
      title: "Fractions Quiz",
    });

    const result = await executeSaveResource(deps, {
      title: "Fractions Quiz",
      resourceType: "quiz",
      content: "## Q1\nWhat is 1/2 + 1/4?",
      teacherConfirmed: true,
    });

    expect(result).toEqual({
      saved: true,
      resourceId: "res-1",
      title: "Fractions Quiz",
      resourceType: "quiz",
      chunkCount: 3,
    });
    expect(mockIngestTxtResource).toHaveBeenCalledWith(deps.supabase, {
      classId: "class-1",
      fileName: "fractions-quiz.txt",
      text: "## Q1\nWhat is 1/2 + 1/4?",
      title: "Fractions Quiz",
      aiGenerated: true,
      resourceType: "quiz",
    });
  });

  it("returns a user-safe error when ingest fails", async () => {
    mockIngestTxtResource.mockRejectedValue(new Error("Storage upload failed"));

    const result = await executeSaveResource(deps, {
      title: "Term Exam",
      resourceType: "examination",
      content: "## Section A",
      teacherConfirmed: true,
    });

    expect(result).toEqual({
      error: "Could not save the resource. Please try again.",
    });
  });

  it("rejects save without teacher confirmation", async () => {
    const result = await executeSaveResource(deps, {
      title: "Quiz",
      resourceType: "quiz",
      content: "## Q1",
      teacherConfirmed: false as unknown as true,
    });

    expect(mockIngestTxtResource).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: "Save requires explicit teacher confirmation.",
    });
  });
});
