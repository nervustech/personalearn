"use client";

import { use } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import {
  ResourceViewer,
  ResourceViewerSkeleton,
} from "@/components/classes/resource-viewer";
import { Badge } from "@/components/ui/badge";
import { useClasses } from "@/lib/hooks/use-classes";
import { useResource } from "@/lib/hooks/use-resources";
import {
  formatResourceDate,
  formatResourceType,
} from "@/lib/resources/format";

export default function ClassResourcePage({
  params,
}: {
  params: Promise<{ classId: string; resourceId: string }>;
}) {
  const { classId, resourceId } = use(params);
  const { data: classes } = useClasses();
  const { data, isLoading, error } = useResource(resourceId);

  const cls = classes?.find((c) => c.id === classId);
  const resource = data?.resource;
  const classLabel = cls?.name ?? "Class";
  const classMismatch =
    Boolean(resource) && resource!.class_id !== classId;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Breadcrumbs
        items={[
          { label: "Classes", href: "/classes" },
          { label: classLabel, href: `/classes/${classId}` },
          { label: resource?.title ?? "Resource" },
        ]}
      />

      {isLoading ? (
        <>
          <div className="space-y-2">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          </div>
          <ResourceViewerSkeleton />
        </>
      ) : error ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load resource"}{" "}
          <Link href={`/classes/${classId}`} className="text-primary hover:underline">
            Back to class
          </Link>
        </p>
      ) : !resource || classMismatch ? (
        <p className="text-sm text-muted-foreground">
          Resource not found.{" "}
          <Link href={`/classes/${classId}`} className="text-primary hover:underline">
            Back to class
          </Link>
        </p>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {resource.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{formatResourceType(resource.resource_type)}</span>
              <span aria-hidden>·</span>
              <span>{formatResourceDate(resource.created_at)}</span>
              <Badge variant={resource.ai_generated ? "accent" : "secondary"}>
                {resource.ai_generated ? "AI-generated" : "Uploaded"}
              </Badge>
            </div>
          </div>
          <ResourceViewer
            classId={classId}
            resource={resource}
            viewUrl={data?.viewUrl ?? null}
            previewText={data?.previewText ?? ""}
          />
        </>
      )}
    </div>
  );
}
