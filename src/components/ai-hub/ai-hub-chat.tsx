"use client";

import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, RotateCcw, Sparkles, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatMessage } from "@/components/ai-hub/chat-message";
import { ConversationSidebar } from "@/components/ai-hub/conversation-sidebar";
import { ThinkingBubble } from "@/components/ai-hub/thinking-bubble";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { conversationMessagesQueryKey } from "@/lib/hooks/use-conversation-messages";
import {
  conversationsQueryKey,
  useConversations,
} from "@/lib/hooks/use-conversations";
import { resourcesQueryKey } from "@/lib/hooks/use-resources";
import { assessmentsQueryKey } from "@/lib/hooks/use-evaluation";
import { useActiveClassStore } from "@/lib/store/active-class";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  "Summarise Week 3 from my scheme of work",
  "Draft a short fractions quiz for this class",
  "Suggest a practical CBC activity",
];

export function AiHubChat() {
  const activeClass = useActiveClassStore((state) => state.activeClass);
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [draft, setDraft] = useState("");
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<
    string | null
  >(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const setSelectedConversationIdRef = useRef(setSelectedConversationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevStatusRef = useRef<string>("ready");

  setSelectedConversationIdRef.current = setSelectedConversationId;

  const {
    data: conversations = [],
    isLoading: conversationsLoading,
  } = useConversations(activeClass?.id);

  const chatInstanceId = activeClass?.id ?? "none";

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai-hub/chat",
        body: () => ({
          classId: activeClass?.id,
          conversationId: conversationIdRef.current,
        }),
        fetch: async (input, init) => {
          const response = await globalThis.fetch(input, init);
          const conversationId = response.headers.get("X-Conversation-Id");

          if (
            conversationId &&
            conversationId !== conversationIdRef.current &&
            activeClass?.id
          ) {
            conversationIdRef.current = conversationId;
            setSelectedConversationIdRef.current(conversationId);
            void queryClient.invalidateQueries({
              queryKey: conversationsQueryKey(activeClass.id),
            });
          }

          return response;
        },
      }),
    [activeClass?.id, queryClient]
  );

  const {
    messages,
    sendMessage,
    status,
    error,
    setMessages,
    regenerate,
    stop,
    clearError,
  } = useChat({
    id: chatInstanceId,
    transport,
    experimental_throttle: 50,
    onFinish: ({ messages: finishedMessages }) => {
      if (conversationIdRef.current) {
        queryClient.setQueryData(
          conversationMessagesQueryKey(conversationIdRef.current),
          finishedMessages
        );
      }

      if (activeClass?.id) {
        void queryClient.invalidateQueries({
          queryKey: conversationsQueryKey(activeClass.id),
        });
        // Agent save_resource writes to class resources — keep the class page in sync.
        void queryClient.invalidateQueries({
          queryKey: resourcesQueryKey(activeClass.id),
        });
        // Gradable saves also create assessments (AC-5.16).
        void queryClient.invalidateQueries({
          queryKey: assessmentsQueryKey(activeClass.id),
        });
      }
    },
  });

  useEffect(() => {
    conversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    setSelectedConversationId(null);
    conversationIdRef.current = null;
    setMessages([]);
    setDraft("");
    clearError();
    setActionError(null);
    setEditingMessageId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when active class changes
  }, [activeClass?.id]);

  useEffect(() => {
    const wasGenerating =
      prevStatusRef.current === "streaming" ||
      prevStatusRef.current === "submitted";
    const isNowReady = status === "ready";
    prevStatusRef.current = status;

    if (wasGenerating && isNowReady) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSelectConversation(conversationId: string) {
    if (!activeClass) return;

    setLoadingConversation(true);
    clearError();
    setActionError(null);

    try {
      const response = await fetch(`/api/ai-hub/conversations/${conversationId}`);
      const payload = (await response.json()) as {
        messages?: UIMessage[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load conversation");
      }

      setSelectedConversationId(conversationId);
      conversationIdRef.current = conversationId;
      setMessages(payload.messages ?? []);
      queryClient.setQueryData(
        conversationMessagesQueryKey(conversationId),
        payload.messages ?? []
      );
    } catch (loadError) {
      setActionError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load conversation"
      );
      setMessages([]);
    } finally {
      setLoadingConversation(false);
    }
  }

  function handleNewConversation() {
    setSelectedConversationId(null);
    conversationIdRef.current = null;
    setMessages([]);
    setDraft("");
    clearError();
    setActionError(null);
    setEditingMessageId(null);
  }

  function handleEditMessage(messageId: string, text: string) {
    if (status === "streaming" || status === "submitted" || loadingConversation) {
      return;
    }

    setEditingMessageId(messageId);
    setDraft(text);
    clearError();
    setActionError(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const length = text.length;
      textareaRef.current?.setSelectionRange(length, length);
    });
  }

  function handleStop() {
    stop();
    setMessages((current) => {
      const last = current[current.length - 1];
      if (last?.role === "assistant") {
        return current.slice(0, -1);
      }
      return current;
    });
  }

  async function submitMessage(text: string) {
    if (!text.trim() || !activeClass || status === "streaming" || status === "submitted") {
      return;
    }

    clearError();
    setActionError(null);

    const trimmed = text.trim();
    const editingId = editingMessageId;

    try {
      if (editingId) {
        const fromIndex = messages.findIndex((message) => message.id === editingId);

        setEditingMessageId(null);
        setDraft("");

        await sendMessage(
          { text: trimmed, messageId: editingId },
          {
            body: {
              classId: activeClass.id,
              conversationId: conversationIdRef.current,
              ...(fromIndex !== -1 ? { truncateFromMessageIndex: fromIndex } : {}),
            },
          }
        );
        return;
      }

      setDraft("");
      await sendMessage(
        { text: trimmed },
        {
          body: {
            classId: activeClass.id,
            conversationId: conversationIdRef.current,
          },
        }
      );
    } catch (submitError) {
      setActionError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to send message"
      );
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submitMessage(draft);
  }

  async function handleDeleteConversation(conversationId: string) {
    setDeletingConversationId(conversationId);
    setActionError(null);

    try {
      const response = await fetch(`/api/ai-hub/conversations/${conversationId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete conversation");
      }

      if (selectedConversationId === conversationId) {
        handleNewConversation();
      }

      if (activeClass?.id) {
        await queryClient.invalidateQueries({
          queryKey: conversationsQueryKey(activeClass.id),
        });
      }
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete conversation"
      );
    } finally {
      setDeletingConversationId(null);
      setPendingDeleteId(null);
    }
  }

  const isBusy = status === "streaming" || status === "submitted" || loadingConversation;
  const isGenerating = status === "streaming" || status === "submitted";

  const visibleMessages = useMemo(() => {
    if (!isGenerating) {
      return messages;
    }

    const last = messages[messages.length - 1];
    if (last?.role === "assistant") {
      return messages.slice(0, -1);
    }

    return messages;
  }, [messages, isGenerating]);

  if (!activeClass) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-8">
        <p className="text-sm text-muted-foreground">
          Select an active class from the header to use AI Hub.
        </p>
      </div>
    );
  }

  const classLabel = `${activeClass.name} · G${activeClass.grade_level} ${activeClass.subject}`;

  return (
    <>
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(14rem,17rem)_minmax(0,1fr)]">
        <ConversationSidebar
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          isLoading={conversationsLoading}
          deletingConversationId={deletingConversationId}
          onSelect={(conversationId) => {
            void handleSelectConversation(conversationId);
          }}
          onNewConversation={handleNewConversation}
          onDelete={setPendingDeleteId}
        />

        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
          <header className="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-primary/5 via-transparent to-transparent px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Class assistant</p>
                <p className="truncate text-xs text-muted-foreground">{classLabel}</p>
              </div>
            </div>
            <div className="hidden items-center gap-1 rounded-full border border-border/80 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground sm:flex">
              <Sparkles className="h-3 w-3 text-primary" />
              Scoped to active class
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col justify-center gap-4 py-6">
                  <div className="mx-auto max-w-md text-center">
                    <p className="text-base font-medium text-foreground">
                      How can I help with {activeClass.name}?
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      I already know your class is Grade {activeClass.grade_level}{" "}
                      {activeClass.subject}, Term {activeClass.term}. Ask about
                      planning, resources, or feedback.
                    </p>
                  </div>
                  <div className="mx-auto flex max-w-lg flex-wrap justify-center gap-2">
                    {SUGGESTED_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        disabled={isBusy}
                        onClick={() => void submitMessage(prompt)}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleMessages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      canEdit={!isBusy && message.role === "user"}
                      onEdit={handleEditMessage}
                    />
                  ))}
                  {isGenerating ? <ThinkingBubble /> : null}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="shrink-0 bg-background/60 p-4 backdrop-blur-sm">
              {error || actionError ? (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2">
                  <p className="text-sm text-destructive">
                    {actionError ??
                      "The assistant could not respond. Please try again."}
                  </p>
                  {error ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        clearError();
                        setActionError(null);
                        void regenerate();
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Retry
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSubmit(event);
                    }
                  }}
                  placeholder={
                    editingMessageId
                      ? "Edit your message and send to regenerate…"
                      : `Ask about ${activeClass.subject}…`
                  }
                  disabled={isBusy}
                  rows={1}
                  maxLength={4000}
                  className={cn(
                    "min-h-11 max-h-32 flex-1 resize-none rounded-full border border-input bg-background px-5 py-3 text-sm shadow-xs outline-none transition-colors",
                    "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                />
                {isGenerating ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleStop()}
                    className="h-11 shrink-0 rounded-full px-4 shadow-sm"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                    Stop
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={!draft.trim()}
                    className="h-11 w-11 shrink-0 rounded-full p-0 shadow-sm"
                  >
                    <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                    <span className="sr-only">Send message</span>
                  </Button>
                )}
              </form>
            </div>
          </div>
        </section>
      </div>

      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title="Delete conversation?"
        description="This removes the thread and all messages. This cannot be undone."
      >
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPendingDeleteId(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deletingConversationId !== null}
            onClick={() => {
              if (pendingDeleteId) {
                void handleDeleteConversation(pendingDeleteId);
              }
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </>
  );
}
