"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ReviewMarkerBadge } from "@/components/classes/review-marker-badge";
import type { ReviewMarkerKind } from "@/lib/evaluation/page-images";
import type { ScriptPageUrl } from "@/lib/evaluation/page-images";
import type { QuestionEvaluationStatus, QuestionVerticalBounds } from "@/types/database";

type ScriptPageViewerProps = {
  pages: ScriptPageUrl[];
  markerKind: ReviewMarkerKind;
  markerStatus?: QuestionEvaluationStatus;
  questionLabel?: string;
  verticalBounds?: QuestionVerticalBounds | null;
  emptyMessage?: string;
};

export function ScriptPageViewer({
  pages,
  markerKind,
  markerStatus,
  questionLabel,
  verticalBounds,
  emptyMessage = "No page images for this question.",
}: ScriptPageViewerProps) {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setIndex(0);
  }, [pages, questionLabel]);

  const scrollToBounds = useCallback(() => {
    const el = scrollRef.current;
    const img = imgRef.current;
    if (!el || !verticalBounds || !img || img.clientHeight <= 0) return;
    const top =
      img.offsetTop + img.clientHeight * verticalBounds.top_percent - 16;
    el.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [verticalBounds]);

  useEffect(() => {
    scrollToBounds();
  }, [scrollToBounds, index]);

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
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-card/95 shadow-sm backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-1.5">
        <p className="truncate text-xs text-muted-foreground">
          {questionLabel ? `Q${questionLabel}` : "Scan"}
          {pages.length > 1
            ? ` · ${safeIndex + 1}/${pages.length}`
            : ""}
        </p>
        <ReviewMarkerBadge kind={markerKind} status={markerStatus} />
      </div>

      {/* Single scroll owner for the script image pane */}
      <div
        ref={scrollRef}
        key={`${questionLabel ?? "q"}-${page.storagePath}-${safeIndex}`}
        className="flex min-h-0 flex-1 justify-center overflow-y-auto overscroll-contain bg-muted/40 px-3 py-4 sm:px-5 sm:py-5"
      >
        <div className="w-full max-w-[min(100%,48rem)] overflow-hidden rounded-sm bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={page.url ?? undefined}
            alt={page.fileName}
            className="mx-auto block h-auto w-full object-contain"
            onLoad={scrollToBounds}
          />
        </div>
      </div>

      {pages.length > 1 ? (
        <div className="flex shrink-0 justify-between gap-2 border-t border-border px-3 py-1.5">
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
