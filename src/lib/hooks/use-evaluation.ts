"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ScriptReviewDto } from "@/lib/evaluation/identity";
import type { StudentEvalProfile } from "@/lib/evaluation/student-profile";
import type {
  Assessment,
  EvaluationBatch,
  StudentSubmission,
} from "@/types/database";

export const assessmentsQueryKey = (classId: string) =>
  ["assessments", classId] as const;

export const classSubmissionsQueryKey = (classId: string) =>
  ["class-submissions", classId] as const;

export const studentEvalProfileQueryKey = (
  classId: string,
  studentId: string
) => ["student-eval-profile", classId, studentId] as const;

export const evaluationBatchesQueryKey = (classId: string) =>
  ["evaluation-batches", classId] as const;

export const evaluationScriptsQueryKey = (batchId: string) =>
  ["evaluation-scripts", batchId] as const;

async function fetchAssessments(classId: string) {
  const response = await fetch(
    `/api/assessments?classId=${encodeURIComponent(classId)}`
  );
  const payload = (await response.json()) as {
    assessments?: Assessment[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load assessments");
  }
  return payload.assessments ?? [];
}

async function fetchBatches(classId: string) {
  const response = await fetch(
    `/api/evaluation-batches?classId=${encodeURIComponent(classId)}`
  );
  const payload = (await response.json()) as {
    batches?: EvaluationBatch[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load evaluation batches");
  }
  return payload.batches ?? [];
}

export function useAssessments(classId: string | undefined) {
  return useQuery({
    queryKey: assessmentsQueryKey(classId ?? ""),
    enabled: Boolean(classId),
    queryFn: () => fetchAssessments(classId!),
  });
}

async function fetchClassSubmissions(classId: string) {
  const response = await fetch(
    `/api/classes/${encodeURIComponent(classId)}/submissions`
  );
  const payload = (await response.json()) as {
    submissions?: StudentSubmission[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load submissions");
  }
  return payload.submissions ?? [];
}

export function useClassSubmissions(classId: string | undefined) {
  return useQuery({
    queryKey: classSubmissionsQueryKey(classId ?? ""),
    enabled: Boolean(classId),
    queryFn: () => fetchClassSubmissions(classId!),
  });
}

export function useEvaluationBatches(classId: string | undefined) {
  return useQuery({
    queryKey: evaluationBatchesQueryKey(classId ?? ""),
    enabled: Boolean(classId),
    queryFn: () => fetchBatches(classId!),
  });
}

export function useEvaluationScripts(batchId: string | undefined) {
  return useQuery({
    queryKey: evaluationScriptsQueryKey(batchId ?? ""),
    enabled: Boolean(batchId),
    queryFn: async () => {
      const response = await fetch(
        `/api/evaluation-batches/${batchId}/scripts`
      );
      const payload = (await response.json()) as {
        scripts?: ScriptReviewDto[];
        batch?: EvaluationBatch;
        pageCount?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load scripts");
      }
      return {
        scripts: payload.scripts ?? [],
        batch: payload.batch,
        pageCount: payload.pageCount ?? 0,
      };
    },
  });
}

export function useStudentEvalProfile(
  classId: string | undefined,
  studentId: string | undefined
) {
  return useQuery({
    queryKey: studentEvalProfileQueryKey(classId ?? "", studentId ?? ""),
    enabled: Boolean(classId && studentId),
    queryFn: async () => {
      const response = await fetch(
        `/api/classes/${classId}/students/${studentId}/profile`
      );
      const payload = (await response.json()) as StudentEvalProfile & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load student profile");
      }
      return payload as StudentEvalProfile;
    },
  });
}

export function useCreateEvaluationBatch(classId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      assessmentId?: string | null;
      resourceId?: string | null;
      markingSchemeResourceId?: string | null;
      proceedWithoutScheme?: boolean;
      studentId?: string | null;
    }) => {
      const response = await fetch("/api/evaluation-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, ...input }),
      });
      const payload = (await response.json()) as {
        batch?: EvaluationBatch;
        reused?: boolean;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not start evaluation");
      }
      return { batch: payload.batch!, reused: Boolean(payload.reused) };
    },
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({
        queryKey: evaluationBatchesQueryKey(classId),
      });
      queryClient.invalidateQueries({ queryKey: assessmentsQueryKey(classId) });
      if (input.studentId) {
        queryClient.invalidateQueries({
          queryKey: studentEvalProfileQueryKey(classId, input.studentId),
        });
      }
    },
  });
}

