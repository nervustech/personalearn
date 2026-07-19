import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  executeCreateStudent,
  executeGenerateLearningResource,
  executeGenerateTeachingImage,
  executeListStudents,
  executeQueryClassPerformance,
  executeSaveResource,
  executeSearchClassResources,
  executeUpdateDraft,
  executeUpdateStudent,
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
  supabase: {} as unknown as AgentToolDeps["supabase"],
  classId: "class-1",
  teacherId: "teacher-1",
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
  ingestResource: vi.fn(),
}));

vi.mock("@/lib/ai/vision-model", () => ({
  getImageGenerationModel: vi.fn(() => ({ modelId: "mock-image" })),
}));

vi.mock("@/lib/evaluation/create-assessment-from-resource", () => ({
  ensureAssessmentForGradableResource: vi.fn(),
  shouldPublishAssessment: vi.fn((type: string) =>
    ["assignment", "quiz", "examination"].includes(type)
  ),
}));

vi.mock("@/lib/ai-hub/drafts", () => ({
  createAgentDraft: vi.fn(),
  getAgentDraft: vi.fn(),
  updateAgentDraft: vi.fn(),
  markAgentDraftSaved: vi.fn(),
  uploadDraftImageBytes: vi.fn(),
  downloadDraftImageBytes: vi.fn(),
}));

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: vi.fn(async () => ({
      text: "## Fractions assignment\n\n1. Add 1/2 + 1/4",
    })),
    generateImage: vi.fn(async () => ({
      image: {
        uint8Array: new Uint8Array([1, 2, 3]),
        mediaType: "image/png",
        base64: "AQID",
      },
    })),
  };
});

import { queryClassResources } from "@/lib/ai/rag";
import { ingestResource, ingestTxtResource } from "@/lib/ai/ingest-resource";
import { getImageGenerationModel } from "@/lib/ai/vision-model";
import { ensureAssessmentForGradableResource } from "@/lib/evaluation/create-assessment-from-resource";
import {
  createAgentDraft,
  downloadDraftImageBytes,
  getAgentDraft,
  markAgentDraftSaved,
  updateAgentDraft,
  uploadDraftImageBytes,
} from "@/lib/ai-hub/drafts";
import { generateImage, generateText } from "ai";

