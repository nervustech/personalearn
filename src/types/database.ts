export type Class = {
  id: string;
  teacher_id: string;
  name: string;
  grade_level: number;
  subject: string;
  term: number;
  academic_year: string;
  section: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Student = {
  id: string;
  class_id: string;
  admission_number: string | null;
  full_name: string;
  gender: "Male" | "Female" | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ResourceType =
  | "scheme_of_work"
  | "assignment"
  | "lesson_notes"
  | "marking_scheme"
  | "quiz"
  | "examination"
  | "other";

export type Resource = {
  id: string;
  class_id: string;
  title: string;
  raw_content: Record<string, unknown>;
  ai_generated: boolean;
  resource_type: ResourceType | null;
  status: "draft" | "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ConversationMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls: Record<string, unknown> | null;
  created_at: string;
};
