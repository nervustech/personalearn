import type { SupabaseClient } from "@supabase/supabase-js";
import type { DraftPageImage } from "@/lib/evaluation/draft-question";
import {
  compareQuestionLabels,
  normalizeQuestionLabel,
} from "@/lib/evaluation/normalize-question";
import type { EvaluatedScriptPage } from "@/types/database";

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
  cache: Map<string, DraftPageImage>
): Promise<DraftPageImage> {
  const cached = cache.get(storagePath);
  if (cached) return cached;

  const { data: blob, error } = await supabase.storage
    .from("student_submissions")
    .download(storagePath);

  if (error || !blob) {
    throw new Error(error?.message ?? `Could not download ${storagePath}`);
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const image: DraftPageImage = {
    bytes,
    mimeType: mimeFromStoragePath(storagePath),
  };
  cache.set(storagePath, image);
  return image;
}
