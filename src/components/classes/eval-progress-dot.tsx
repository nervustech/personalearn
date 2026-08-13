import type { EvaluatedScriptStatus } from "@/types/database";
import { cn } from "@/lib/utils";

export type EvalDotState =
  | "none"
  | "processing"
  | "amber"
  | "ready"
  | "done";

export function evalDotStateFromScriptStatus(
  status: EvaluatedScriptStatus | null | undefined
): EvalDotState {
  switch (status) {
    case "uploaded":
    case "indexing":
    case "evaluating":
    case "parsing":
    case "queued_draft":
    case "drafting":
    case "pending":
    case "identity_cleared":
      return "processing";
    case "identity_amber":
    case "unmatched":
      return "amber";
    case "ready":
    case "drafted":
      return "ready";
    case "signed_off":
      return "done";
    case "failed":
      return "amber";
    default:
      return "none";
  }
}

type EvalProgressDotProps = {
  state: EvalDotState;
  className?: string;
  title?: string;
};

export function EvalProgressDot({
  state,
  className,
  title,
}: EvalProgressDotProps) {
  return (
    <span
      title={title}
      aria-hidden={state === "none" ? true : undefined}
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full",
        state === "none" && "bg-muted-foreground/30",
        state === "processing" && "animate-pulse bg-muted-foreground/70",
        state === "amber" && "bg-amber-500",
        state === "ready" && "bg-indigo-500",
        state === "done" && "bg-emerald-500",
        className
      )}
    />
  );
}
