"use client";

import { useState } from "react";
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
import { StudentEvalProfileDialog } from "@/components/classes/student-eval-profile-dialog";
import { StartEvaluationDialog } from "@/components/classes/start-evaluation-dialog";

type StudentRosterTableProps = {
  classId: string;
  students: Student[];
  emptyMessage?: string;
};

type N1EvalTarget = {
  student: Student;
  assessmentId: string;
};

export function StudentRosterTable({
  classId,
  students,
  emptyMessage = "No students yet. Use the buttons above to add one or import a CSV.",
}: StudentRosterTableProps) {
  const deleteStudent = useDeleteStudent(classId);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [n1Eval, setN1Eval] = useState<N1EvalTarget | null>(null);

  if (!students.length) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="hidden md:block">
        <Table containerClassName="overflow-visible">
          <TableHeader>
            <TableRow>
              <TableHead sticky>Name</TableHead>
              <TableHead sticky>Admission</TableHead>
              <TableHead sticky>Gender</TableHead>
              <TableHead sticky className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow
                key={student.id}
                className="group cursor-pointer"
                onClick={() => setSelectedStudent(student)}
              >
                <TableCell className="font-medium">
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedStudent(student);
                    }}
                  >
                    {student.full_name}
                  </button>
                </TableCell>
                <TableCell>{student.admission_number ?? "—"}</TableCell>
                <TableCell>{student.gender ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                      disabled={deleteStudent.isPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteStudent.mutate(student.id);
                      }}
                      aria-label={`Remove ${student.full_name}`}
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
        {students.map((student) => (
          <Card key={student.id}>
            <CardContent className="flex items-center justify-between p-4">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setSelectedStudent(student)}
              >
                <p className="font-medium">{student.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {student.admission_number ?? "No admission no."}
                  {student.gender ? ` · ${student.gender}` : ""}
                </p>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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

      <StudentEvalProfileDialog
        classId={classId}
        student={selectedStudent}
        open={Boolean(selectedStudent) && !n1Eval}
        onOpenChange={(next) => {
          if (!next) setSelectedStudent(null);
        }}
        onEvaluateAssessment={(assessmentId) => {
          if (!selectedStudent) return;
          setN1Eval({ student: selectedStudent, assessmentId });
          setSelectedStudent(null);
        }}
      />

      {n1Eval ? (
        <StartEvaluationDialog
          classId={classId}
          studentId={n1Eval.student.id}
          studentName={n1Eval.student.full_name}
          preselectedAssessmentId={n1Eval.assessmentId}
          hideTrigger
          open
          onOpenChange={(next) => {
            if (!next) setN1Eval(null);
          }}
        />
      ) : null}
    </>
  );
}
