"use client";

import Link from "next/link";
import { AssessmentHealthStrip } from "@/components/dashboard/assessment-health-strip";
import { CompetencySnapshot } from "@/components/dashboard/competency-snapshot";
import { RecentActivityLists } from "@/components/dashboard/recent-activity-lists";
import { WelcomeTour } from "@/components/onboarding/welcome-tour";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useStudents } from "@/lib/hooks/use-classes";
import {
  useAssessments,
  useClassSubmissions,
  useCompetencyProgress,
} from "@/lib/hooks/use-evaluation";
import { useActiveClassStore } from "@/lib/store/active-class";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const activeClass = useActiveClassStore((state) => state.activeClass);
  const { data: students, isLoading: studentsLoading } = useStudents(
    activeClass?.id
  );
  const { data: competency, isLoading: competencyLoading } =
    useCompetencyProgress(activeClass?.id);
  const { data: assessments, isLoading: assessmentsLoading } = useAssessments(
    activeClass?.id
  );
  const { data: submissions, isLoading: submissionsLoading } =
    useClassSubmissions(activeClass?.id);

  const snapshotLoading = studentsLoading || competencyLoading;
  const healthLoading = assessmentsLoading || submissionsLoading;

  return (
    <>
      <WelcomeTour />
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            {activeClass
              ? `${activeClass.name} — Grade ${activeClass.grade_level} ${activeClass.subject}`
              : "Your CBC teaching co-pilot"}
          </p>
        </div>

        {/* Primary column: Performance. Shortcuts below (side-by-side on md+). */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
          <Card className={cn("surface-float border-0")}>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
              <CardDescription>
                Assessment health and competency progress
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {activeClass ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Term</span>
                    <span className="font-medium">Term {activeClass.term}</span>
                  </div>
                  <AssessmentHealthStrip
                    classId={activeClass.id}
                    assessments={assessments ?? []}
                    submissions={submissions ?? []}
                    isLoading={healthLoading}
                  />
                  <CompetencySnapshot
                    classId={activeClass.id}
                    students={students ?? []}
                    competency={competency ?? []}
                    isLoading={snapshotLoading}
                  />
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Select or create a class to see performance, assessment
                    health, and recent activity.
                  </p>
                  <Link
                    href="/classes"
                    className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Go to classes
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <RecentActivityLists classId={activeClass?.id} />
        </div>
      </div>
    </>
  );
}
