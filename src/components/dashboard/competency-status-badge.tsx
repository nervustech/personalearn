import { Badge } from "@/components/ui/badge";
import type { SnapshotDisplayStatus } from "@/lib/evaluation/competency-snapshot";
import { cn } from "@/lib/utils";

const LABEL: Record<SnapshotDisplayStatus, string> = {
  mastered: "Mastered",
  developing: "Developing",
  not_yet: "Not yet",
  no_evidence: "No evidence",
};

const VARIANT: Record<
  SnapshotDisplayStatus,
  "success" | "warning" | "outline" | "secondary"
> = {
  mastered: "success",
  developing: "warning",
  not_yet: "outline",
  no_evidence: "secondary",
};

export function competencyStatusLabel(status: SnapshotDisplayStatus) {
  return LABEL[status];
}

export function CompetencyStatusBadge({
  status,
  className,
}: {
  status: SnapshotDisplayStatus;
  className?: string;
}) {
  return (
    <Badge variant={VARIANT[status]} className={cn("capitalize", className)}>
      {LABEL[status]}
    </Badge>
  );
}
