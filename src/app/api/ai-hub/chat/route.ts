import {
  appendConversationMessages,
  countConversationMessages,
  createConversation,
  getConversationWithMessages,
  getLatestUserMessageText,
  requireConversationAccess,
  truncateConversationFromIndex,
  updateConversationTitle,
} from "@/lib/ai-hub/conversations";
import {
  buildClassAssistantSystemPrompt,
  getClassContext,
} from "@/lib/ai-hub/class-context";
import { generateConversationTitle } from "@/lib/ai-hub/conversation-title";
import { generateAiConversationTitle } from "@/lib/ai-hub/generate-conversation-title";
import { getMessageText } from "@/lib/ai-hub/message-content";
import { getChatModel } from "@/lib/ai/llm";
import { requireTeacherClass } from "@/lib/auth/require-teacher-class";
import { createClient } from "@/lib/supabase/server";
import {
  convertToModelMessages,
  smoothStream,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { mapApiError } from "@/lib/ai-hub/api-errors";

const bodySchema = z.object({
  classId: z.string().uuid(),
  conversationId: z.string().uuid().optional().nullable(),
  messages: z.array(z.custom<UIMessage>()),
  id: z.string().optional(),
  trigger: z.string().optional(),
  messageId: z.string().optional(),
  truncateFromMessageIndex: z.number().int().min(0).optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { classId, conversationId, messages, truncateFromMessageIndex } =
      parsed.data;
    const user = await requireTeacherClass(supabase, classId);
    const classContext = await getClassContext(supabase, classId);
    const systemPrompt = buildClassAssistantSystemPrompt(classContext);

    let activeConversationId = conversationId ?? null;

    if (activeConversationId) {
      const conversation = await requireConversationAccess(
        supabase,
        activeConversationId,
        user.id
      );

      if (conversation.class_id !== classId) {
        throw new Error("Conversation not found");
      }

      if (truncateFromMessageIndex !== undefined) {
        await truncateConversationFromIndex(
          supabase,
          activeConversationId,
          user.id,
          truncateFromMessageIndex
        );
      }
    } else {
      const latestUserMessage = [...messages]
        .reverse()
        .find((message) => message.role === "user");
      const titleSource = latestUserMessage
        ? getMessageText(latestUserMessage)
        : "New conversation";
      const conversation = await createConversation(supabase, {
        classId,
        teacherId: user.id,
        title: generateConversationTitle(titleSource),
      });
      activeConversationId = conversation.id;
    }

    const { messages: persistedMessages } = await getConversationWithMessages(
      supabase,
      activeConversationId,
      user.id
    );
    const persistedUserText = getLatestUserMessageText(persistedMessages);
    const latestUserText = getLatestUserMessageText(messages);

    if (latestUserText && latestUserText !== persistedUserText) {
      await appendConversationMessages(supabase, activeConversationId, [
        {
          role: "user",
          content: latestUserText,
        },
      ]);
    }

    const result = streamText({
      model: getChatModel(),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      experimental_transform: smoothStream({ delayInMs: null, chunking: "word" }),
    });

    return result.toUIMessageStreamResponse({
      headers: {
        "X-Conversation-Id": activeConversationId,
      },
      onEnd: async ({ responseMessage, isAborted }) => {
        if (isAborted) {
          return;
        }

        const assistantText = getMessageText(responseMessage).trim();
        if (!assistantText) {
          return;
        }

        await appendConversationMessages(supabase, activeConversationId!, [
          {
            role: "assistant",
            content: assistantText,
          },
        ]);

        const messageCount = await countConversationMessages(
          supabase,
          activeConversationId!
        );

        if (messageCount === 2 && latestUserText) {
          const title = await generateAiConversationTitle(
            latestUserText,
            assistantText
          );
          await updateConversationTitle(supabase, activeConversationId!, title);
        }
      },
      onError: () => "The assistant could not respond. Please try again.",
    });
  } catch (error) {
    const { message, status } = mapApiError(error);
    return Response.json({ error: message }, { status });
  }
}