async function sha256HexBrowser(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * F1: Direct-to-storage upload via signed URLs (avoids Vercel body limits).
 * Falls back to legacy FormData /upload only if signed-url flow fails to mint tokens.
 */
export function useUploadEvaluationPages(classId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { batchId: string; files: File[] }) => {
      const urlsRes = await fetch(
        `/api/evaluation-batches/${input.batchId}/upload-urls`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            files: input.files.map((f) => ({
              fileName: f.name,
              contentType: f.type || undefined,
            })),
          }),
        }
      );
      const urlsPayload = (await urlsRes.json()) as {
        uploads?: {
          fileName: string;
          storagePath: string;
          token: string;
          contentType: string;
        }[];
        error?: string;
      };

      if (urlsRes.ok && urlsPayload.uploads?.length === input.files.length) {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const confirmed: {
          storagePath: string;
          fileName: string;
          contentHash: string;
        }[] = [];

        for (let i = 0; i < input.files.length; i += 1) {
          const file = input.files[i]!;
          const slot = urlsPayload.uploads[i]!;
          const contentHash = await sha256HexBrowser(file);
          const { error: putError } = await supabase.storage
            .from("student_submissions")
            .uploadToSignedUrl(slot.storagePath, slot.token, file, {
              contentType: slot.contentType || file.type || "image/jpeg",
              upsert: false,
            });
          if (putError) {
            throw new Error(putError.message || `Upload failed: ${file.name}`);
          }
          confirmed.push({
            storagePath: slot.storagePath,
            fileName: file.name,
            contentHash,
          });
        }

        const confirmRes = await fetch(
          `/api/evaluation-batches/${input.batchId}/confirm-upload`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pages: confirmed }),
          }
        );
        const confirmPayload = (await confirmRes.json()) as {
          pageCount?: number;
          queued?: boolean;
          skippedAll?: boolean;
          message?: string;
          warnings?: {
            fileName: string;
            duplicateOfFileName: string;
            message: string;
          }[];
          error?: string;
        };
        if (!confirmRes.ok) {
          throw new Error(confirmPayload.error ?? "Could not confirm upload");
        }
        return confirmPayload;
      }

      // Legacy path (small batches / older servers).
      const formData = new FormData();
      for (const file of input.files) {
        formData.append("files", file);
      }
      const response = await fetch(
        `/api/evaluation-batches/${input.batchId}/upload`,
        { method: "POST", body: formData }
      );
      const payload = (await response.json()) as {
        pageCount?: number;
        queued?: boolean;
        skippedAll?: boolean;
        message?: string;
        warnings?: {
          fileName: string;
          duplicateOfFileName: string;
          message: string;
        }[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(
          urlsPayload.error ?? payload.error ?? "Upload failed"
        );
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: evaluationBatchesQueryKey(classId),
      });
    },
  });
}

export function useStartBatchIndex(classId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const response = await fetch(
        `/api/evaluation-batches/${batchId}/start`,
        { method: "POST" }
      );
      const payload = (await response.json()) as {
        jobId?: string;
        phase?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not start batch indexing");
      }
      return payload;
    },
    onSuccess: (_data, batchId) => {
      queryClient.invalidateQueries({
        queryKey: evaluationBatchesQueryKey(classId),
      });
      queryClient.invalidateQueries({
        queryKey: evaluationScriptsQueryKey(batchId),
      });
    },
  });
}

/** @deprecated Use useStartBatchIndex — kept for call-site compatibility */
export const useStartEvaluationProcessing = useStartBatchIndex;

export function useEvaluateLive(classId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { batchId: string; scriptId?: string | null }) => {
      const response = await fetch(
        `/api/evaluation-batches/${input.batchId}/evaluate-live`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scriptId: input.scriptId ?? null }),
        }
      );
      const payload = (await response.json()) as {
        status?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Live evaluation failed");
      }
      return payload;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: evaluationBatchesQueryKey(classId),
      });
      queryClient.invalidateQueries({
        queryKey: evaluationScriptsQueryKey(input.batchId),
      });
    },
  });
}

/** Bulk class upload: submit index Batch job after pages uploaded. */
export function useProcessEvaluationIdentity(classId: string) {
  return useStartBatchIndex(classId);
}

