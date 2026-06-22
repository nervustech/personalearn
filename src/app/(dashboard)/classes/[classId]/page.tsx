"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { useStudents } from "@/lib/hooks/use-classes";
import { useClasses } from "@/lib/hooks/use-classes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentRosterTable } from "@/components/classes/student-roster-table";
import { StudentForm } from "@/components/classes/student-form";
import { CsvImportDialog } from "@/components/classes/csv-import-dialog";
import { ClassEditDialog } from "@/components/classes/class-edit-dialog";

export default function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  const { data: classes } = useClasses();
  const { data: students, isLoading } = useStudents(classId);
  const cls = classes?.find((c) => c.id === classId);

  if (!cls && classes) {
    return (
      <p className="text-muted-foreground">
        Class not found.{" "}
        <Link href="/classes" className="text-primary hover:underline">
          Back to classes
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/classes"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          All classes
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{cls?.name ?? "Class"}</h1>
            {cls ? (
              <p className="mt-1 text-muted-foreground">
                Grade {cls.grade_level} · {cls.subject} · Term {cls.term}
              </p>
            ) : null}
          </div>
          {cls ? <ClassEditDialog cls={cls} /> : null}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Student roster</CardTitle>
          <CsvImportDialog classId={classId} />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading students…</p>
          ) : (
            <StudentRosterTable classId={classId} students={students ?? []} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add student</CardTitle>
        </CardHeader>
        <CardContent>
          <StudentForm classId={classId} />
        </CardContent>
      </Card>
    </div>
  );
}