const mockQueryClassResources = vi.mocked(queryClassResources);
const mockIngestTxtResource = vi.mocked(ingestTxtResource);
const mockIngestResource = vi.mocked(ingestResource);
const mockEnsureAssessment = vi.mocked(ensureAssessmentForGradableResource);
const mockGenerateText = vi.mocked(generateText);
const mockGenerateImage = vi.mocked(generateImage);
const mockGetImageModel = vi.mocked(getImageGenerationModel);
const mockCreateAgentDraft = vi.mocked(createAgentDraft);
const mockGetAgentDraft = vi.mocked(getAgentDraft);
const mockUpdateAgentDraft = vi.mocked(updateAgentDraft);
const mockMarkAgentDraftSaved = vi.mocked(markAgentDraftSaved);
const mockUploadDraftImageBytes = vi.mocked(uploadDraftImageBytes);
const mockDownloadDraftImageBytes = vi.mocked(downloadDraftImageBytes);

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

  it("persists a markdown draft and returns draftId without saving", async () => {
    mockCreateAgentDraft.mockResolvedValue({
      id: "draft-1",
      class_id: "class-1",
      teacher_id: "teacher-1",
      kind: "text",
      title: "Fractions quiz",
      resource_type: "quiz",
      content_text: "## Fractions assignment\n\n1. Add 1/2 + 1/4",
      storage_path: null,
      mime_type: null,
      metadata: {},
      status: "pending",
      created_at: "2026-07-19T00:00:00Z",
      updated_at: "2026-07-19T00:00:00Z",
    });

    const result = await executeGenerateLearningResource(deps, {
      resourceType: "quiz",
      title: "Fractions quiz",
      instructions: "Five short questions",
    });

    expect(result).toEqual({
      draftId: "draft-1",
      title: "Fractions quiz",
      resourceType: "quiz",
      content: "## Fractions assignment\n\n1. Add 1/2 + 1/4",
    });
    expect(mockGenerateText).toHaveBeenCalled();
    expect(mockCreateAgentDraft).toHaveBeenCalledWith(
      deps.supabase,
      expect.objectContaining({
        classId: "class-1",
        teacherId: "teacher-1",
        kind: "text",
        title: "Fractions quiz",
        resourceType: "quiz",
      })
    );
    expect(mockIngestTxtResource).not.toHaveBeenCalled();
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

describe("executeGenerateTeachingImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores an image draft and returns draftId", async () => {
    mockUploadDraftImageBytes.mockResolvedValue("class-1/drafts/draft-img.png");
    const insertSingle = vi.fn(async () => ({
      data: {
        id: "draft-img",
        class_id: "class-1",
        teacher_id: "teacher-1",
        kind: "image",
        title: "Fraction pizza",
        resource_type: "teaching_aid",
        content_text: "A pizza divided into eighths",
        storage_path: "class-1/drafts/draft-img.png",
        mime_type: "image/png",
        metadata: { prompt: "A pizza divided into eighths" },
        status: "pending",
        created_at: "2026-07-19T00:00:00Z",
        updated_at: "2026-07-19T00:00:00Z",
      },
      error: null,
    }));
    const supabase = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: insertSingle,
          }),
        }),
      }),
      storage: {
        from: () => ({
          remove: vi.fn(),
        }),
      },
    };

    const result = await executeGenerateTeachingImage(
      { ...deps, supabase: supabase as unknown as AgentToolDeps["supabase"] },
      {
        title: "Fraction pizza",
        prompt: "A pizza divided into eighths",
      }
    );

    expect(result).toMatchObject({
      draftId: "draft-img",
      title: "Fraction pizza",
      resourceType: "teaching_aid",
      prompt: "A pizza divided into eighths",
      mimeType: "image/png",
    });
    expect(mockGenerateImage).toHaveBeenCalled();
    expect(mockUploadDraftImageBytes).toHaveBeenCalled();
  });

  it("returns a clear error when the image API key is missing", async () => {
    mockGetImageModel.mockImplementationOnce(() => {
      throw new Error(
        "Missing GOOGLE_GENERATIVE_AI_API_KEY. Add it to .env.local for image uploads."
      );
    });

    const result = await executeGenerateTeachingImage(deps, {
      title: "Diagram",
      prompt: "Number line",
    });

    expect(result).toEqual({
      error:
        "Image generation is not configured. Set GOOGLE_GENERATIVE_AI_API_KEY on the server.",
    });
    expect(mockGenerateImage).not.toHaveBeenCalled();
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
                {
                  id: "s1",
                  full_name: "Ada Lovelace",
                  admission_number: "A001",
                  gender: "Female",
                },
                {
                  id: "s2",
                  full_name: "Grace Hopper",
                  admission_number: null,
                  gender: null,
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    };

    const result = await executeListStudents({
      ...deps,
      supabase: supabase as unknown as AgentToolDeps["supabase"],
    });

    expect(result).toEqual({
      students: [
        {
          studentId: "s1",
          fullName: "Ada Lovelace",
          admissionNumber: "A001",
          gender: "Female",
        },
        {
          studentId: "s2",
          fullName: "Grace Hopper",
          admissionNumber: null,
          gender: null,
        },
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
      supabase: supabase as unknown as AgentToolDeps["supabase"],
    });

    expect(result).toEqual({
      error: "Could not load the class roster. Please try again.",
    });
  });
});

