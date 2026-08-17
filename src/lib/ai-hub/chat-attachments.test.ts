import { describe, expect, it } from "vitest";
import {
  chatAttachmentAccept,
  compactChatTransportBody,
  filesToFileUIParts,
  MAX_CHAT_FILE_BYTES,
  mediaTypeForFile,
  validateChatAttachment,
  validateChatAttachments,
} from "@/lib/ai-hub/chat-attachments";
import { MAX_TXT_BYTES } from "@/lib/ai/resource-format";

describe("validateChatAttachment", () => {
  it("accepts supported types within size limits", () => {
    expect(
      validateChatAttachment(
        new File(["hello"], "notes.txt", { type: "text/plain" })
      )
    ).toBeNull();
    expect(
      validateChatAttachment(
        new File([new Uint8Array(8)], "scan.jpg", { type: "image/jpeg" })
      )
    ).toBeNull();
  });

  it("rejects unsupported types", () => {
    expect(
      validateChatAttachment(
        new File(["x"], "notes.docx", {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        })
      )
    ).toMatch(/Unsupported file type/);
  });

  it("rejects oversized files", () => {
    const bigTxt = new File([new Uint8Array(MAX_TXT_BYTES + 1)], "big.txt", {
      type: "text/plain",
    });
    expect(validateChatAttachment(bigTxt)).toMatch(/2 MB/);

    const bigPdf = new File([new Uint8Array(MAX_CHAT_FILE_BYTES + 1)], "big.pdf", {
      type: "application/pdf",
    });
    expect(validateChatAttachment(bigPdf)).toMatch(/2 MB/);
  });
});

describe("validateChatAttachments", () => {
  it("enforces a per-message attachment cap", () => {
    const files = Array.from(
      { length: 6 },
      (_, i) => new File(["a"], `f${i}.txt`, { type: "text/plain" })
    );
    const result = validateChatAttachments(files);
    expect(result.accepted).toEqual([]);
    expect(result.error).toMatch(/up to 5/);
  });

  it("exposes the class-upload accept list", () => {
    expect(chatAttachmentAccept()).toContain(".pdf");
    expect(chatAttachmentAccept()).toContain(".png");
  });
});

describe("filesToFileUIParts", () => {
  it("converts files to data-URL file parts", async () => {
    const parts = await filesToFileUIParts([
      new File(["hello notes"], "notes.txt", { type: "text/plain" }),
    ]);

    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      type: "file",
      mediaType: "text/plain",
      filename: "notes.txt",
    });
    expect(parts[0].url).toMatch(/^data:text\/plain;base64,/);
    expect(atob(parts[0].url.split(",")[1] ?? "")).toBe("hello notes");
  });

  it("falls back to a filename mime type when File.type is empty", async () => {
    const file = new File(["png-bytes"], "scan.png");
    expect(file.type).toBe("");
    expect(mediaTypeForFile(file)).toBe("image/png");

    const [part] = await filesToFileUIParts([file]);
    expect(part.mediaType).toBe("image/png");
    expect(part.url).toMatch(/^data:image\/png;base64,/);
  });
});

describe("compactChatTransportBody", () => {
  it("strips historical file data URLs but keeps the latest user file", () => {
    const oldUrl = `data:text/plain;base64,${btoa("old notes")}`;
    const newUrl = `data:text/plain;base64,${btoa("new notes")}`;
    const body = JSON.stringify({
      classId: "11111111-1111-4111-8111-111111111111",
      messages: [
        {
          role: "user",
          parts: [
            { type: "file", filename: "old.txt", url: oldUrl },
            { type: "text", text: "first" },
          ],
        },
        { role: "assistant", parts: [{ type: "text", text: "ok" }] },
        {
          role: "user",
          parts: [
            { type: "file", filename: "new.txt", url: newUrl },
            { type: "text", text: "second" },
          ],
        },
      ],
    });

    const compacted = compactChatTransportBody(body);
    const parsed = JSON.parse(compacted.bodyStr) as {
      classId: string;
      messages: Array<{
        role: string;
        parts: Array<{ type: string; url?: string; filename?: string }>;
      }>;
    };

    expect(parsed.classId).toBe("11111111-1111-4111-8111-111111111111");
    expect(compacted.strippedFileParts).toBe(1);
    expect(parsed.messages[0].parts[0].url).toBe("data:,");
    expect(parsed.messages[2].parts[0].url).toBe(newUrl);
    expect(compacted.afterBytes).toBeLessThan(compacted.beforeBytes);
  });
});
