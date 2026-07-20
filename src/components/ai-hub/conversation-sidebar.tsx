"use client";

import { formatDistanceToNow } from "date-fns";
import { MessagesSquare, Plus, Trash2 } from "lucide-react";
import type { ConversationRow } from "@/lib/ai-hub/conversations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConversationSidebarProps = {
  conversations: ConversationRow[];
  selectedConversationId: string | null;
  isLoading: boolean;
  deletingConversationId: string | null;
  onSelect: (conversationId: string) => void;
  onNewConversation: () => void;
  onDelete: (conversationId: string) => void;
};

export function ConversationSidebar({
  conversations,
  selectedConversationId,
  isLoading,
  deletingConversationId,
  onSelect,
  onNewConversation,
  onDelete,
}: ConversationSidebarProps) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-card/50 shadow-xs backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <MessagesSquare className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Conversations</h2>
        </div>
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Loading…</p>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-4 text-sm leading-relaxed text-muted-foreground">
            No conversations yet. Start a new chat to begin.
          </p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((conversation) => {
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
