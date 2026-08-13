import { NextResponse } from "next/server";
import { z } from "zod";
import { mapApiError } from "@/lib/ai-hub/api-errors";
import {
  createConversation,
  listConversationsForClass,
} from "@/lib/ai-hub/conversations";
import { generateConversationTitle } from "@/lib/ai-hub/conversation-title";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { createClient } from "@/lib/supabase/server";

const createBodySchema = z.object({
  classId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
});

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");

    if (!classId) {
      return NextResponse.json({ error: "classId is required" }, { status: 400 });
    }

    await requireTeacherClass(supabase, classId);
    const conversations = await listConversationsForClass(supabase, classId);

    return NextResponse.json({ conversations });
  } catch (error) {
    const { message, status } = mapApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const json = await request.json();
    const parsed = createBodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { classId, title } = parsed.data;
    const user = await requireTeacherClass(supabase, classId);
    const conversation = await createConversation(supabase, {
      classId,
      teacherId: user.id,
      title: title ? generateConversationTitle(title) : "New conversation",
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    const { message, status } = mapApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
