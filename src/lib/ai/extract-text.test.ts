import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectResourceFormat,
  ExtractTextError,
  extractTextFromUpload,
  maxBytesForFormat,
  MAX_BINARY_BYTES,
  MAX_TXT_BYTES,
  unsupportedTypeMessage,
} from "./extract-text";

const mockGenerateText = vi.fn();
const mockExtractPdfText = vi.fn();
const mockRequireGoogleKey = vi.fn();
const mockGetGeminiFlashModel = vi.fn();

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

vi.mock("unpdf", () => ({
  extractText: (...args: unknown[]) => mockExtractPdfText(...args),
}));

vi.mock("@/lib/ai/vision-model", () => ({
  getGeminiFlashModel: () => mockGetGeminiFlashModel(),
  requireGoogleGenerativeAiApiKey: () => mockRequireGoogleKey(),
}));

const mockGetVisionExtractionModel = vi.fn();
vi.mock("@/lib/ai/llm", () => ({
  getVisionExtractionModel: () => mockGetVisionExtractionModel(),
}));

describe("detectResourceFormat", () => {
  it("detects txt, pdf, and image formats", () => {
    expect(detectResourceFormat("notes.txt", "text/plain")).toBe("txt");
    expect(detectResourceFormat("scheme.pdf", "application/pdf")).toBe("pdf");
    expect(detectResourceFormat("scan.jpg", "image/jpeg")).toBe("image");
    expect(detectResourceFormat("photo.png", "image/png")).toBe("image");
  });

  it("returns null for unsupported types", () => {
    expect(detectResourceFormat("sheet.docx", "application/msword")).toBeNull();
    expect(unsupportedTypeMessage()).toMatch(/Unsupported file type/);
  });
});

describe("maxBytesForFormat", () => {
  it("uses different limits for txt and binary formats", () => {
    expect(maxBytesForFormat("txt")).toBe(MAX_TXT_BYTES);
    expect(maxBytesForFormat("pdf")).toBe(MAX_BINARY_BYTES);
    expect(maxBytesForFormat("image")).toBe(MAX_BINARY_BYTES);
  });
});

describe("extractTextFromUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGeminiFlashModel.mockReturnValue("gemini-model");
    mockRequireGoogleKey.mockReturnValue("test-key");
  });

  it("extracts plain text from txt uploads", async () => {
    const bytes = new TextEncoder().encode("Hello scheme");

    const text = await extractTextFromUpload({
      fileName: "scheme.txt",
      mimeType: "text/plain",
      bytes,
    });

    expect(text).toBe("Hello scheme");
    expect(mockExtractPdfText).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("extracts text from pdf uploads", async () => {
    mockExtractPdfText.mockResolvedValue({ text: "Week 3 fractions" });

    const text = await extractTextFromUpload({
      fileName: "scheme.pdf",
      mimeType: "application/pdf",
      bytes: new Uint8Array([1, 2, 3]),
    });

    expect(text).toBe("Week 3 fractions");
    expect(mockExtractPdfText).toHaveBeenCalled();
  });

  it("extracts text from image uploads via vision model", async () => {
    mockGenerateText.mockResolvedValue({ text: "Term 2 outline" });

    const text = await extractTextFromUpload({
      fileName: "notes.jpg",
      mimeType: "image/jpeg",
      bytes: new Uint8Array([9, 9, 9]),
    });

    expect(text).toBe("Term 2 outline");
    expect(mockGenerateText).toHaveBeenCalled();
  });

  it("rejects unsupported file types", async () => {
    await expect(
      extractTextFromUpload({
        fileName: "slides.pptx",
        mimeType: "application/vnd.ms-powerpoint",
        bytes: new Uint8Array([1]),
      })
    ).rejects.toMatchObject({
      code: "unsupported",
    } satisfies Partial<ExtractTextError>);
  });

  it("rejects empty extracted text", async () => {
    mockExtractPdfText.mockResolvedValue({ text: "   " });

    await expect(
      extractTextFromUpload({
        fileName: "blank.pdf",
        mimeType: "application/pdf",
        bytes: new Uint8Array([1]),
      })
    ).rejects.toMatchObject({
      code: "empty",
    } satisfies Partial<ExtractTextError>);
  });
});
