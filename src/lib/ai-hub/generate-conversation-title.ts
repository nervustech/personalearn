import { generateText } from "ai";
import { generateConversationTitle } from "@/lib/ai-hub/conversation-title";
import { getChatModel } from "@/lib/ai/llm";

export async function generateAiConversationTitle(
  userMessage: string,
  assistantReply?: string
): Promise<string> {
  const trimmedUser = userMessage.trim();
  if (!trimmedUser) {
    return "New conversation";
  }

  try {
    const context = assistantReply
      ? `User asked: ${trimmedUser}\nAssistant replied: ${assistantReply.slice(0, 300)}`
      : `User asked: ${trimmedUser}`;

    const { text } = await generateText({
      model: getChatModel(),
      system:
        "Summarize a teacher's chat thread in 3–6 words. Reply with ONLY the title — no quotes, no punctuation at the end.",
      prompt: context,
    });

    const title = text.trim().replace(/^["']|["']$/g, "");
    if (title) {
      return generateConversationTitle(title);
    }
  } catch {
    // Fall back to truncating the first message when the model is unavailable.
  }

  return generateConversationTitle(trimmedUser);
}
