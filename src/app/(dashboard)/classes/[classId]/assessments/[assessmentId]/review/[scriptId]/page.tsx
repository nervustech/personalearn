"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SplitPaneScriptReview } from "@/components/classes/eval-review-workspace";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScriptReviewDto } from "@/lib/evaluation/identity";
import type { Assessment } from "@/types/database";

type ReviewPageProps = {
  params: Promise<{
    classId: string;
    assessmentId: string;
    scriptId: string;
  }>;
};

type ReviewSibling = {
  id: string;
  student_name: string | null;
  read_admission_number: string | null;
  status: string;
};

async function fetchScriptReview(
  classId: string,
  assessmentId: string,
  scriptId: string
) {
  const response = await fetch(
    `/api/classes/${encodeURIComponent(classId)}/assessments/${encodeURIComponent(assessmentId)}/review/${encodeURIComponent(scriptId)}`
  );
  const payload = (await response.json()) as {
    script?: ScriptReviewDto;
    batchId?: string;
    assessment?: Assessment | null;
    siblings?: ReviewSibling[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not load review");
  }
  return payload;
}

export default function ScriptReviewPage({ params }: ReviewPageProps) {
  const { classId, assessmentId, scriptId } = use(params);
  const { data, isLoading, error } = useQuery({
    queryKey: ["script-review", classId, assessmentId, scriptId],
    queryFn: () => fetchScriptReview(classId, assessmentId, scriptId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-6 w-72" />
        <Skeleton className="h-[480px] w-full" />
      </div>
    );
  }

  if (error || !data?.script || !data.batchId) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Review not available"}
        </p>
        <Link href={`/classes/${classId}`} className="text-sm underline">
          Back to class
        </Link>
      </div>
    );
  }

  const assessmentTitle = data.assessment?.title?.trim() || "Assessment";
  const strand =
    data.assessment?.linked_strand?.trim() || "General";
  const subStrand = data.assessment?.linked_sub_strand ?? null;

  return (
    <div className="flex min-h-0 flex-col gap-3 p-4 lg:h-[calc(100dvh-1rem)] lg:overflow-hidden">
      <Breadcrumbs
        items={[
          { label: "Classes", href: "/classes" },
          { label: "Class", href: `/classes/${classId}` },
          {
            label: assessmentTitle,
            href: `/classes/${classId}/evaluations/${data.batchId}`,
          },
          { label: data.script.student_name ?? "Student" },
        ]}
      />
      <div className="min-h-0 flex-1">
        <SplitPaneScriptReview
          script={data.script}
          classId={classId}
          batchId={data.batchId}
          assessmentId={assessmentId}
          strand={strand}
          subStrand={subStrand}
          siblings={data.siblings ?? []}
        />
      </div>
    </div>
  );
}
