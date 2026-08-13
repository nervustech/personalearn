import { describe, expect, it } from "vitest";
import {
  contentDispositionFileName,
  formatExtractedPlainText,
  isBinaryOriginalResource,
  isEditableTextResource,
  shouldExportResourceAsPdf,
} from "./format";

describe("resource format helpers", () => {
  it("formats extracted plain text for readable fallback display", () => {
    expect(
      formatExtractedPlainText("Line 1\r\nLine 2\n\n\n\nLine 3  \n")
    ).toBe("Line 1\nLine 2\n\nLine 3");
  });

  it("builds ASCII-safe Content-Disposition filenames", () => {
    expect(
      contentDispositionFileName(
        "Grade 7 — Scheme of Work Term 1, 2026 Class_ 7 East.pdf"
      )
    ).toBe("Grade-7-Scheme-of-Work-Term-1-2026-Class_-7-East.pdf");
  });

  it("detects binary originals", () => {
    expect(
      isBinaryOriginalResource({ mimeType: "application/pdf" })
    ).toBe(true);
    expect(isBinaryOriginalResource({ mimeType: "image/png" })).toBe(true);
    expect(isBinaryOriginalResource({ mimeType: "text/plain" })).toBe(false);
  });

  it("allows editing text/AI but not PDF/image", () => {
    expect(
      isEditableTextResource({
        ai_generated: true,
        raw_content: { mimeType: "text/plain", text: "hi" },
      })
    ).toBe(true);
    expect(
      isEditableTextResource({
        ai_generated: false,
        raw_content: { mimeType: "text/plain", text: "hi" },
      })
    ).toBe(true);
    expect(
      isEditableTextResource({
        ai_generated: false,
        raw_content: { mimeType: "application/pdf", text: "extracted" },
      })
    ).toBe(false);
  });

  it("exports AI/text as PDF and binaries as originals", () => {
    expect(
      shouldExportResourceAsPdf({
        ai_generated: true,
        raw_content: {
          mimeType: "text/plain",
          storagePath: "a.txt",
          text: "body",
        },
      })
    ).toBe(true);
    expect(
      shouldExportResourceAsPdf({
        ai_generated: false,
        raw_content: {
          mimeType: "application/pdf",
          storagePath: "a.pdf",
          text: "extracted",
        },
      })
    ).toBe(false);
  });
});
