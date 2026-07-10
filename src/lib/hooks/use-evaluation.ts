"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Assessment, EvaluationBatch } from "@/types/database";

export const assessmentsQueryKey = (classId: string) =>
  ["assessments", classId] as const;

export const evaluationBatchesQueryKey = (classId: string) =>
  ["evaluation-batches", classId] as const;

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
