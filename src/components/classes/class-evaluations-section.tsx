"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  deriveTeacherBatchStage,
  isOpenEvaluationBatchStatus,
} from "@/lib/evaluation/batch-stage";
import type { ScriptReviewDto } from "@/lib/evaluation/identity";
import {
  evaluationScriptsQueryKey,
  useAssessments,
  useEvaluationBatches,
} from "@/lib/hooks/use-evaluation";
import type { Assessment, EvaluationBatch } from "@/types/database";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ClassEvaluationsSectionProps = {
  classId: string;
};

async function fetchBatchScripts(batchId: string) {
  const response = await fetch(
    `/api/evaluation-batches/${encodeURIComponent(batchId)}/scripts`
  );
  const payload = (await response.json()) as {
    scripts?: ScriptReviewDto[];
    pageCount?: number;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load scripts");
  }
  return {
    scripts: payload.scripts ?? [],
    pageCount: payload.pageCount ?? 0,
  };
}

function stageBadgeClass(label: string) {
  switch (label) {
    case "Review":
      return "bg-indigo-500/15 text-indigo-950 dark:text-indigo-100";
    case "Grading":
      return "bg-muted text-muted-foreground animate-pulse";
    case "Identity":
      return "bg-amber-500/15 text-amber-950 dark:text-amber-100";
    case "Duplicates":
    case "Duplicate":
      return "bg-orange-500/15 text-orange-950 dark:text-orange-100";
    case "Ready":
      return "bg-emerald-500/15 text-emerald-950 dark:text-emerald-100";
    case "Upload":
      return "bg-sky-500/15 text-sky-950 dark:text-sky-100";
    case "Done":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

type OpenBatchRow = {
  batch: EvaluationBatch;
  assessmentTitle: string;
  stage: ReturnType<typeof deriveTeacherBatchStage>;
};

export function ClassEvaluationsSection({ classId }: ClassEvaluationsSectionProps) {
  const { data: batches, isLoading: batchesLoading } =
    useEvaluationBatches(classId);
  const { data: assessments, isLoading: assessmentsLoading } =
    useAssessments(classId);

  const openBatches = useMemo(
    () =>
      (batches ?? [])
        .filter((b) => isOpenEvaluationBatchStatus(b.status))
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
    [batches]
  );

  const scriptQueries = useQueries({
    queries: openBatches.map((batch) => ({
      queryKey: evaluationScriptsQueryKey(batch.id),
      queryFn: () => fetchBatchScripts(batch.id),
      staleTime: 15_000,
    })),
  });

  const assessmentById = useMemo(() => {
    const map = new Map<string, Assessment>();
    for (const a of assessments ?? []) map.set(a.id, a);
    return map;
  }, [assessments]);

  const rows: OpenBatchRow[] = useMemo(() => {
    return openBatches.map((batch, index) => {
      const queryData = scriptQueries[index]?.data;
      const scripts = queryData?.scripts ?? [];
      const pageCount = queryData?.pageCount ?? 0;
      const assessment = batch.assessment_id
        ? assessmentById.get(batch.assessment_id)
        : undefined;
      const stage = deriveTeacherBatchStage(scripts, batch.status, pageCount);
      return {
        batch,
        assessmentTitle: assessment?.title?.trim() || "Evaluation",
        stage,
      };
    });
  }, [assessmentById, openBatches, scriptQueries]);

  const loading = batchesLoading || assessmentsLoading;
  const scriptsLoading = scriptQueries.some((q) => q.isLoading);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Evaluations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (openBatches.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="text-lg">Evaluations</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Open grading sessions — resume at any stage.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {rows.map(({ batch, assessmentTitle, stage }) => (
            <li
              key={batch.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium">{assessmentTitle}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                      stageBadgeClass(stage.label)
                    )}
                  >
                    {stage.label}
                  </span>
                  {stage.summary ? (
                    <span className="text-xs text-muted-foreground">
                      {scriptsLoading ? "Loading…" : stage.summary}
                    </span>
                  ) : null}
                </div>
              </div>
              <Link
                href={`/classes/${classId}/evaluations/${batch.id}${
                  stage.label === "Identity" ||
                  stage.label === "Duplicates" ||
                  stage.label === "Duplicate"
                    ? "#identity-review"
                    : ""
                }`}
                className={buttonVariants({ size: "sm", variant: "primary" })}
              >
                {stage.cta}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
