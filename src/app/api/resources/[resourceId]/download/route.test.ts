import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mockRequireTeacherResource = vi.fn();
const mockCreateSignedUrl = vi.fn();
const mockRenderResourcePdf = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    storage: {
      from: () => ({
        createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args),
      }),
    },
  })),
}));

vi.mock("@/lib/resources/class-resources", () => ({
  requireTeacherResource: (...args: unknown[]) =>
    mockRequireTeacherResource(...args),
}));

vi.mock("@/lib/resources/render-pdf", () => ({
  pdfFileName: (title: string) =>
    `${title.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 80) || "resource"}.pdf`,
  renderResourcePdf: (...args: unknown[]) => mockRenderResourcePdf(...args),
}));

describe("/api/resources/[resourceId]/download", () => {
  const resourceId = "22222222-2222-4222-8222-222222222222";
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example/original.pdf" },
      error: null,
    });
    mockRenderResourcePdf.mockResolvedValue(pdfBytes);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("storage.example/original.pdf")) {
          return new Response(pdfBytes, {
            status: 200,
            headers: { "Content-Type": "application/pdf" },
          });
        }
        return new Response("not found", { status: 404 });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects to the original file for PDF uploads", async () => {
    mockRequireTeacherResource.mockResolvedValue({
      id: resourceId,
      title: "Uploaded worksheet",
      ai_generated: false,
      raw_content: {
        mimeType: "application/pdf",
        storagePath: "class/abc/file.pdf",
        fileName: "file.pdf",
        text: "extracted flat text that must not become the download",
      },
    });

    const response = await GET(
      new Request(`http://localhost/api/resources/${resourceId}/download`),
      { params: Promise.resolve({ resourceId }) }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://storage.example/original.pdf"
    );
    expect(mockCreateSignedUrl).toHaveBeenCalledWith("class/abc/file.pdf", 3600);
  });

  it("proxies the original PDF inline for iframe embedding", async () => {
    mockRequireTeacherResource.mockResolvedValue({
      id: resourceId,
      title: "Uploaded worksheet",
      ai_generated: false,
      raw_content: {
        mimeType: "application/pdf",
        storagePath: "class/abc/file.pdf",
        fileName: "file.pdf",
        text: "extracted",
      },
    });

    const response = await GET(
      new Request(
        `http://localhost/api/resources/${resourceId}/download?inline=1`
      ),
      { params: Promise.resolve({ resourceId }) }
    );
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("inline");
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
    expect(mockCreateSignedUrl).toHaveBeenCalledWith("class/abc/file.pdf", 3600);
    expect(fetch).toHaveBeenCalledWith("https://storage.example/original.pdf");
  });

  it("exports AI/text as PDF even when a .txt storagePath exists", async () => {
    mockRequireTeacherResource.mockResolvedValue({
      id: resourceId,
      title: "AI worksheet",
      ai_generated: true,
      raw_content: {
        mimeType: "text/plain",
        storagePath: "class/abc/file.txt",
        text: "# Question 1\n\nSolve 3/4 + 1/2.",
      },
    });

    const response = await GET(
      new Request(`http://localhost/api/resources/${resourceId}/download`),
      { params: Promise.resolve({ resourceId }) }
    );
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(
      "AI-worksheet.pdf"
    );
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it("generates a PDF when there is text and no original binary", async () => {
    mockRequireTeacherResource.mockResolvedValue({
      id: resourceId,
      title: "Fractions worksheet",
      ai_generated: false,
      raw_content: { text: "# Question 1\n\nSolve 3/4 + 1/2." },
    });

    const response = await GET(
      new Request(`http://localhost/api/resources/${resourceId}/download`),
      { params: Promise.resolve({ resourceId }) }
    );
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
  });

  it("returns 404 when a resource has no text and no original file", async () => {
    mockRequireTeacherResource.mockResolvedValue({
      id: resourceId,
      title: "Empty",
      ai_generated: false,
      raw_content: {},
    });

    const response = await GET(
      new Request(`http://localhost/api/resources/${resourceId}/download`),
      { params: Promise.resolve({ resourceId }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("No downloadable content for this resource");
  });
});
