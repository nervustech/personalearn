"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Resource, ResourceType } from "@/types/database";

export const resourcesQueryKey = (classId: string) =>
  ["resources", classId] as const;

export const resourceQueryKey = (resourceId: string) =>
  ["resource", resourceId] as const;

export type ResourceDetailResponse = {
  resource: Resource;
  viewUrl: string | null;
  previewText: string;
};

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

async function fetchResource(resourceId: string) {
  const response = await fetch(`/api/resources/${resourceId}`);
  const payload = (await response.json()) as ResourceDetailResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load resource");
  }

  return payload as ResourceDetailResponse;
}

export function useResources(classId: string | undefined) {
  return useQuery({
    queryKey: resourcesQueryKey(classId ?? ""),
    enabled: Boolean(classId),
    queryFn: () => fetchResources(classId!),
  });
}

export function useResource(resourceId: string | undefined) {
  return useQuery({
    queryKey: resourceQueryKey(resourceId ?? ""),
    enabled: Boolean(resourceId),
    queryFn: () => fetchResource(resourceId!),
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
    onSuccess: (_data, resourceId) => {
      queryClient.invalidateQueries({ queryKey: resourcesQueryKey(classId) });
      queryClient.invalidateQueries({ queryKey: resourceQueryKey(resourceId) });
    },
  });
}

export function useUpdateResource(classId: string, resourceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { title: string; text: string }) => {
      const response = await fetch(`/api/resources/${resourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as {
        error?: string;
        title?: string;
        chunkCount?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Update failed");
      }

      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourcesQueryKey(classId) });
      queryClient.invalidateQueries({ queryKey: resourceQueryKey(resourceId) });
    },
  });
}

export function useUploadResource(classId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { file: File; resourceType?: ResourceType }) => {
      const formData = new FormData();
      formData.append("classId", classId);
      formData.append("file", input.file);
      if (input.resourceType) {
        formData.append("resourceType", input.resourceType);
      }

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
