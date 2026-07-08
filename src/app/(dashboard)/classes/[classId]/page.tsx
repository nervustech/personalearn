"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useStudents } from "@/lib/hooks/use-classes";
import { useClasses } from "@/lib/hooks/use-classes";
import { filterStudentsByQuery } from "@/lib/classes/filter-class-lists";
import { useActiveClassStore } from "@/lib/store/active-class";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StudentRosterTable } from "@/components/classes/student-roster-table";
import { AddStudentDialog } from "@/components/classes/add-student-dialog";
import { CsvImportDialog } from "@/components/classes/csv-import-dialog";
import { ClassEditDialog } from "@/components/classes/class-edit-dialog";
import { ClassResourcesSection } from "@/components/classes/class-resources-section";

export default function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  const { data: classes } = useClasses();
  const { data: students, isLoading } = useStudents(classId);
  const setActiveClass = useActiveClassStore((state) => state.setActiveClass);
  const [searchQuery, setSearchQuery] = useState("");
  const cls = classes?.find((c) => c.id === classId);
  const hasQuery = searchQuery.trim().length > 0;

  const filteredStudents = useMemo(
    () => filterStudentsByQuery(students ?? [], searchQuery),
    [students, searchQuery]
  );

  useEffect(() => {
    if (!cls) return;
    setActiveClass({
      id: cls.id,
      name: cls.name,
      grade_level: cls.grade_level,
      subject: cls.subject,
      section: cls.section,
      term: cls.term,
    });
  }, [cls, setActiveClass]);

  if (!cls && classes) {
    return (
      <p className="text-center text-muted-foreground">
        Class not found.{" "}
        <Link href="/classes" className="text-primary hover:underline">
          Go to classes
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <h1 className="text-3xl font-semibold">{cls?.name ?? "Class"}</h1>
        {cls ? (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-muted-foreground">
            <p>
              Grade {cls.grade_level} · {cls.subject} · Term {cls.term}
              {cls.section ? ` · Section ${cls.section}` : ""}
            </p>
            <ClassEditDialog cls={cls} />
          </div>
        ) : null}
        <div className="relative mt-4 w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search resources or students…"
            className="h-9 pl-9 pr-9"
            aria-label="Search resources or students"
          />
          {hasQuery ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0 text-muted-foreground"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <ClassResourcesSection
          classId={classId}
          scrollable
          searchQuery={searchQuery}
        />

        <Card className="flex min-h-0 flex-col lg:max-h-[min(70vh,40rem)]">
          <CardHeader className="flex shrink-0 flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Student roster</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <AddStudentDialog classId={classId} />
              <CsvImportDialog classId={classId} />
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading students…</p>
            ) : (
              <StudentRosterTable
                classId={classId}
                students={filteredStudents}
                emptyMessage={
                  hasQuery
                    ? "No matching students."
                    : "No students yet. Use the buttons above to add one or import a CSV."
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
