"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { FileText, MessageSquare } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useConversations } from "@/lib/hooks/use-conversations";
import { useResources } from "@/lib/hooks/use-resources";
import { cn } from "@/lib/utils";

const RECENT_LIMIT = 5;

function ListSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label={label}>
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function RecentActivityLists({
  classId,
}: {
  classId: string | undefined;
}) {
  const {
    data: conversations,
    isLoading: conversationsLoading,
  } = useConversations(classId);
  const { data: resources, isLoading: resourcesLoading } =
    useResources(classId);

  const recentConversations = (conversations ?? []).slice(0, RECENT_LIMIT);
  const recentResources = (resources ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, RECENT_LIMIT);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card className={cn("surface-float border-0")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-primary" />
            Recent conversations
          </CardTitle>
          <CardDescription>Jump back into AI Hub</CardDescription>
        </CardHeader>
        <CardContent>
          {!classId ? (
            <p className="text-sm text-muted-foreground">
              Select a class to see recent conversations.
            </p>
          ) : conversationsLoading ? (
            <ListSkeleton label="Loading conversations" />
          ) : recentConversations.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No conversations yet. Ask the co-pilot about your scheme or
                lesson plans.
              </p>
              <Link
                href="/ai-hub"
                className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Open AI Hub
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {recentConversations.map((conversation) => (
                <li key={conversation.id}>
                  <Link
                    href={`/ai-hub?conversation=${conversation.id}`}
                    className="block rounded-xl border border-border/60 px-3 py-2 transition-colors hover:bg-muted/60"
                  >
                    <p className="truncate text-sm font-medium">
                      {conversation.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conversation.updated_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className={cn("surface-float border-0")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Recent resources
          </CardTitle>
          <CardDescription>Materials for this class</CardDescription>
        </CardHeader>
        <CardContent>
          {!classId ? (
            <p className="text-sm text-muted-foreground">
              Select a class to see recent resources.
            </p>
          ) : resourcesLoading ? (
            <ListSkeleton label="Loading resources" />
          ) : recentResources.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No resources yet. Upload a scheme, notes, or assignment on the
                class page.
              </p>
              {classId ? (
                <Link
                  href={`/classes/${classId}`}
                  className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Open class
                </Link>
              ) : null}
            </div>
          ) : (
            <ul className="space-y-2">
              {recentResources.map((resource) => (
                <li key={resource.id}>
                  <Link
                    href={`/classes/${classId}?resource=${resource.id}`}
                    className="block rounded-xl border border-border/60 px-3 py-2 transition-colors hover:bg-muted/60"
                  >
                    <p className="truncate text-sm font-medium">
                      {resource.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(resource.updated_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
