"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActiveClassStore } from "@/lib/store/active-class";
import { useClasses } from "@/lib/hooks/use-classes";
import { Card, CardContent } from "@/components/ui/card";
import { ClassCreateDialog } from "@/components/classes/class-create-dialog";

export default function ClassesPage() {
  const router = useRouter();
  const { data: classes, isLoading, isSuccess } = useClasses();
  const activeClass = useActiveClassStore((state) => state.activeClass);

  useEffect(() => {
    if (!isSuccess || !classes?.length) return;

    const preferred =
      (activeClass && classes.find((c) => c.id === activeClass.id)) ?? classes[0];

    router.replace(`/classes/${preferred.id}`);
  }, [isSuccess, classes, activeClass, router]);

  if (isLoading || (isSuccess && classes?.length)) {
    return (
      <p className="text-sm text-muted-foreground">Opening class…</p>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center">
      <div>
        <h1 className="text-3xl font-semibold">Classes</h1>
        <p className="mt-1 text-muted-foreground">
          Create your first class to manage resources and students.
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <p className="text-sm text-muted-foreground">No classes yet.</p>
          <ClassCreateDialog />
        </CardContent>
      </Card>
    </div>
  );
}
