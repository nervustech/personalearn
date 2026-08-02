"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { scriptReviewPath } from "@/lib/evaluation/review-routes";
import { Trash2 } from "lucide-react";
import type { EvaluatedScriptStatus, Student } from "@/types/database";
import { useDeleteStudent } from "@/lib/hooks/use-classes";
import {
  useEvaluationBatches,
  useEvaluationScripts,
} from "@/lib/hooks/use-evaluation";
import { useEvalScriptRealtime } from "@/lib/hooks/use-eval-script-realtime";
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
  EvalProgressDot,
  evalDotStateFromScriptStatus,
} from "@/components/classes/eval-progress-dot";
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

const STATUS_PRIORITY: EvaluatedScriptStatus[] = [
  "signed_off",
  "drafted",
  "identity_amber",
  "drafting",
  "queued_draft",
  "parsing",
  "identity_cleared",
  "pending",
];

function furthestStatus(
  statuses: EvaluatedScriptStatus[]
): EvaluatedScriptStatus | null {
  if (!statuses.length) return null;
  for (const status of STATUS_PRIORITY) {
    if (statuses.includes(status)) return status;
  }
  return statuses[0] ?? null;
}

export function StudentRosterTable({
  classId,
  students,
  emptyMessage = "No students yet. Use the buttons above to add one or import a CSV.",
}: StudentRosterTableProps) {
  const router = useRouter();
  const deleteStudent = useDeleteStudent(classId);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [n1Eval, setN1Eval] = useState<N1EvalTarget | null>(null);

  const { data: batches } = useEvaluationBatches(classId);
  const activeBatch = useMemo(() => {
    const open = (batches ?? []).filter((b) => b.status !== "signed_off");
    if (!open.length) return null;
    return [...open].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]!;
  }, [batches]);

  const activeBatchId = activeBatch?.id;
  const { data: scriptsData } = useEvaluationScripts(activeBatchId);
  useEvalScriptRealtime(activeBatchId);

  const statusByStudentId = useMemo(() => {
    const map = new Map<string, EvaluatedScriptStatus[]>();
    for (const script of scriptsData?.scripts ?? []) {
      if (!script.student_id) continue;
      const list = map.get(script.student_id) ?? [];
      list.push(script.status);
      map.set(script.student_id, list);
    }
    const furthest = new Map<string, EvaluatedScriptStatus>();
    for (const [studentId, statuses] of map) {
      const status = furthestStatus(statuses);
      if (status) furthest.set(studentId, status);
    }
    return furthest;
  }, [scriptsData?.scripts]);

  const scriptIdByStudentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const script of scriptsData?.scripts ?? []) {
      if (!script.student_id) continue;
      if (script.status === "drafted" || script.status === "signed_off") {
        map.set(script.student_id, script.id);
      }
    }
    return map;
  }, [scriptsData?.scripts]);

  if (!students.length) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  function renderDot(student: Student) {
    const status = statusByStudentId.get(student.id);
    const state = evalDotStateFromScriptStatus(status);
    const reviewScriptId = scriptIdByStudentId.get(student.id);
    const assessmentId = activeBatch?.assessment_id;

    if (
      (state === "ready" || state === "done") &&
      reviewScriptId &&
      assessmentId
    ) {
      return (
        <button
          type="button"
          className="inline-flex items-center"
          title={
            state === "done" ? "Signed off — open review" : "Ready to review"
          }
          aria-label={
            state === "done"
              ? `Open signed-off review for ${student.full_name}`
              : `Open review for ${student.full_name}`
          }
          onClick={(event) => {
            event.stopPropagation();
            router.push(
              scriptReviewPath(classId, assessmentId, reviewScriptId)
            );
          }}
        >
          <EvalProgressDot state={state} />
        </button>
      );
    }

    return (
      <EvalProgressDot state={state} title={status ?? "No evaluation yet"} />
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <Table containerClassName="overflow-visible">
          <TableHeader>
            <TableRow>
              <TableHead sticky className="w-8" />
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
                <TableCell className="w-8">{renderDot(student)}</TableCell>
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
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => setSelectedStudent(student)}
              >
                {renderDot(student)}
                <span className="min-w-0">
                  <p className="font-medium">{student.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {student.admission_number ?? "No admission no."}
                    {student.gender ? ` · ${student.gender}` : ""}
                  </p>
                </span>
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
        onContinueReview={({ batchId, assessmentId, scriptId }) => {
          setSelectedStudent(null);
          if (scriptId) {
            router.push(scriptReviewPath(classId, assessmentId, scriptId));
            return;
          }
          router.push(`/classes/${classId}/evaluations/${batchId}`);
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
