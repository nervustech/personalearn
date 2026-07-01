"use client";

import Link from "next/link";
import { Bot, Users } from "lucide-react";
import { useActiveClassStore } from "@/lib/store/active-class";
import { useStudents } from "@/lib/hooks/use-classes";
import { WelcomeTour } from "@/components/onboarding/welcome-tour";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const activeClass = useActiveClassStore((state) => state.activeClass);
  const { data: students, isLoading } = useStudents(activeClass?.id);

  const studentCount = students?.length ?? 0;
  const topStudents = students?.slice(0, 5) ?? [];

  return (
    <>
      <WelcomeTour />
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Dashboard</h1>
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
                <CardDescription>Class overview and competency progress</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeClass ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Students enrolled</span>
                      <span className="font-semibold">
                        {isLoading ? "…" : studentCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Term</span>
                      <span className="font-medium">Term {activeClass.term}</span>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
                      No assessments yet — competency tracking arrives in Sprint 3.
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a class to see performance.</p>
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
                  <Badge variant="accent">Sprint 2</Badge>
                </div>
                <CardDescription>
                  Generate lesson notes, activities, and get quick answers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">
                  Class-scoped AI generation and co-pilot chat coming in Sprint 2.
                </p>
                <Link
                  href="/ai-hub"
                  className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-4 text-xs font-medium hover:bg-muted"
                >
                  Preview AI Hub
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
                <p className="text-sm text-muted-foreground">No active class selected.</p>
              ) : isLoading ? (
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
