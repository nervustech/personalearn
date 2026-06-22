"use client";

import { Trash2 } from "lucide-react";
import type { Student } from "@/types/database";
import { useDeleteStudent } from "@/lib/hooks/use-classes";
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

type StudentRosterTableProps = {
  classId: string;
  students: Student[];
};

export function StudentRosterTable({ classId, students }: StudentRosterTableProps) {
  const deleteStudent = useDeleteStudent(classId);

  if (!students.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No students yet. Add one below or import a CSV.
      </p>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Admission</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student.id}>
                <TableCell className="font-medium">{student.full_name}</TableCell>
                <TableCell>{student.admission_number ?? "—"}</TableCell>
                <TableCell>{student.gender ?? "—"}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={deleteStudent.isPending}
                    onClick={() => deleteStudent.mutate(student.id)}
                    aria-label={`Remove ${student.full_name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2 md:hidden">
        {students.map((student) => (
          <Card key={student.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{student.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {student.admission_number ?? "No admission no."}
                  {student.gender ? ` · ${student.gender}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={deleteStudent.isPending}
                onClick={() => deleteStudent.mutate(student.id)}
                aria-label={`Remove ${student.full_name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
