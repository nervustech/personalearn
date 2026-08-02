import type { SupabaseClient } from "@supabase/supabase-js";
import {
  compareQuestionLabels,
  normalizeQuestionLabel,
} from "@/lib/evaluation/normalize-question";
import type { EvaluatedScriptPage } from "@/types/database";

export type PageImageBytes = {
  bytes: Uint8Array;
  mimeType: string;
};

export function mimeFromStoragePath(storagePath: string): string {
  return storagePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

export function asScriptPages(pageOrder: unknown): EvaluatedScriptPage[] {
  if (!Array.isArray(pageOrder)) return [];
  return pageOrder as EvaluatedScriptPage[];
}

function coerceLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeQuestionLabel(item))
    .filter((x): x is string => Boolean(x));
}

export function uniqueQuestionLabelsFromPages(
  pages: EvaluatedScriptPage[]
): string[] {
  const set = new Set<string>();
  for (const page of pages) {
    for (const q of coerceLabels(page.questionNumbers)) {
      set.add(q);
    }
  }
  return [...set].sort(compareQuestionLabels);
}

/** Prefer pages that list the question; fall back to all pages. */
export function pagesForQuestion(
  pages: EvaluatedScriptPage[],
  questionLabel: string
): EvaluatedScriptPage[] {
  const matched = pages.filter((p) =>
    coerceLabels(p.questionNumbers).includes(questionLabel)
  );
  return matched.length > 0 ? matched : pages;
}

export async function downloadPageBytes(
  supabase: SupabaseClient,
  storagePath: string,
  cache: Map<string, PageImageBytes>
): Promise<PageImageBytes> {
  const cached = cache.get(storagePath);
  if (cached) return cached;

  const { data: blob, error } = await supabase.storage
    .from("student_submissions")
    .download(storagePath);

  if (error || !blob) {
    throw new Error(error?.message ?? `Could not download ${storagePath}`);
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const image: PageImageBytes = {
    bytes,
    mimeType: mimeFromStoragePath(storagePath),
  };
  cache.set(storagePath, image);
  return image;
}

export type ScriptPageUrl = {
  storagePath: string;
  uploadIndex: number;
  fileName: string;
  url: string | null;
};

/** Map pagesForQuestion results onto signed pageUrls for the review UI. */
export function pageUrlsForQuestion(
  pages: EvaluatedScriptPage[],
  pageUrls: ScriptPageUrl[],
  questionLabel: string,
  pageNumber?: number | null
): ScriptPageUrl[] {
  const matchedPages = pagesForQuestion(pages, questionLabel);
  const sorted = [...matchedPages].sort((a, b) => a.uploadIndex - b.uploadIndex);
  const targetPages =
    pageNumber != null &&
    Number.isInteger(pageNumber) &&
    pageNumber >= 1 &&
    pageNumber <= sorted.length
      ? [sorted[pageNumber - 1]!]
      : sorted;

  const byPath = new Map(pageUrls.map((p) => [p.storagePath, p]));
  const urls: ScriptPageUrl[] = [];
  const seen = new Set<string>();
  for (const page of targetPages) {
    if (seen.has(page.storagePath)) continue;
    seen.add(page.storagePath);
    const url = byPath.get(page.storagePath);
    if (url) urls.push(url);
  }
  return urls.length > 0 ? urls : pageUrls;
}

export type ReviewMarkerKind = "correct" | "incorrect" | "partial" | "unknown";

/** Option A grounded marker from awarded/max (not pixel bboxes). */
export function reviewMarkerKind(
  awarded: number | null,
  max: number | null
): ReviewMarkerKind {
  if (awarded == null || max == null || max <= 0) return "unknown";
  if (awarded <= 0) return "incorrect";
  if (awarded >= max) return "correct";
  return "partial";
}
