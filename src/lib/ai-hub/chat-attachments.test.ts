import { describe, expect, it } from "vitest";
import {
  chatAttachmentAccept,
  validateChatAttachment,
  validateChatAttachments,
} from "@/lib/ai-hub/chat-attachments";
import { MAX_BINARY_BYTES, MAX_TXT_BYTES } from "@/lib/ai/resource-format";

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

    const bigPdf = new File([new Uint8Array(MAX_BINARY_BYTES + 1)], "big.pdf", {
      type: "application/pdf",
    });
    expect(validateChatAttachment(bigPdf)).toMatch(/5 MB/);
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
