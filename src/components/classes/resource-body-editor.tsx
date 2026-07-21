"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  Bold,
  Heading2,
  Italic,
  List,
  ListOrdered,
} from "lucide-react";
import { MarkdownContent } from "@/components/markdown/markdown-content";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type EditorTab = "write" | "preview";

type ResourceBodyEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string
) {
  const selected = value.slice(start, end);
  const inner = selected || placeholder;
  const next = `${value.slice(0, start)}${before}${inner}${after}${value.slice(end)}`;
  const cursorStart = start + before.length;
  const cursorEnd = cursorStart + inner.length;
  return { next, cursorStart, cursorEnd };
}

function prefixLines(
  value: string,
  start: number,
  end: number,
  prefix: string
) {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEndIdx = value.indexOf("\n", end);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const block = value.slice(lineStart, lineEnd);
  const prefixed = block
    .split("\n")
    .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line || ""}`))
    .join("\n");
  const next = `${value.slice(0, lineStart)}${prefixed}${value.slice(lineEnd)}`;
  return {
    next,
    cursorStart: lineStart,
    cursorEnd: lineStart + prefixed.length,
  };
}

/**
 * Teacher-friendly body editor: Write + live Preview, with a small toolbar
 * that inserts formatting without requiring markdown literacy.
 * Storage remains markdown for RAG / AI Hub compatibility.
 */
export function ResourceBodyEditor({
  value,
  onChange,
  disabled = false,
}: ResourceBodyEditorProps) {
  const [tab, setTab] = useState<EditorTab>("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function applyEdit(
    mutate: (
      value: string,
      start: number,
      end: number
    ) => { next: string; cursorStart: number; cursorEnd: number }
  ) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const { next, cursorStart, cursorEnd } = mutate(value, start, end);
    onChange(next);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="resource-body">Content</Label>
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
              tab === "write"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab("write")}
            disabled={disabled}
          >
            Write
          </button>
          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
              tab === "preview"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab("preview")}
            disabled={disabled}
          >
            Preview
          </button>
        </div>
      </div>

      {tab === "write" ? (
        <div className="overflow-hidden rounded-xl border border-input bg-card shadow-xs">
          <div className="flex flex-wrap items-center gap-1 border-b border-border/70 bg-muted/30 px-2 py-1.5">
            <ToolbarButton
              label="Heading"
              disabled={disabled}
              onClick={() =>
                applyEdit((v, s, e) => prefixLines(v, s, e, "## "))
              }
            >
              <Heading2 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              label="Bold"
              disabled={disabled}
              onClick={() =>
                applyEdit((v, s, e) =>
                  wrapSelection(v, s, e, "**", "**", "bold text")
                )
              }
            >
              <Bold className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              label="Italic"
              disabled={disabled}
              onClick={() =>
                applyEdit((v, s, e) =>
                  wrapSelection(v, s, e, "*", "*", "italic text")
                )
              }
            >
              <Italic className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              label="Bullet list"
              disabled={disabled}
              onClick={() =>
                applyEdit((v, s, e) => prefixLines(v, s, e, "- "))
              }
            >
              <List className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              label="Numbered list"
              disabled={disabled}
              onClick={() =>
                applyEdit((v, s, e) => prefixLines(v, s, e, "1. "))
              }
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </ToolbarButton>
            <p className="ml-auto hidden text-[11px] text-muted-foreground sm:block">
              Use Preview to check tables and formatting
            </p>
          </div>
          <textarea
            ref={textareaRef}
            id="resource-body"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            rows={18}
            spellCheck
            className="flex w-full resize-y border-0 bg-transparent px-3 py-3 font-sans text-[0.9375rem] leading-relaxed text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Write or paste the resource content…"
          />
        </div>
      ) : (
        <div className="min-h-[24rem] rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
          {value.trim() ? (
            <MarkdownContent
              content={value}
              className="text-[0.9375rem] text-foreground"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
    >
      {children}
    </button>
  );
}
