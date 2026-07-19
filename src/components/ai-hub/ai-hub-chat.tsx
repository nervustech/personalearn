"use client";

import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  ArrowUp,
  Paperclip,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChatMessage } from "@/components/ai-hub/chat-message";
import {
  ConversationSidebar,
  readSidebarCollapsedPreference,
  writeSidebarCollapsedPreference,
} from "@/components/ai-hub/conversation-sidebar";
import { ThinkingBubble } from "@/components/ai-hub/thinking-bubble";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { ConversationRow } from "@/lib/ai-hub/conversations";
import { generateConversationTitle } from "@/lib/ai-hub/conversation-title";
import {
  chatAttachmentAccept,
  validateChatAttachments,
  type PendingAttachment,
} from "@/lib/ai-hub/chat-attachments";
import {
  CONVERSATION_MESSAGES_STALE_TIME,
  conversationMessagesQueryKey,
  fetchConversationMessages,
} from "@/lib/hooks/use-conversation-messages";
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

function isMessagesQueryFresh(
  dataUpdatedAt: number | undefined,
  isInvalidated: boolean | undefined
): boolean {
  if (!dataUpdatedAt || isInvalidated) return false;
  return Date.now() - dataUpdatedAt < CONVERSATION_MESSAGES_STALE_TIME;
}

