"use client";

import { useMemo } from "react";
import { useResources } from "@/lib/hooks/use-resources";
import { filterResourcesByQuery } from "@/lib/classes/filter-class-lists";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResourceListTable } from "@/components/classes/resource-list-table";
import { ResourceUploadDialog } from "@/components/classes/resource-upload-dialog";
import { cn } from "@/lib/utils";

type ClassResourcesSectionProps = {
  classId: string;
  /** Constrain height and scroll the list (side-by-side class page layout). */
  scrollable?: boolean;
  searchQuery?: string;
};

export function ClassResourcesSection({
  classId,
  scrollable = false,
  searchQuery = "",
}: ClassResourcesSectionProps) {
  const { data: resources, isLoading, error } = useResources(classId);
  const filteredResources = useMemo(
    () => filterResourcesByQuery(resources ?? [], searchQuery),
    [resources, searchQuery]
  );
  const hasQuery = searchQuery.trim().length > 0;

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
            <div className="space-y-2" aria-busy="true" aria-label="Loading resources">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "Failed to load resources"}
            </p>
          ) : (
            <ResourceListTable
              classId={classId}
              resources={filteredResources}
              emptyMessage={
                hasQuery
                  ? "No matching resources."
                  : "No resources yet. Upload a scheme, notes, or assignment to get started."
              }
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
