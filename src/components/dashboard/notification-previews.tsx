"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useNotificationsStore } from "@/lib/store/notifications";

/**
 * Pending async-eval (and similar) alerts on Home.
 * Persist until the teacher opens the deep link or dismisses with close.
 */
export function NotificationPreviews() {
  const items = useNotificationsStore((s) => s.items);
  const dismiss = useNotificationsStore((s) => s.dismiss);

  if (items.length === 0) return null;

  return (
    <ul className="space-y-2" aria-label="Pending notifications">
      {items.map((n) => (
        <li
          key={n.id}
          className="flex items-start gap-2 rounded-2xl bg-primary/5 px-3 py-2.5 shadow-sm"
        >
          <Link
            href={n.href}
            onClick={() => dismiss(n.id)}
            className="min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="text-sm font-medium text-foreground">{n.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
          </Link>
          <button
            type="button"
            aria-label={`Dismiss ${n.title}`}
            onClick={() => dismiss(n.id)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
