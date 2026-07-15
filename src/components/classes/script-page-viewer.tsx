"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ReviewMarkerBadge } from "@/components/classes/review-marker-badge";
import type { ReviewMarkerKind } from "@/lib/evaluation/page-images";
import type { ScriptPageUrl } from "@/lib/evaluation/page-images";
import type { QuestionEvaluationStatus } from "@/types/database";

type ScriptPageViewerProps = {
  pages: ScriptPageUrl[];
  markerKind: ReviewMarkerKind;
  markerStatus?: QuestionEvaluationStatus;
  questionLabel?: string;
  emptyMessage?: string;
};

export function ScriptPageViewer({
  pages,
  markerKind,
  markerStatus,
  questionLabel,
  emptyMessage = "No page images for this question.",
}: ScriptPageViewerProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [pages]);

  const safeIndex = pages.length === 0 ? 0 : Math.min(index, pages.length - 1);
  const page = pages[safeIndex];

  if (pages.length === 0 || !page) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/60">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <p className="truncate text-sm text-muted-foreground">
          {questionLabel ? `Q${questionLabel} · ` : ""}
          {page.fileName}
          {pages.length > 1
            ? ` · page ${safeIndex + 1} of ${pages.length}`
            : ""}
        </p>
        <ReviewMarkerBadge kind={markerKind} status={markerStatus} />
      </div>
      <div className="bg-muted/20 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={page.url ?? undefined}
          alt={page.fileName}
          className="mx-auto max-h-[min(85vh,56rem)] w-full object-contain"
        />
      </div>
      {pages.length > 1 ? (
        <div className="flex justify-between gap-2 border-t border-border px-3 py-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={safeIndex <= 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            Prev page
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={safeIndex >= pages.length - 1}
            onClick={() =>
              setIndex((i) => Math.min(pages.length - 1, i + 1))
            }
          >
            Next page
          </Button>
        </div>
      ) : null}
    </div>
  );
}
