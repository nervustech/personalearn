"use client";

import Link from "next/link";
import { Bot, Users } from "lucide-react";
import { CompetencySnapshot } from "@/components/dashboard/competency-snapshot";
import { WelcomeTour } from "@/components/onboarding/welcome-tour";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudents } from "@/lib/hooks/use-classes";
import { useCompetencyProgress } from "@/lib/hooks/use-evaluation";
import { useActiveClassStore } from "@/lib/store/active-class";

export default function DashboardPage() {
  const activeClass = useActiveClassStore((state) => state.activeClass);
  const { data: students, isLoading: studentsLoading } = useStudents(
    activeClass?.id
  );
  const { data: competency, isLoading: competencyLoading } =
    useCompetencyProgress(activeClass?.id);

  const topStudents = students?.slice(0, 5) ?? [];
  const snapshotLoading = studentsLoading || competencyLoading;

  return (
    <>
      <WelcomeTour />
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            {activeClass
              ? `${activeClass.name} — Grade ${activeClass.grade_level} ${activeClass.subject}`
              : "Your CBC teaching co-pilot"}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance</CardTitle>
                <CardDescription>
                  Class overview and competency progress
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeClass ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Term</span>
                      <span className="font-medium">Term {activeClass.term}</span>
                    </div>
                    <CompetencySnapshot
                      classId={activeClass.id}
                      students={students ?? []}
                      competency={competency ?? []}
                      isLoading={snapshotLoading}
                    />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select a class to see performance.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    AI Hub
                  </CardTitle>
                </div>
                <CardDescription>
                  Ask questions grounded in your class materials.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">
                  Upload a .txt scheme on the class page, then use the co-pilot
                  for cited answers.
                </p>
                <Link
                  href="/ai-hub"
                  className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-4 text-xs font-medium hover:bg-muted"
                >
                  Open AI Hub
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Students
                </CardTitle>
                {activeClass ? (
                  <Link
                    href={`/classes/${activeClass.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    View all
                  </Link>
                ) : null}
              </div>
              <CardDescription>Quick reference for your active class</CardDescription>
            </CardHeader>
            <CardContent>
              {!activeClass ? (
                <p className="text-sm text-muted-foreground">
                  No active class selected.
                </p>
              ) : studentsLoading ? (
                <p className="text-sm text-muted-foreground">Loading students…</p>
              ) : !topStudents.length ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">No students yet.</p>
                  <Link
                    href={`/classes/${activeClass.id}`}
                    className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Add students
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2">
                  {topStudents.map((student) => (
                    <li
                      key={student.id}
                      className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{student.full_name}</span>
                      <span className="text-muted-foreground">
                        {student.admission_number ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