export function useAssignEvaluationScript(classId: string, batchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { scriptId: string; studentId: string }) => {
      const response = await fetch(
        `/api/evaluation-batches/${batchId}/scripts/${input.scriptId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: input.studentId }),
        }
      );
      const payload = (await response.json()) as {
        script?: ScriptReviewDto;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not assign student");
      }
      return payload.script!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: evaluationScriptsQueryKey(batchId),
      });
      queryClient.invalidateQueries({
        queryKey: evaluationBatchesQueryKey(classId),
      });
    },
  });
}

export function useRemoveEvaluationScript(classId: string, batchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scriptId: string) => {
      const response = await fetch(
        `/api/evaluation-batches/${batchId}/scripts/${scriptId}`,
        { method: "DELETE" }
      );
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not remove script");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: evaluationScriptsQueryKey(batchId),
      });
      queryClient.invalidateQueries({
        queryKey: evaluationBatchesQueryKey(classId),
      });
    },
  });
}

export const competencyProgressQueryKey = (classId: string) =>
  ["competency-progress", classId] as const;

export function useCompetencyProgress(classId: string | undefined) {
  return useQuery({
    queryKey: competencyProgressQueryKey(classId ?? ""),
    enabled: Boolean(classId),
    queryFn: async () => {
      const response = await fetch(`/api/classes/${classId}/competency`);
      const payload = (await response.json()) as {
        competency?: import("@/types/database").CompetencyProgress[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load competency");
      }
      return payload.competency ?? [];
    },
  });
}

export function useUpdateQuestionEvaluation(classId: string, batchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      scriptId: string;
      questionId: string;
      awarded?: number | null;
      max?: number | null;
      feedback?: string | null;
    }) => {
      const response = await fetch(
        `/api/evaluation-batches/${batchId}/scripts/${input.scriptId}/questions/${input.questionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(input.awarded !== undefined ? { awarded: input.awarded } : {}),
            ...(input.max !== undefined ? { max: input.max } : {}),
            ...(input.feedback !== undefined
              ? { feedback: input.feedback }
              : {}),
          }),
        }
      );
      const payload = (await response.json()) as {
        question?: import("@/types/database").QuestionEvaluation;
        totals?: { awarded: number | null; max: number | null };
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update question");
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: evaluationScriptsQueryKey(batchId),
      });
      queryClient.invalidateQueries({
        queryKey: evaluationBatchesQueryKey(classId),
      });
      queryClient.invalidateQueries({ queryKey: ["script-review"] });
    },
  });
}

export function useReevaluateQuestion(classId: string, batchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      scriptId: string;
      questionId: string;
      instruction?: string;
    }) => {
      const response = await fetch(
        `/api/evaluation-batches/${batchId}/scripts/${input.scriptId}/questions/${input.questionId}/re-evaluate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instruction: input.instruction ?? null }),
        }
      );
      const payload = (await response.json()) as {
        question?: import("@/types/database").QuestionEvaluation;
        totals?: { awarded: number | null; max: number | null };
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Re-evaluation failed");
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: evaluationScriptsQueryKey(batchId),
      });
      queryClient.invalidateQueries({
        queryKey: evaluationBatchesQueryKey(classId),
      });
      queryClient.invalidateQueries({ queryKey: ["script-review"] });
    },
  });
}

export function useSignOffScript(classId: string, batchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scriptId: string) => {
      const response = await fetch(
        `/api/evaluation-batches/${batchId}/scripts/${scriptId}/sign-off`,
        { method: "POST" }
      );
      const payload = (await response.json()) as {
        submission?: import("@/types/database").StudentSubmission;
        competency?: import("@/types/database").CompetencyProgress;
        alreadySignedOff?: boolean;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Sign-off failed");
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: evaluationScriptsQueryKey(batchId),
      });
      queryClient.invalidateQueries({
        queryKey: evaluationBatchesQueryKey(classId),
      });
      queryClient.invalidateQueries({
        queryKey: competencyProgressQueryKey(classId),
      });
      queryClient.invalidateQueries({
        queryKey: assessmentsQueryKey(classId),
      });
      queryClient.invalidateQueries({
        queryKey: classSubmissionsQueryKey(classId),
      });
      queryClient.invalidateQueries({
        queryKey: ["student-eval-profile", classId],
      });
      queryClient.invalidateQueries({ queryKey: ["script-review"] });
    },
  });
}
