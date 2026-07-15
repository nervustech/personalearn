import { describe, expect, it } from "vitest";
import {
  pageUrlsForQuestion,
  reviewMarkerKind,
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
