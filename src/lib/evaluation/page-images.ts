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

/** Sheet page from names like `1196.1.jpg` / `1990_2.png`. */
export function sheetPageFromFileName(fileName: string): number | null {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  const match = base.match(/(?:^|[._-])(\d+)\.[a-z0-9]+$/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export type PageNumberMode = "packet" | "sheet";

/**
 * Models sometimes number pages by evaluate-packet index, sometimes by sheet
 * page on the filename. Prefer the convention that lands early-section work
 * on the denser index page (more questions_found).
 */
export function resolvePageNumberMode(
  pages: EvaluatedScriptPage[],
  questions: Array<{
    section?: string | null;
    page_number?: number | null;
  }>
): PageNumberMode {
  if (pages.length < 2) return "packet";

  const denser = [...pages].sort(
    (a, b) =>
      coerceLabels(b.questionNumbers).length -
      coerceLabels(a.questionNumbers).length
  )[0];
  if (!denser || coerceLabels(denser.questionNumbers).length === 0) {
    return "packet";
  }

  const early = questions.filter((q) => {
    const section = (q.section ?? "").trim().toUpperCase();
    return section === "A" || section === "1" || section === "I";
  });
  const pool = early.length > 0 ? early : questions;
  const pageCounts = new Map<number, number>();
  for (const q of pool) {
    const p = q.page_number;
    if (p == null || !Number.isInteger(p) || p < 1) continue;
    pageCounts.set(p, (pageCounts.get(p) ?? 0) + 1);
  }
  let modalPage: number | null = null;
  let modalCount = 0;
  for (const [page, count] of pageCounts) {
    if (count > modalCount) {
      modalPage = page;
      modalCount = count;
    }
  }
  if (modalPage == null) return "packet";

  const packetPage = pages[modalPage - 1];
  if (packetPage?.storagePath === denser.storagePath) return "packet";

  const sheetPage = pages.find(
    (p) => sheetPageFromFileName(p.fileName) === modalPage
  );
  if (sheetPage?.storagePath === denser.storagePath) return "sheet";

  return "packet";
}

function pageForPageNumber(
  pages: EvaluatedScriptPage[],
  pageNumber: number,
  mode: PageNumberMode
): EvaluatedScriptPage | undefined {
  if (mode === "sheet") {
    const bySheet = pages.find(
      (p) => sheetPageFromFileName(p.fileName) === pageNumber
    );
    if (bySheet) return bySheet;
  }
  if (pageNumber >= 1 && pageNumber <= pages.length) {
    return pages[pageNumber - 1];
  }
  return undefined;
}

/**
 * Map a graded question onto signed pageUrls for the review UI.
 *
 * Default: evaluate `page_number` is 1-based into `page_order` (packet order).
 * When `pageNumberMode` is `"sheet"`, map via filename sheet page instead
 * (needed when the model numbered by booklet page while packet order is reversed).
 */
export function pageUrlsForQuestion(
  pages: EvaluatedScriptPage[],
  pageUrls: ScriptPageUrl[],
  questionLabel: string,
  pageNumber?: number | null,
  pageNumberMode: PageNumberMode = "packet"
): ScriptPageUrl[] {
  const byPath = new Map(pageUrls.map((p) => [p.storagePath, p]));

  if (pageNumber != null && Number.isInteger(pageNumber) && pageNumber >= 1) {
    const page = pageForPageNumber(pages, pageNumber, pageNumberMode);
    const url = page ? byPath.get(page.storagePath) : undefined;
    if (url) return [url];
  }

  const matchedPages = pagesForQuestion(pages, questionLabel);
  const urls: ScriptPageUrl[] = [];
  const seen = new Set<string>();
  for (const page of matchedPages) {
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
