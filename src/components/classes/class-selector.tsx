"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus } from "lucide-react";
import { useClasses } from "@/lib/hooks/use-classes";
import { useActiveClassStore } from "@/lib/store/active-class";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ClassCreateDialog } from "@/components/classes/class-create-dialog";
import { cn } from "@/lib/utils";

export function ClassSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: classes, isLoading } = useClasses();
  const activeClass = useActiveClassStore((state) => state.activeClass);
  const setActiveClass = useActiveClassStore((state) => state.setActiveClass);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  function selectClass(cls: NonNullable<typeof classes>[number]) {
    setActiveClass({
      id: cls.id,
      name: cls.name,
      grade_level: cls.grade_level,
      subject: cls.subject,
      section: cls.section,
      term: cls.term,
    });
    queryClient.invalidateQueries();
    if (pathname.startsWith("/classes")) {
      router.push(`/classes/${cls.id}`);
    }
  }

  const label = isLoading
    ? "Loading…"
    : activeClass
      ? activeClass.name
      : classes?.length
        ? "Select class"
        : "No active class";

  return (
    <>
      <DropdownMenu
        align="end"
        trigger={
          <button
            type="button"
            className={cn(
              "flex max-w-[12rem] items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted sm:max-w-[16rem]"
            )}
          >
            <span className="truncate">{label}</span>
            <ChevronDown className="h-3 w-3 shrink-0" />
          </button>
        }
      >
        {classes?.map((cls) => (
          <DropdownMenuItem
            key={cls.id}
            onClick={() => selectClass(cls)}
            className={activeClass?.id === cls.id ? "bg-primary/10 text-primary" : undefined}
          >
            <div className="truncate">
              <span className="font-medium">{cls.name}</span>
              <span className="ml-1 text-muted-foreground">
                · G{cls.grade_level} {cls.subject}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
        {!classes?.length && !isLoading ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">No classes yet</p>
        ) : null}
        <div className="my-1 border-t border-border" />
        <DropdownMenuItem onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4 shrink-0" />
          New class
        </DropdownMenuItem>
      </DropdownMenu>
      <ClassCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        showDefaultTrigger={false}
      />
    </>
  );
}
