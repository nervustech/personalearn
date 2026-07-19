"use client";

import { formatDistanceToNow } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  MessagesSquare,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ConversationRow } from "@/lib/ai-hub/conversations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "ai-hub-conversations-collapsed";

type ConversationSidebarProps = {
  conversations: ConversationRow[];
  selectedConversationId: string | null;
  isLoading: boolean;
  deletingConversationId: string | null;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onSelect: (conversationId: string) => void;
  onNewConversation: () => void;
  onDelete: (conversationId: string) => void;
};

export function ConversationSidebar({
  conversations,
  selectedConversationId,
  isLoading,
  deletingConversationId,
  collapsed,
  onCollapsedChange,
  onSelect,
  onNewConversation,
  onDelete,
}: ConversationSidebarProps) {
  const [search, setSearch] = useState("");

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(query)
    );
  }, [conversations, search]);

  useEffect(() => {
    if (collapsed) {
      setSearch("");
    }
  }, [collapsed]);

  if (collapsed) {
    return (
      <aside
        className="flex w-12 shrink-0 flex-col items-center gap-2 overflow-hidden rounded-2xl border border-border/80 bg-card/50 py-3 shadow-xs backdrop-blur-sm"
        aria-label="Conversations collapsed"
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => onCollapsedChange(false)}
          title="Expand conversations"
          aria-label="Expand conversations"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={onNewConversation}
          title="New conversation"
          aria-label="New conversation"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <div className="mt-1 flex flex-1 items-start pt-1">
          <MessagesSquare className="h-4 w-4 text-muted-foreground" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/50 shadow-xs backdrop-blur-sm lg:w-[17rem]">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <MessagesSquare className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="truncate text-sm font-semibold">Conversations</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={onNewConversation}
            title="New conversation"
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">New conversation</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => onCollapsedChange(true)}
            title="Collapse conversations"
            aria-label="Collapse conversations"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="shrink-0 px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conversations…"
            className="h-9 rounded-xl pl-8 text-sm"
            aria-label="Search conversations"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2 px-1 py-1" aria-busy="true" aria-label="Loading conversations">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="space-y-1.5 rounded-xl px-2.5 py-2.5">
                <Skeleton className="h-4 w-[75%]" />
                <Skeleton className="h-3 w-[50%]" />
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-4 text-sm leading-relaxed text-muted-foreground">
            No conversations yet. Start a new chat to begin.
          </p>
        ) : filteredConversations.length === 0 ? (
          <p className="px-3 py-4 text-sm leading-relaxed text-muted-foreground">
            No conversations match “{search.trim()}”.
          </p>
        ) : (
          <ul className="space-y-1">
            {filteredConversations.map((conversation) => {
              const isSelected = conversation.id === selectedConversationId;
              const isDeleting = deletingConversationId === conversation.id;

              return (
                <li key={conversation.id}>
                  <div
                    className={cn(
                      "group relative rounded-xl transition-colors",
                      isSelected ? "bg-primary/10" : "hover:bg-muted/80"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(conversation.id)}
                      disabled={isDeleting}
                      className="w-full px-2.5 py-2.5 text-left"
                    >
                      <p
                        className={cn(
                          "truncate text-sm font-medium",
                          isSelected ? "text-primary" : "text-foreground"
                        )}
                      >
                        {conversation.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(conversation.updated_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${conversation.title}`}
                      disabled={isDeleting}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(conversation.id);
                      }}
                      className="absolute right-0.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-card/90 text-muted-foreground opacity-0 shadow-xs backdrop-blur-sm transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

export function readSidebarCollapsedPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeSidebarCollapsedPreference(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "true" : "false");
  } catch {
    // Ignore quota / private mode failures.
  }
}
