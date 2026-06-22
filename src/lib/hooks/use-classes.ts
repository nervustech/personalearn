"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ensureUserProfile } from "@/lib/auth/ensure-user-profile";
import { createClient } from "@/lib/supabase/client";
import type { Class } from "@/types/database";
import type { ClassFormValues } from "@/lib/validations/class";
import { useActiveClassStore } from "@/lib/store/active-class";

export const classesQueryKey = ["classes"] as const;

async function getCurrentUserId() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");
  await ensureUserProfile(supabase, user);
  return user.id;
}

export function useCreateClass() {
  const queryClient = useQueryClient();
  const setActiveClass = useActiveClassStore((state) => state.setActiveClass);

  return useMutation({
    mutationFn: async (values: ClassFormValues) => {
      const supabase = createClient();
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from("classes")
        .insert({
          teacher_id: userId,
          name: values.name,
          grade_level: values.grade_level,
          subject: values.subject,
          term: values.term,
          academic_year: values.academic_year,
          section: values.section || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Class;
    },
    onSuccess: (newClass) => {
      setActiveClass({
        id: newClass.id,
        name: newClass.name,
        grade_level: newClass.grade_level,
        subject: newClass.subject,
        section: newClass.section,
        term: newClass.term,
      });
      queryClient.invalidateQueries({ queryKey: classesQueryKey });
    },
  });
}