describe("executeCreateStudent / executeUpdateStudent", () => {
  it("creates a student after confirmation and rejects duplicates", async () => {
    const insertSingle = vi.fn(async () => ({
      data: {
        id: "s-new",
        full_name: "Alan Turing",
        admission_number: "A010",
        gender: "Male",
      },
      error: null,
    }));

    const supabase = {
      from: (table: string) => {
        if (table !== "students") throw new Error(`unexpected ${table}`);
        return {
          select: () => ({
            eq: async () => ({
              data: [
                {
                  id: "s1",
                  admission_number: "A001",
                  full_name: "Ada Lovelace",
                },
              ],
              error: null,
            }),
          }),
          insert: () => ({
            select: () => ({
              single: insertSingle,
            }),
          }),
        };
      },
    };

    const created = await executeCreateStudent(
      { ...deps, supabase: supabase as unknown as AgentToolDeps["supabase"] },
      {
        fullName: "Alan Turing",
        admissionNumber: "A010",
        gender: "Male",
        teacherConfirmed: true,
      }
    );

    expect(created).toEqual({
      created: true,
      studentId: "s-new",
      fullName: "Alan Turing",
      admissionNumber: "A010",
      gender: "Male",
    });

    const duplicate = await executeCreateStudent(
      { ...deps, supabase: supabase as unknown as AgentToolDeps["supabase"] },
      {
        fullName: "Clone",
        admissionNumber: "A001",
        teacherConfirmed: true,
      }
    );

    expect(duplicate).toEqual({
      error: "Admission number A001 is already used by Ada Lovelace.",
    });
  });

  it("rejects create/update without teacher confirmation", async () => {
    const createResult = await executeCreateStudent(deps, {
      fullName: "Test Student",
      teacherConfirmed: false as unknown as true,
    });
    expect(createResult).toEqual({
      error: "Create student requires explicit teacher confirmation.",
    });

    const updateResult = await executeUpdateStudent(deps, {
      studentId: "11111111-1111-4111-8111-111111111111",
      fullName: "Renamed",
      teacherConfirmed: false as unknown as true,
    });
    expect(updateResult).toEqual({
      error: "Update student requires explicit teacher confirmation.",
    });
  });

  it("updates a student in the active class", async () => {
    const updateSingle = vi.fn(async () => ({
      data: {
        id: "s1",
        full_name: "Ada King",
        admission_number: "A001",
        gender: "Female",
      },
      error: null,
    }));

    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "s1",
                  full_name: "Ada Lovelace",
                  admission_number: "A001",
                  gender: "Female",
                },
                error: null,
              }),
            }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: updateSingle,
              }),
            }),
          }),
        }),
      }),
    };

    // findAdmissionConflict path uses select().eq() without maybeSingle
    const supabaseWithConflictCheck = {
      from: (table: string) => {
        if (table !== "students") throw new Error(table);
        return {
          select: (_cols: string) => {
            const chain: Record<string, unknown> = {};
            chain.eq = (col: string) => {
              if (col === "id") {
                return {
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        id: "s1",
                        full_name: "Ada Lovelace",
                        admission_number: "A001",
                        gender: "Female",
                      },
                      error: null,
                    }),
                  }),
                };
              }
              // class_id list for conflict check
              return Promise.resolve({
                data: [
                  {
                    id: "s1",
                    admission_number: "A001",
                    full_name: "Ada Lovelace",
                  },
                ],
                error: null,
              });
            };
            return chain;
          },
          update: () => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: updateSingle,
                }),
              }),
            }),
          }),
        };
      },
    };

    const result = await executeUpdateStudent(
      {
        ...deps,
        supabase: supabaseWithConflictCheck as unknown as AgentToolDeps["supabase"],
      },
      {
        studentId: "s1",
        fullName: "Ada King",
        teacherConfirmed: true,
      }
    );

    expect(result).toEqual({
      updated: true,
      studentId: "s1",
      fullName: "Ada King",
      admissionNumber: "A001",
      gender: "Female",
    });
    expect(supabase).toBeTruthy();
  });
});

