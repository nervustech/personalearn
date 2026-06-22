"use client";

import Link from "next/link";
import { useActiveClassStore } from "@/lib/store/active-class";
import { useClasses } from "@/lib/hooks/use-classes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClassCreateDialog } from "@/components/classes/class-create-dialog";
import { ClassEditDialog } from "@/components/classes/class-edit-dialog";

export default function ClassesPage() {
  const { data: classes, isLoading } = useClasses();
  const activeClass = useActiveClassStore((state) => state.activeClass);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Classes</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your classes and student rosters.
          </p>
        </div>
        <ClassCreateDialog />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading classes…</p>
      ) : !classes?.length ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No classes yet. Create your first class to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {classes.map((cls) => (
            <Card
              key={cls.id}
              className={activeClass?.id === cls.id ? "ring-2 ring-primary/30" : undefined}
            >
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2">
                  <Link
                    href={`/classes/${cls.id}`}
                    className="hover:text-primary hover:underline"
                  >
                    {cls.name}
                  </Link>
                  <ClassEditDialog cls={cls} />
                </CardTitle>
                <CardDescription>
                  Grade {cls.grade_level} · {cls.subject} · Term {cls.term} ·{" "}
                  {cls.academic_year}
                  {cls.section ? ` · Section ${cls.section}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/classes/${cls.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View student roster →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
