"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureUserProfile } from "@/lib/auth/ensure-user-profile";
import { createClient } from "@/lib/supabase/client";
import type { Class, Student } from "@/types/database";
import type { ClassFormValues, StudentFormValues } from "@/lib/validations/class";
import { useActiveClassStore } from "@/lib/store/active-class";

export const classesQueryKey = ["classes"] as const;
export const studentsQueryKey = (classId: string) => ["students", classId] as const;

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

export function useClasses() {
  return useQuery({
    queryKey: classesQueryKey,
    queryFn: async () => {
      const supabase = createClient();
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("teacher_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Class[];
    },
  });
}

export function useStudents(classId: string | undefined) {
  return useQuery({
    queryKey: studentsQueryKey(classId ?? ""),
    enabled: Boolean(classId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("class_id", classId!)
        .order("full_name", { ascending: true });

      if (error) throw error;
      return data as Student[];
    },
  });
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

export function useUpdateClass() {
  const queryClient = useQueryClient();
  const activeClass = useActiveClassStore((state) => state.activeClass);
  const setActiveClass = useActiveClassStore((state) => state.setActiveClass);

  return useMutation({
    mutationFn: async ({
      classId,
      values,
    }: {
      classId: string;
      values: Partial<ClassFormValues>;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("classes")
        .update({
          ...(values.name !== undefined && { name: values.name }),
          ...(values.grade_level !== undefined && { grade_level: values.grade_level }),
          ...(values.subject !== undefined && { subject: values.subject }),
          ...(values.term !== undefined && { term: values.term }),
          ...(values.academic_year !== undefined && { academic_year: values.academic_year }),
          ...(values.section !== undefined && { section: values.section || null }),
        })
        .eq("id", classId)
        .select()
        .single();

      if (error) throw error;
      return data as Class;
    },
    onSuccess: (updated) => {
      if (activeClass?.id === updated.id) {
        setActiveClass({
          id: updated.id,
          name: updated.name,
          grade_level: updated.grade_level,
          subject: updated.subject,
          section: updated.section,
          term: updated.term,
        });
      }
      queryClient.invalidateQueries({ queryKey: classesQueryKey });
    },
  });
}

export function useArchiveClass() {
  const queryClient = useQueryClient();
  const activeClass = useActiveClassStore((state) => state.activeClass);
  const clearActiveClass = useActiveClassStore((state) => state.clearActiveClass);

  return useMutation({
    mutationFn: async (classId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("classes")
        .update({ is_active: false })
        .eq("id", classId);
      if (error) throw error;
      return classId;
    },
    onSuccess: (archivedId) => {
      if (activeClass?.id === archivedId) {
        clearActiveClass();
      }
      queryClient.invalidateQueries({ queryKey: classesQueryKey });
    },
  });
}

export function useCreateStudent(classId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: StudentFormValues) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("students")
        .insert({
          class_id: classId,
          full_name: values.full_name,
          admission_number: values.admission_number || null,
          gender: values.gender || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Student;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentsQueryKey(classId) });
    },
  });
}

export function useCreateStudentsBulk(classId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (students: StudentFormValues[]) => {
      const supabase = createClient();
      const rows = students.map((s) => ({
        class_id: classId,
        full_name: s.full_name,
        admission_number: s.admission_number || null,
        gender: s.gender || null,
      }));
      const { data, error } = await supabase.from("students").insert(rows).select();
      if (error) throw error;
      return data as Student[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentsQueryKey(classId) });
    },
  });
}

export function useDeleteStudent(classId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (studentId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("students").delete().eq("id", studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentsQueryKey(classId) });
    },
  });
}
