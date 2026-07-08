"use client";

import { useState } from "react";
import { Eye, Trash2 } from "lucide-react";
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
import { ResourceViewDialog } from "@/components/classes/resource-view-dialog";
import { ResourceDeleteDialog } from "@/components/classes/resource-delete-dialog";

type ResourceListTableProps = {
  classId: string;
  resources: Resource[];
};

export function ResourceListTable({
  classId,
  resources,
}: ResourceListTableProps) {
  const deleteResource = useDeleteResource(classId);
  const [viewResource, setViewResource] = useState<Resource | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Resource | null>(null);

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteResource.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }

  if (!resources.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No resources yet. Upload a scheme, notes, or assignment to get started.
      </p>
    );
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
              <TableHead sticky className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.map((resource) => (
              <TableRow key={resource.id}>
                <TableCell className="font-medium">{resource.title}</TableCell>
                <TableCell>{formatResourceType(resource.resource_type)}</TableCell>
                <TableCell>
                  <Badge variant={resource.ai_generated ? "accent" : "secondary"}>
                    {resource.ai_generated ? "AI-generated" : "Uploaded"}
                  </Badge>
                </TableCell>
                <TableCell>{formatResourceDate(resource.created_at)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setViewResource(resource)}
                      aria-label={`Open ${resource.title}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 w-8 p-0"
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
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{resource.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatResourceType(resource.resource_type)} ·{" "}
                    {formatResourceDate(resource.created_at)}
                  </p>
                </div>
                <Badge variant={resource.ai_generated ? "accent" : "secondary"}>
                  {resource.ai_generated ? "AI" : "Upload"}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setViewResource(resource)}
                  aria-label={`Open ${resource.title}`}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={deleteResource.isPending}
                  onClick={() => setDeleteTarget(resource)}
                  aria-label={`Delete ${resource.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ResourceViewDialog
        resource={viewResource}
        open={Boolean(viewResource)}
        onOpenChange={(open) => {
          if (!open) setViewResource(null);
        }}
      />

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
