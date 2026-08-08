import { describe, expect, it } from "vitest";
import {
  pageUrlsForQuestion,
  resolvePageNumberMode,
  reviewMarkerKind,
  sheetPageFromFileName,
} from "./page-images";
import type { EvaluatedScriptPage } from "@/types/database";

const pages: EvaluatedScriptPage[] = [
  {
    storagePath: "c/b/p1.jpg",
    fileName: "p1.jpg",
    uploadIndex: 0,
    questionNumbers: ["1", "1a"],
  },
  {
    storagePath: "c/b/p2.jpg",
    fileName: "p2.jpg",
    uploadIndex: 1,
    questionNumbers: ["2"],
  },
];

const pageUrls = [
  {
    storagePath: "c/b/p1.jpg",
    fileName: "p1.jpg",
    uploadIndex: 0,
    url: "https://example.com/p1",
  },
  {
    storagePath: "c/b/p2.jpg",
    fileName: "p2.jpg",
    uploadIndex: 1,
    url: "https://example.com/p2",
  },
];

describe("pageUrlsForQuestion", () => {
  it("returns signed URLs for pages that list the question", () => {
    expect(pageUrlsForQuestion(pages, pageUrls, "2")).toEqual([pageUrls[1]]);
    expect(pageUrlsForQuestion(pages, pageUrls, "1a")).toEqual([pageUrls[0]]);
  });

  it("falls back to all pageUrls when no page lists the question", () => {
    expect(pageUrlsForQuestion(pages, pageUrls, "9")).toEqual(pageUrls);
  });

  it("maps page_number to page_order packet index (not uploadIndex)", () => {
    expect(pageUrlsForQuestion(pages, pageUrls, "9", 2)).toEqual([pageUrls[1]]);
    expect(pageUrlsForQuestion(pages, pageUrls, "2", 1)).toEqual([pageUrls[0]]);
  });

  it("uses packet order when uploadIndex is reversed (Sharon-style)", () => {
    const reversed: EvaluatedScriptPage[] = [
      {
        storagePath: "c/b/p2.jpg",
        fileName: "1990.2.jpg",
        uploadIndex: 1,
        questionNumbers: ["1", "2", "3"],
      },
      {
        storagePath: "c/b/p1.jpg",
        fileName: "1990.1.jpg",
        uploadIndex: 0,
        questionNumbers: ["1", "2", "3", "4", "5"],
      },
    ];
    const urls = [
      {
        storagePath: "c/b/p2.jpg",
        fileName: "1990.2.jpg",
        uploadIndex: 1,
        url: "https://example.com/p2",
      },
      {
        storagePath: "c/b/p1.jpg",
        fileName: "1990.1.jpg",
        uploadIndex: 0,
        url: "https://example.com/p1",
      },
    ];
    // page_number 1 = first image in evaluate packet = sheet page 2
    expect(pageUrlsForQuestion(reversed, urls, "1", 1)).toEqual([urls[0]]);
    expect(pageUrlsForQuestion(reversed, urls, "1", 2)).toEqual([urls[1]]);
  });

  it("uses sheet filename page when mode is sheet (Jane-style)", () => {
    const reversed: EvaluatedScriptPage[] = [
      {
        storagePath: "c/b/p2.jpg",
        fileName: "1196.2.jpg",
        uploadIndex: 0,
        questionNumbers: ["2", "3", "1"],
      },
      {
        storagePath: "c/b/p1.jpg",
        fileName: "1196.1.jpg",
        uploadIndex: 1,
        questionNumbers: ["1", "2", "3", "4", "5", "1", "2"],
      },
    ];
    const urls = [
      {
        storagePath: "c/b/p2.jpg",
        fileName: "1196.2.jpg",
        uploadIndex: 0,
        url: "https://example.com/p2",
      },
      {
        storagePath: "c/b/p1.jpg",
        fileName: "1196.1.jpg",
        uploadIndex: 1,
        url: "https://example.com/p1",
      },
    ];
    expect(pageUrlsForQuestion(reversed, urls, "1", 1, "sheet")).toEqual([
      urls[1],
    ]);
    expect(pageUrlsForQuestion(reversed, urls, "1", 2, "sheet")).toEqual([
      urls[0],
    ]);
  });
});

describe("resolvePageNumberMode", () => {
  it("keeps packet mode when section A lands on denser packet page (Sharon)", () => {
    const pages: EvaluatedScriptPage[] = [
      {
        storagePath: "c/b/p2.jpg",
        fileName: "1990.2.jpg",
        uploadIndex: 3,
        questionNumbers: ["1", "2", "3"],
      },
      {
        storagePath: "c/b/p1.jpg",
        fileName: "1990.1.jpg",
        uploadIndex: 2,
        questionNumbers: ["1", "2", "3", "4", "5"],
      },
    ];
    const mode = resolvePageNumberMode(pages, [
      { section: "A", page_number: 2 },
      { section: "A", page_number: 2 },
      { section: "D", page_number: 1 },
    ]);
    expect(mode).toBe("packet");
  });

  it("selects sheet mode when section A packet page is not the denser page (Jane)", () => {
    const pages: EvaluatedScriptPage[] = [
      {
        storagePath: "c/b/p2.jpg",
        fileName: "1196.2.jpg",
        uploadIndex: 0,
        questionNumbers: ["2", "3", "1", "2", "3"],
      },
      {
        storagePath: "c/b/p1.jpg",
        fileName: "1196.1.jpg",
        uploadIndex: 1,
        questionNumbers: ["1", "2", "3", "4", "5", "1", "2", "3", "4", "1"],
      },
    ];
    const mode = resolvePageNumberMode(pages, [
      { section: "A", page_number: 1 },
      { section: "A", page_number: 1 },
      { section: "D", page_number: 2 },
    ]);
    expect(mode).toBe("sheet");
  });

  it("parses sheet page from admission.page filenames", () => {
    expect(sheetPageFromFileName("1196.1.jpg")).toBe(1);
    expect(sheetPageFromFileName("1990.2.jpg")).toBe(2);
  });
});

describe("reviewMarkerKind", () => {
  it("maps awarded/max to Option A marker kinds", () => {
    expect(reviewMarkerKind(5, 5)).toBe("correct");
    expect(reviewMarkerKind(0, 5)).toBe("incorrect");
    expect(reviewMarkerKind(3, 5)).toBe("partial");
    expect(reviewMarkerKind(null, 5)).toBe("unknown");
    expect(reviewMarkerKind(2, null)).toBe("unknown");
    expect(reviewMarkerKind(1, 0)).toBe("unknown");
  });
});
