"use client";

import Link from "next/link";
import { CompetencySnapshot } from "@/components/dashboard/competency-snapshot";
import { NotificationPreviews } from "@/components/dashboard/notification-previews";
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

  const performanceLoading =
    studentsLoading ||
    competencyLoading ||
    assessmentsLoading ||
    submissionsLoading;

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

        <NotificationPreviews />

        {/* Primary: Performance. Recent lists full-width below (side-by-side on md+). */}
        <div className="space-y-4">
          <Card className={cn("surface-float border-0")}>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
              <CardDescription>
                Class overview and per-student assessment health
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeClass ? (
                <CompetencySnapshot
                  classId={activeClass.id}
                  term={activeClass.term}
                  students={students ?? []}
                  competency={competency ?? []}
                  assessments={assessments ?? []}
                  submissions={submissions ?? []}
                  isLoading={performanceLoading}
                />
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
