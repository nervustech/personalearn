import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mockRequireTeacherClass = vi.fn();
const mockListConversationsForClass = vi.fn();
const mockCreateConversation = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({})),
}));

vi.mock("@/lib/auth/require-teacher-class", () => ({
  requireTeacherClass: (...args: unknown[]) => mockRequireTeacherClass(...args),
}));

vi.mock("@/lib/ai-hub/conversations", () => ({
  listConversationsForClass: (...args: unknown[]) =>
    mockListConversationsForClass(...args),
  createConversation: (...args: unknown[]) => mockCreateConversation(...args),
}));

describe("/api/ai-hub/conversations", () => {
  const classId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTeacherClass.mockResolvedValue({ id: "teacher-1" });
  });

  it("returns conversations for an owned class", async () => {
    mockListConversationsForClass.mockResolvedValue([
      { id: "conv-1", title: "Week 3 planning" },
    ]);

    const response = await GET(
      new Request(
        `http://localhost/api/ai-hub/conversations?classId=${classId}`
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.conversations).toHaveLength(1);
    expect(mockRequireTeacherClass).toHaveBeenCalledWith({}, classId);
  });

  it("returns 403 when the teacher does not own the class", async () => {
    mockRequireTeacherClass.mockRejectedValue(new Error("Class not found"));

    const response = await GET(
      new Request(
        `http://localhost/api/ai-hub/conversations?classId=${classId}`
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Class not found");
  });

  it("creates a conversation for the active class", async () => {
    mockCreateConversation.mockResolvedValue({
      id: "conv-2",
      title: "Fractions assignment",
    });

    const response = await POST(
      new Request("http://localhost/api/ai-hub/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          title: "Fractions assignment",
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.conversation.id).toBe("conv-2");
    expect(mockCreateConversation).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        classId,
        teacherId: "teacher-1",
      })
    );
  });
});
