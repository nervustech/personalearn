import { NextResponse } from "next/server";
import { z } from "zod";
import { mapApiError } from "@/lib/ai-hub/api-errors";
import {
  deleteConversation,
  getConversationWithMessages,
  truncateConversationFromIndex,
} from "@/lib/ai-hub/conversations";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const patchSchema = z.object({
  fromMessageIndex: z.number().int().min(0),
});

export async function GET(_request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Not authenticated");
    }

    const { conversation, messages } = await getConversationWithMessages(
      supabase,
      id,
      user.id
    );

    await requireTeacherClass(supabase, conversation.class_id);

    return NextResponse.json({ conversation, messages });
  } catch (error) {
    const { message, status } = mapApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Not authenticated");
    }

    await deleteConversation(supabase, id, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const { message, status } = mapApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Not authenticated");
    }

    const json = await request.json();
    const parsed = patchSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { conversation } = await getConversationWithMessages(supabase, id, user.id);
    await requireTeacherClass(supabase, conversation.class_id);

    await truncateConversationFromIndex(
      supabase,
      id,
      user.id,
      parsed.data.fromMessageIndex
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const { message, status } = mapApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
