"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Resource } from "@/types/database";

export const resourcesQueryKey = (classId: string) =>
  ["resources", classId] as const;

async function fetchResources(classId: string) {
  const response = await fetch(`/api/resources?classId=${encodeURIComponent(classId)}`);
  const payload = (await response.json()) as {
    resources?: Resource[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load resources");
  }

  return payload.resources ?? [];
}

export function useResources(classId: string | undefined) {
  return useQuery({
    queryKey: resourcesQueryKey(classId ?? ""),
    enabled: Boolean(classId),
    queryFn: () => fetchResources(classId!),
  });
}

export function useDeleteResource(classId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resourceId: string) => {
      const response = await fetch(`/api/resources/${resourceId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Delete failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourcesQueryKey(classId) });
    },
  });
}

export function useUploadResource(classId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("classId", classId);
      formData.append("file", file);

      const response = await fetch("/api/resources/ingest", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        error?: string;
        title?: string;
        chunkCount?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Upload failed");
      }

      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourcesQueryKey(classId) });
    },
  });
}
