"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import type { Resource } from "@/types/database";
import { useDeleteResource } from "@/lib/hooks/use-resources";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatResourceDate,
  formatResourceType,
} from "@/lib/resources/format";
import { ResourceDeleteDialog } from "@/components/classes/resource-delete-dialog";

type ResourceListTableProps = {
  classId: string;
  resources: Resource[];
  emptyMessage?: string;
};

export function ResourceListTable({
  classId,
  resources,
  emptyMessage = "No resources yet. Upload a scheme, notes, or assignment to get started.",
}: ResourceListTableProps) {
  const deleteResource = useDeleteResource(classId);
  const [deleteTarget, setDeleteTarget] = useState<Resource | null>(null);

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteResource.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }

  if (!resources.length) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="hidden md:block">
        <Table containerClassName="overflow-visible">
          <TableHeader>
            <TableRow>
              <TableHead sticky>Title</TableHead>
              <TableHead sticky>Type</TableHead>
              <TableHead sticky>Source</TableHead>
              <TableHead sticky>Added</TableHead>
              <TableHead sticky className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.map((resource) => (
              <TableRow key={resource.id} className="group">
                <TableCell>
                  <Link
                    href={`/classes/${classId}/resources/${resource.id}`}
                    className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {resource.title}
                  </Link>
                </TableCell>
                <TableCell>{formatResourceType(resource.resource_type)}</TableCell>
                <TableCell>
                  <Badge variant={resource.ai_generated ? "accent" : "secondary"}>
                    {resource.ai_generated ? "AI-generated" : "Uploaded"}
                  </Badge>
                </TableCell>
                <TableCell>{formatResourceDate(resource.created_at)}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                      disabled={deleteResource.isPending}
                      onClick={() => setDeleteTarget(resource)}
                      aria-label={`Delete ${resource.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2 md:hidden">
        {resources.map((resource) => (
          <Card key={resource.id}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <Link
                href={`/classes/${classId}/resources/${resource.id}`}
                className="min-w-0 flex-1 text-left"
              >
                <p className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline">
                  {resource.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatResourceType(resource.resource_type)} ·{" "}
                  {formatResourceDate(resource.created_at)}
                </p>
                <Badge
                  variant={resource.ai_generated ? "accent" : "secondary"}
                  className="mt-2"
                >
                  {resource.ai_generated ? "AI" : "Upload"}
                </Badge>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                disabled={deleteResource.isPending}
                onClick={() => setDeleteTarget(resource)}
                aria-label={`Delete ${resource.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <ResourceDeleteDialog
        resource={deleteTarget}
        open={Boolean(deleteTarget)}
        isDeleting={deleteResource.isPending}
        error={
          deleteResource.error instanceof Error
            ? deleteResource.error.message
            : null
        }
        onOpenChange={(open) => {
          if (!open && !deleteResource.isPending) setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
