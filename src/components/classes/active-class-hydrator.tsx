"use client";

import { useEffect } from "react";
import { useClasses } from "@/lib/hooks/use-classes";
import { useActiveClassStore } from "@/lib/store/active-class";

export function ActiveClassHydrator() {
  const { data: classes, isSuccess } = useClasses();
  const activeClass = useActiveClassStore((state) => state.activeClass);
  const setActiveClass = useActiveClassStore((state) => state.setActiveClass);

  useEffect(() => {
    if (!isSuccess || !classes?.length) return;

    const stillValid = activeClass && classes.some((c) => c.id === activeClass.id);
    if (!stillValid) {
      const first = classes[0];
      setActiveClass({
        id: first.id,
        name: first.name,
        grade_level: first.grade_level,
        subject: first.subject,
        section: first.section,
        term: first.term,
      });
    }
  }, [isSuccess, classes, activeClass, setActiveClass]);

  return null;
}