describe("executeQueryClassPerformance", () => {
  it("returns read-only competency and submission aggregates", async () => {
    const supabase = {
      from: (table: string) => {
        if (table === "assessments") {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [
                    {
                      id: "a1",
                      title: "Fractions quiz",
                      type: "formative",
                      resource_id: "r1",
                      created_at: "2026-07-01",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "students") {
          return {
            select: () => ({
              eq: async () => ({
                data: [
                  {
                    id: "s1",
                    full_name: "Ada Lovelace",
                    admission_number: "A001",
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === "competency_progress") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [
                      {
                        student_id: "s1",
                        strand: "Numbers",
                        sub_strand: "Fractions",
                        status: "developing",
                        evidence_count: 2,
                        last_evidence_at: "2026-07-10",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "student_submissions") {
          return {
            select: () => ({
              in: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [
                      {
                        id: "sub1",
                        assessment_id: "a1",
                        student_id: "s1",
                        ai_feedback: "Good effort",
                        teacher_feedback: null,
                        submitted_at: "2026-07-10",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };

    const result = await executeQueryClassPerformance(
      { ...deps, supabase: supabase as unknown as AgentToolDeps["supabase"] },
      {}
    );

    expect(result).toMatchObject({
      readOnly: true,
      assessmentCount: 1,
      competencyStatusCounts: { mastered: 0, developing: 1, not_yet: 0 },
      competency: [
        expect.objectContaining({
          studentId: "s1",
          fullName: "Ada Lovelace",
          strand: "Numbers",
          status: "developing",
        }),
      ],
      submissions: [
        expect.objectContaining({
          submissionId: "sub1",
          fullName: "Ada Lovelace",
          aiFeedback: "Good effort",
        }),
      ],
    });
  });
});

describe("sanitizeResourceFileName", () => {
  it("slugifies titles for storage paths", () => {
    expect(sanitizeResourceFileName("Fractions Quiz #1")).toBe(
      "fractions-quiz-1.txt"
    );
    expect(sanitizeResourceFileName("Fraction pizza", "png")).toBe(
      "fraction-pizza.png"
    );
  });
});

describe("executeUpdateDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates pending text draft content", async () => {
    mockGetAgentDraft.mockResolvedValue({
      id: "draft-1",
      class_id: "class-1",
      teacher_id: "teacher-1",
      kind: "text",
      title: "Quiz",
      resource_type: "quiz",
      content_text: "old",
      storage_path: null,
      mime_type: null,
      metadata: {},
      status: "pending",
      created_at: "2026-07-19T00:00:00Z",
      updated_at: "2026-07-19T00:00:00Z",
    });
    mockUpdateAgentDraft.mockResolvedValue({
      id: "draft-1",
      class_id: "class-1",
      teacher_id: "teacher-1",
      kind: "text",
      title: "Quiz",
      resource_type: "quiz",
      content_text: "## Revised",
      storage_path: null,
      mime_type: null,
      metadata: {},
      status: "pending",
      created_at: "2026-07-19T00:00:00Z",
      updated_at: "2026-07-19T00:00:01Z",
    });

    const result = await executeUpdateDraft(deps, {
      draftId: "draft-1",
      content: "## Revised",
    });

    expect(result).toMatchObject({
      updated: true,
      draftId: "draft-1",
      content: "## Revised",
    });
  });
});

describe("executeSaveResource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves exact stored draft content by draftId", async () => {
    mockGetAgentDraft.mockResolvedValue({
      id: "draft-1",
      class_id: "class-1",
      teacher_id: "teacher-1",
      kind: "text",
      title: "Fractions Quiz",
      resource_type: "quiz",
      content_text: "## Q1\nWhat is 1/2 + 1/4?",
      storage_path: null,
      mime_type: null,
      metadata: {},
      status: "pending",
      created_at: "2026-07-19T00:00:00Z",
      updated_at: "2026-07-19T00:00:00Z",
    });
    mockIngestTxtResource.mockResolvedValue({
      resourceId: "res-1",
      chunkCount: 3,
      title: "Fractions Quiz",
    });
    mockEnsureAssessment.mockResolvedValue({
      assessmentId: "assess-1",
      created: true,
    });
    mockMarkAgentDraftSaved.mockResolvedValue(undefined);

    const result = await executeSaveResource(deps, {
      draftId: "draft-1",
      teacherConfirmed: true,
    });

    expect(result).toEqual({
      saved: true,
      resourceId: "res-1",
      draftId: "draft-1",
      title: "Fractions Quiz",
      resourceType: "quiz",
      chunkCount: 3,
      assessmentId: "assess-1",
    });
    expect(mockIngestTxtResource).toHaveBeenCalledWith(deps.supabase, {
      classId: "class-1",
      fileName: "fractions-quiz.txt",
      text: "## Q1\nWhat is 1/2 + 1/4?",
      title: "Fractions Quiz",
      aiGenerated: true,
      resourceType: "quiz",
    });
    expect(mockMarkAgentDraftSaved).toHaveBeenCalled();
  });

  it("saves teaching_aid image drafts without creating assessments", async () => {
    mockGetAgentDraft.mockResolvedValue({
      id: "draft-img",
      class_id: "class-1",
      teacher_id: "teacher-1",
      kind: "image",
      title: "Fraction pizza",
      resource_type: "teaching_aid",
      content_text: "A pizza divided into eighths",
      storage_path: "class-1/drafts/draft-img.png",
      mime_type: "image/png",
      metadata: { prompt: "A pizza divided into eighths", nonGradable: true },
      status: "pending",
      created_at: "2026-07-19T00:00:00Z",
      updated_at: "2026-07-19T00:00:00Z",
    });
    mockDownloadDraftImageBytes.mockResolvedValue(new Uint8Array([9, 9, 9]));
    mockIngestResource.mockResolvedValue({
      resourceId: "res-img",
      chunkCount: 1,
      title: "Fraction pizza",
    });
    mockMarkAgentDraftSaved.mockResolvedValue(undefined);

    const result = await executeSaveResource(deps, {
      draftId: "draft-img",
      teacherConfirmed: true,
    });

    expect(result).toEqual({
      saved: true,
      resourceId: "res-img",
      draftId: "draft-img",
      title: "Fraction pizza",
      resourceType: "teaching_aid",
      chunkCount: 1,
    });
    expect(mockIngestResource).toHaveBeenCalledWith(
      deps.supabase,
      expect.objectContaining({
        resourceType: "teaching_aid",
        mimeType: "image/png",
        aiGenerated: true,
      })
    );
    expect(mockEnsureAssessment).not.toHaveBeenCalled();
  });

  it("does not create an assessment for non-gradable text types", async () => {
    mockGetAgentDraft.mockResolvedValue({
      id: "draft-notes",
      class_id: "class-1",
      teacher_id: "teacher-1",
      kind: "text",
      title: "Lesson notes",
      resource_type: "lesson_notes",
      content_text: "## Notes",
      storage_path: null,
      mime_type: null,
      metadata: {},
      status: "pending",
      created_at: "2026-07-19T00:00:00Z",
      updated_at: "2026-07-19T00:00:00Z",
    });
    mockIngestTxtResource.mockResolvedValue({
      resourceId: "res-notes",
      chunkCount: 1,
      title: "Lesson notes",
    });
    mockMarkAgentDraftSaved.mockResolvedValue(undefined);

    const result = await executeSaveResource(deps, {
      draftId: "draft-notes",
      teacherConfirmed: true,
    });

    expect(result).toEqual({
      saved: true,
      resourceId: "res-notes",
      draftId: "draft-notes",
      title: "Lesson notes",
      resourceType: "lesson_notes",
      chunkCount: 1,
    });
    expect(mockEnsureAssessment).not.toHaveBeenCalled();
  });

  it("returns a user-safe error when ingest fails", async () => {
    mockGetAgentDraft.mockResolvedValue({
      id: "draft-exam",
      class_id: "class-1",
      teacher_id: "teacher-1",
      kind: "text",
      title: "Term Exam",
      resource_type: "examination",
      content_text: "## Section A",
      storage_path: null,
      mime_type: null,
      metadata: {},
      status: "pending",
      created_at: "2026-07-19T00:00:00Z",
      updated_at: "2026-07-19T00:00:00Z",
    });
    mockIngestTxtResource.mockRejectedValue(new Error("Storage upload failed"));

    const result = await executeSaveResource(deps, {
      draftId: "draft-exam",
      teacherConfirmed: true,
    });

    expect(result).toEqual({
      error: "Could not save the resource. Please try again.",
    });
  });

  it("rejects save without teacher confirmation", async () => {
    const result = await executeSaveResource(deps, {
      draftId: "draft-1",
      teacherConfirmed: false as unknown as true,
    });

    expect(mockIngestTxtResource).not.toHaveBeenCalled();
    expect(mockGetAgentDraft).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: "Save requires explicit teacher confirmation.",
    });
  });
});