export function AiHubChat() {
  const activeClass = useActiveClassStore((state) => state.activeClass);
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [pendingConversationId] = useState<string | null>(() =>
    searchParams.get("conversation")
  );
  const deepLinkHandledRef = useRef(false);
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
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const setSelectedConversationIdRef = useRef(setSelectedConversationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  const prevStatusRef = useRef<string>("ready");

  setSelectedConversationIdRef.current = setSelectedConversationId;
  draftRef.current = draft;

  useEffect(() => {
    setSidebarCollapsed(readSidebarCollapsedPreference());
  }, []);

  function handleSidebarCollapsedChange(collapsed: boolean) {
    setSidebarCollapsed(collapsed);
    writeSidebarCollapsedPreference(collapsed);
  }

  const {
    data: conversations = [],
    isLoading: conversationsLoading,
  } = useConversations(activeClass?.id);

  const chatInstanceId = activeClass?.id ?? "none";

  const activeClassIdRef = useRef(activeClass?.id);
  activeClassIdRef.current = activeClass?.id;

  function patchConversationList(
    conversationId: string,
    options?: { title?: string; createIfMissing?: boolean }
  ) {
    const classId = activeClassIdRef.current;
    if (!classId) return;

    const now = new Date().toISOString();
    queryClient.setQueryData<ConversationRow[]>(
      conversationsQueryKey(classId),
      (previous) => {
        const list = previous ?? [];
        const existing = list.find((row) => row.id === conversationId);

        if (existing) {
          const updated: ConversationRow = {
            ...existing,
            updated_at: now,
            ...(options?.title ? { title: options.title } : {}),
          };
          return [
            updated,
            ...list.filter((row) => row.id !== conversationId),
          ];
        }

        if (!options?.createIfMissing) {
          return list;
        }

        const created: ConversationRow = {
          id: conversationId,
          class_id: classId,
          teacher_id: "",
          title: options.title ?? "New conversation",
          created_at: now,
          updated_at: now,
        };
        return [created, ...list];
      }
    );
  }

  const patchConversationListRef = useRef(patchConversationList);
  patchConversationListRef.current = patchConversationList;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai-hub/chat",
        body: () => ({
          classId: activeClassIdRef.current,
          conversationId: conversationIdRef.current,
        }),
        fetch: async (input, init) => {
          const response = await globalThis.fetch(input, init);
          const conversationId = response.headers.get("X-Conversation-Id");

          if (
            conversationId &&
            conversationId !== conversationIdRef.current &&
            activeClassIdRef.current
          ) {
            conversationIdRef.current = conversationId;
            setSelectedConversationIdRef.current(conversationId);
            patchConversationListRef.current(conversationId, {
              createIfMissing: true,
              title: generateConversationTitle(
                draftRef.current || "New conversation"
              ),
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
        patchConversationList(conversationIdRef.current);
      }

      if (activeClass?.id) {
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
    setPendingAttachments([]);
    clearError();
    setActionError(null);
    setEditingMessageId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when active class changes
  }, [activeClass?.id]);

  // Home deep-link: /ai-hub?conversation=… (PSL-67). Runs after class reset above.
  useEffect(() => {
    if (!pendingConversationId || !activeClass?.id) return;
    if (deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;

    void (async () => {
      await handleSelectConversation(pendingConversationId);
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      if (!url.searchParams.has("conversation")) return;
      url.searchParams.delete("conversation");
      const next = url.pathname + (url.search ? url.search : "");
      window.history.replaceState(window.history.state, "", next);
    })();
    // handleSelectConversation closes over latest activeClass/setters; intentional once-per-mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingConversationId, activeClass?.id]);

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

    clearError();
    setActionError(null);
    setEditingMessageId(null);
    setPendingAttachments([]);

    const queryKey = conversationMessagesQueryKey(conversationId);
    const cached = queryClient.getQueryData<UIMessage[]>(queryKey);
    const queryState = queryClient.getQueryState(queryKey);
    const fresh = isMessagesQueryFresh(
      queryState?.dataUpdatedAt,
      queryState?.isInvalidated
    );

    setSelectedConversationId(conversationId);
    conversationIdRef.current = conversationId;

    if (cached) {
      setMessages(cached);
    }

    if (cached && fresh) {
      return;
    }

    if (!cached) {
      setLoadingConversation(true);
      setMessages([]);
    }

    try {
      const loaded = await queryClient.fetchQuery({
        queryKey,
        queryFn: () => fetchConversationMessages(conversationId),
        staleTime: CONVERSATION_MESSAGES_STALE_TIME,
      });

      if (conversationIdRef.current === conversationId) {
        setMessages(loaded);
      }
    } catch (loadError) {
      if (conversationIdRef.current === conversationId) {
        setActionError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load conversation"
        );
        if (!cached) {
          setMessages([]);
        }
      }
    } finally {
      setLoadingConversation(false);
    }
  }

  function handleNewConversation() {
    setSelectedConversationId(null);
    conversationIdRef.current = null;
    setMessages([]);
    setDraft("");
    setPendingAttachments([]);
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
    setPendingAttachments([]);
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

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const { accepted, error: validationError } = validateChatAttachments(
      Array.from(fileList),
      pendingAttachments.length
    );

    if (validationError) {
      setActionError(validationError);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setActionError(null);
    setPendingAttachments((current) => [
      ...current,
      ...accepted.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
      })),
    ]);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((current) =>
      current.filter((attachment) => attachment.id !== id)
    );
  }

  async function submitMessage(text: string) {
    const trimmed = text.trim();
    const files = pendingAttachments.map((attachment) => attachment.file);
    const hasFiles = files.length > 0;

    if (
      (!trimmed && !hasFiles) ||
      !activeClass ||
      status === "streaming" ||
      status === "submitted"
    ) {
      return;
    }

    clearError();
    setActionError(null);

    const editingId = editingMessageId;

    try {
      if (editingId) {
        const fromIndex = messages.findIndex((message) => message.id === editingId);

        setEditingMessageId(null);
        setDraft("");
        setPendingAttachments([]);

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
      setPendingAttachments([]);

      const dataTransfer = new DataTransfer();
      for (const file of files) {
        dataTransfer.items.add(file);
      }

      await sendMessage(
        {
          text: trimmed || "Please review the attached file(s).",
          ...(hasFiles ? { files: dataTransfer.files } : {}),
        },
        {
          body: {
            classId: activeClass.id,
            conversationId: conversationIdRef.current,
          },
        }
      );

      if (conversationIdRef.current) {
        patchConversationList(conversationIdRef.current);
      }
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
        queryClient.setQueryData<ConversationRow[]>(
          conversationsQueryKey(activeClass.id),
          (previous) =>
            (previous ?? []).filter((row) => row.id !== conversationId)
        );
        queryClient.removeQueries({
          queryKey: conversationMessagesQueryKey(conversationId),
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
  const canSend =
    (Boolean(draft.trim()) || pendingAttachments.length > 0) && !isBusy;

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
      <div
        className={cn(
          "grid h-full min-h-0 gap-3 sm:gap-4",
          sidebarCollapsed
            ? "grid-cols-[auto_minmax(0,1fr)]"
            : "grid-cols-[minmax(11rem,17rem)_minmax(0,1fr)]"
        )}
      >
        <ConversationSidebar
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          isLoading={conversationsLoading}
          deletingConversationId={deletingConversationId}
          collapsed={sidebarCollapsed}
          onCollapsedChange={handleSidebarCollapsedChange}
          onSelect={(conversationId) => {
            void handleSelectConversation(conversationId);
          }}
          onNewConversation={handleNewConversation}
          onDelete={setPendingDeleteId}
        />

        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-card/95 shadow-sm backdrop-blur-sm">
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
              {loadingConversation && messages.length === 0 ? (
                <div
                  className="space-y-4 py-2"
                  aria-busy="true"
                  aria-label="Loading conversation"
                >
                  <div className="flex gap-3">
                    <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                    <Skeleton className="h-20 w-[min(85%,24rem)] rounded-2xl" />
                  </div>
                  <div className="flex flex-row-reverse gap-3">
                    <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                    <Skeleton className="h-16 w-[min(70%,20rem)] rounded-2xl" />
                  </div>
                  <div className="flex gap-3">
                    <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                    <Skeleton className="h-28 w-[min(85%,28rem)] rounded-2xl" />
                  </div>
                </div>
              ) : messages.length === 0 ? (
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

              {pendingAttachments.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {pendingAttachments.map((attachment) => (
                    <span
                      key={attachment.id}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/60 py-1 pl-2.5 pr-1 text-xs text-foreground"
                    >
                      <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{attachment.file.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${attachment.file.name}`}
                        disabled={isBusy}
                        onClick={() => removePendingAttachment(attachment.id)}
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={chatAttachmentAccept()}
                  multiple
                  className="hidden"
                  onChange={(event) => handleFilesSelected(event.target.files)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isBusy || editingMessageId !== null}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-11 w-11 shrink-0 rounded-full p-0 shadow-xs"
                  title="Attach file"
                  aria-label="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
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
                    disabled={!canSend}
                    className="h-11 w-11 shrink-0 rounded-full p-0 shadow-sm"
                  >
                    <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                    <span className="sr-only">Send message</span>
                  </Button>
                )}
              </form>
              <p className="mt-2 px-1 text-[11px] text-muted-foreground">
                Attachments (.txt 2 MB · .pdf/.jpg/.png 5 MB) stay in this chat
                only — they are not saved to the class library.
              </p>
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
