import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import { ExtractTextError } from "@/lib/ai/extract-text";
import { materializeAttachmentText } from "@/lib/ai-hub/chat-attachments-server";

const mockExtractTextFromUpload = vi.fn();

vi.mock("@/lib/ai/extract-text", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/extract-text")>(
    "@/lib/ai/extract-text"
  );
  return {
    ...actual,
    extractTextFromUpload: (...args: unknown[]) =>
      mockExtractTextFromUpload(...args),
  };
});

function userMessage(parts: UIMessage["parts"]): UIMessage {
  return {
    id: "user-1",
    role: "user",
    parts,
  };
}

describe("materializeAttachmentText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces a txt data-URL file part with extracted text", async () => {
    mockExtractTextFromUpload.mockResolvedValue("Hello scheme");
    const url = `data:text/plain;base64,${btoa("Hello scheme")}`;

    const [message] = await materializeAttachmentText([
      userMessage([
        { type: "text", text: "Summarize this" },
        {
          type: "file",
          mediaType: "text/plain",
          filename: "notes.txt",
          url,
        },
      ]),
    ]);

    expect(mockExtractTextFromUpload).toHaveBeenCalledOnce();
    expect(message.parts.some((part) => part.type === "file")).toBe(false);
    expect(
      message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("")
    ).toContain("Hello scheme");
  });

  it("stubs file parts that are not readable data URLs", async () => {
    const [message] = await materializeAttachmentText([
      userMessage([
        {
          type: "file",
          mediaType: "text/plain",
          filename: "notes.txt",
          url: "blob:https://personalearn.vercel.app/abc",
        },
      ]),
    ]);

    expect(mockExtractTextFromUpload).not.toHaveBeenCalled();
    expect(
      message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("")
    ).toMatch(/notes\.txt — could not read contents/);
  });

  it("throws when image extraction is missing Gemini config", async () => {
    mockExtractTextFromUpload.mockRejectedValue(
      new ExtractTextError(
        "Missing GOOGLE_GENERATIVE_AI_API_KEY. Add it to .env.local for image uploads.",
        "config"
      )
    );
    const url = `data:image/png;base64,${btoa("fake-png")}`;

    await expect(
      materializeAttachmentText([
        userMessage([
          {
            type: "file",
            mediaType: "image/png",
            filename: "scan.png",
            url,
          },
        ]),
      ])
    ).rejects.toMatchObject({
      code: "config",
    } satisfies Partial<ExtractTextError>);
  });

  it("keeps a stub for non-config extract failures", async () => {
    mockExtractTextFromUpload.mockRejectedValue(
      new ExtractTextError(
        "Could not extract text from this file. Try a clearer scan or a different format.",
        "extract"
      )
    );
    const url = `data:application/pdf;base64,${btoa("fake-pdf")}`;

    const [message] = await materializeAttachmentText([
      userMessage([
        {
          type: "file",
          mediaType: "application/pdf",
          filename: "scheme.pdf",
          url,
        },
      ]),
    ]);

    expect(
      message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("")
    ).toMatch(/scheme\.pdf — Could not extract text/);
  });
});
