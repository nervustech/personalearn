"use client";

import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  ArrowUp,
  ChevronDown,
  MessagesSquare,
  Paperclip,
  Plus,
  RotateCcw,
  Square,
  SquarePen,
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
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { resourcesQueryKey } from "@/lib/hooks/use-resources";
import { assessmentsQueryKey } from "@/lib/hooks/use-evaluation";
import { useActiveClassStore } from "@/lib/store/active-class";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  "Summarise Week 3 from my scheme of work",
  "Draft a short fractions quiz for this class",
  "Suggest a practical CBC activity",
];

/** Distance from bottom (px) under which the scroll-to-bottom control stays hidden. */
const SCROLL_NEAR_BOTTOM_PX = 100;

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const isMobile = useIsMobile();
  const conversationIdRef = useRef<string | null>(null);
  const setSelectedConversationIdRef = useRef(setSelectedConversationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  const prevStatusRef = useRef<string>("ready");

  setSelectedConversationIdRef.current = setSelectedConversationId;
  draftRef.current = draft;

  useEffect(() => {
    const stored = readSidebarCollapsedPreference();
    if (stored === null) {
      // No preference yet: collapsed on mobile, expanded on desktop.
      setSidebarCollapsed(window.matchMedia("(max-width: 767px)").matches);
      return;
    }
    setSidebarCollapsed(stored);
  }, []);

  function handleSidebarCollapsedChange(collapsed: boolean) {
    setSidebarCollapsed(collapsed);
    writeSidebarCollapsedPreference(collapsed);
  }

  function collapseSidebarOnMobile() {
    if (!isMobile || sidebarCollapsed) return;
    handleSidebarCollapsedChange(true);
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

  function updateScrollToBottomVisibility() {
    const el = messagesContainerRef.current;
    if (!el) {
      setShowScrollToBottom(false);
      return;
    }

    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    const hasOverflow = el.scrollHeight > el.clientHeight + 1;
    setShowScrollToBottom(
      hasOverflow && distanceFromBottom > SCROLL_NEAR_BOTTOM_PX
    );
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      updateScrollToBottomVisibility();
    });
    return () => cancelAnimationFrame(frame);
  }, [messages.length, loadingConversation, isMobile]);

  function scrollMessagesToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

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
    collapseSidebarOnMobile();
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

  return (
    <>
      <div
        className={cn(
          "relative h-full min-h-0",
          isMobile
            ? "flex flex-col"
            : cn(
                "grid gap-3 sm:gap-4",
                sidebarCollapsed
                  ? "grid-cols-[auto_minmax(0,1fr)]"
                  : "grid-cols-[minmax(11rem,17rem)_minmax(0,1fr)]"
              )
        )}
      >
        {!isMobile ? (
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
        ) : null}

        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          {isMobile ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute left-1 top-2 z-10 h-9 w-9 rounded-full bg-background/80 backdrop-blur-sm"
                onClick={() => handleSidebarCollapsedChange(false)}
                title="Conversations"
                aria-label="Open conversations"
              >
                <MessagesSquare className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-2 z-10 h-9 w-9 rounded-full bg-background/80 backdrop-blur-sm"
                onClick={handleNewConversation}
                title="New conversation"
                aria-label="New conversation"
              >
                <SquarePen className="h-5 w-5" />
              </Button>
            </>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1">
              <div
                ref={messagesContainerRef}
                onScroll={updateScrollToBottomVisibility}
                className={cn(
                  "h-full overflow-y-auto px-1 py-4 sm:px-0",
                  isMobile && "pt-12"
                )}
              >
                {loadingConversation && messages.length === 0 ? (
                  <div
                    className="space-y-5 py-2"
                    aria-busy="true"
                    aria-label="Loading conversation"
                  >
                    <div className="flex gap-3">
                      <div className="flex-1 space-y-2 pt-1">
                        <Skeleton className="h-3 w-[88%]" />
                        <Skeleton className="h-3 w-[72%]" />
                        <Skeleton className="h-3 w-[40%]" />
                      </div>
                    </div>
                    <div className="flex flex-row-reverse gap-3">
                      <Skeleton className="h-10 w-[min(70%,20rem)] rounded-2xl" />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 space-y-2 pt-1">
                        <Skeleton className="h-3 w-[80%]" />
                        <Skeleton className="h-3 w-[65%]" />
                      </div>
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

              {showScrollToBottom ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={scrollMessagesToBottom}
                    className="pointer-events-auto h-9 w-9 rounded-full border border-border/80 bg-background/90 shadow-md backdrop-blur-sm hover:bg-background"
                    title="Scroll to bottom"
                    aria-label="Scroll to bottom"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="shrink-0 bg-background px-1 pb-1 pt-2 sm:px-0 sm:pb-2">
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

              <form onSubmit={handleSubmit} className="flex items-end">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={chatAttachmentAccept()}
                  multiple
                  className="hidden"
                  onChange={(event) => handleFilesSelected(event.target.files)}
                />
                <div
                  className={cn(
                    "flex min-h-11 w-full items-end gap-1 rounded-full border border-input bg-background p-1 shadow-xs transition-colors",
                    "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30"
                  )}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isBusy || editingMessageId !== null}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-9 w-9 shrink-0 rounded-full p-0 text-muted-foreground hover:text-foreground"
                    title="Attach file"
                    aria-label="Attach file"
                  >
                    <Plus className="h-5 w-5" strokeWidth={2} />
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
                      "min-h-9 max-h-32 flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none",
                      "disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                  />
                  {isGenerating ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleStop()}
                      className="h-9 shrink-0 rounded-full px-3 shadow-none"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                      Stop
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={!canSend}
                      className="h-9 w-9 shrink-0 rounded-full p-0 shadow-sm"
                    >
                      <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                      <span className="sr-only">Send message</span>
                    </Button>
                  )}
                </div>
              </form>
              <p className="mt-2 px-1 text-center text-[11px] text-muted-foreground">
                Attachments (.txt 2 MB · .pdf/.jpg/.png 5 MB) stay in this chat
                only — they are not saved to the class library.
              </p>
            </div>
          </div>
        </section>

        {isMobile && !sidebarCollapsed ? (
          <div
            className="absolute inset-0 z-30 flex flex-col bg-background"
            role="dialog"
            aria-modal="true"
            aria-label="Conversations"
          >
            <ConversationSidebar
              conversations={conversations}
              selectedConversationId={selectedConversationId}
              isLoading={conversationsLoading}
              deletingConversationId={deletingConversationId}
              collapsed={false}
              onCollapsedChange={handleSidebarCollapsedChange}
              onSelect={(conversationId) => {
                void handleSelectConversation(conversationId);
                collapseSidebarOnMobile();
              }}
              onNewConversation={handleNewConversation}
              onDelete={setPendingDeleteId}
              className="h-full w-full rounded-none border-0 bg-background shadow-none backdrop-blur-none"
              sheetMode
            />
          </div>
        ) : null}
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
