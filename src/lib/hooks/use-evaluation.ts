"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ScriptReviewDto } from "@/lib/evaluation/identity";
import type { Assessment, EvaluationBatch } from "@/types/database";

export const assessmentsQueryKey = (classId: string) =>
  ["assessments", classId] as const;

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
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load scripts");
      }
      return {
        scripts: payload.scripts ?? [],
        batch: payload.batch,
      };
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
    }) => {
      const response = await fetch("/api/evaluation-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, ...input }),
      });
      const payload = (await response.json()) as {
        batch?: EvaluationBatch;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not start evaluation");
      }
      return payload.batch!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: evaluationBatchesQueryKey(classId),
      });
      queryClient.invalidateQueries({ queryKey: assessmentsQueryKey(classId) });
    },
  });
}

export function useUploadEvaluationPages(classId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { batchId: string; files: File[] }) => {
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
        warnings?: {
          fileName: string;
          duplicateOfFileName: string;
          message: string;
        }[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Upload failed");
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

export function useProcessEvaluationIdentity(classId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const response = await fetch(
        `/api/evaluation-batches/${batchId}/process-identity`,
        { method: "POST" }
      );
      const payload = (await response.json()) as {
        scripts?: ScriptReviewDto[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Identity processing failed");
      }
      return payload.scripts ?? [];
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

export type ProcessDraftsSummary = {
  drafted: number;
  skippedAmber: number;
  skippedPending: number;
  skippedAlreadyDrafted: number;
  skippedOther: number;
  errors: { scriptId: string; message: string }[];
};

export function useProcessDrafts(classId: string, batchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/evaluation-batches/${batchId}/process-drafts`,
        { method: "POST" }
      );
      const payload = (await response.json()) as {
        summary?: ProcessDraftsSummary;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Draft processing failed");
      }
      return payload.summary!;
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
            awarded: input.awarded,
            max: input.max,
            feedback: input.feedback,
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
    },
  });
}
