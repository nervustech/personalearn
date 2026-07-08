"use client";

import { useResources } from "@/lib/hooks/use-resources";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResourceListTable } from "@/components/classes/resource-list-table";
import { ResourceUploadDialog } from "@/components/classes/resource-upload-dialog";
import { cn } from "@/lib/utils";

type ClassResourcesSectionProps = {
  classId: string;
  /** Constrain height and scroll the list (side-by-side class page layout). */
  scrollable?: boolean;
};

export function ClassResourcesSection({
  classId,
  scrollable = false,
}: ClassResourcesSectionProps) {
  const { data: resources, isLoading, error } = useResources(classId);

  return (
    <Card
      className={cn(
        "flex min-h-0 flex-col",
        scrollable && "lg:max-h-[min(70vh,40rem)]"
      )}
    >
      <CardHeader className="flex shrink-0 flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-lg">Class resources</CardTitle>
        <ResourceUploadDialog classId={classId} />
      </CardHeader>
      <CardContent
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          scrollable && "overflow-hidden"
        )}
      >
        <div
          className={cn(
            "min-h-0 flex-1",
            scrollable && "overflow-y-auto pr-1"
          )}
        >
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading resources…</p>
          ) : error ? (
            <p className="text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "Failed to load resources"}
            </p>
          ) : (
            <ResourceListTable classId={classId} resources={resources ?? []} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
