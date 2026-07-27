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
  | "teaching_aid"
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

export type AssessmentType =
  | "practical"
  | "written"
  | "formative"
  | "summative";

export type Assessment = {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  linked_strand: string | null;
  linked_sub_strand: string | null;
  type: AssessmentType | null;
  resource_id: string | null;
  created_at: string;
};

export type EvaluationBatchStatus =
  | "draft"
  | "processing"
  | "drafted"
  | "in_review"
  | "signed_off";

export type EvaluationBatch = {
  id: string;
  class_id: string;
  assessment_id: string | null;
  marking_scheme_resource_id: string | null;
  /** When set, batch was started for a single student (PSL-48 N=1). */
  scoped_student_id: string | null;
  status: EvaluationBatchStatus;
  created_at: string;
};

/** Vision answer region (0–1000 normalized). Multi-page answers use several entries. */
export type QuestionBoundingBox = {
  page: number;
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
};

/** Per-student assessment status on the roster profile (PSL-48). */
export type StudentAssessmentStatus =
  | "not_started"
  | "in_review"
  | "signed_off";

export type EvaluatedScriptStatus =
  | "pending"
  | "identity_amber"
  | "identity_cleared"
  | "drafted"
  | "signed_off";

/** Enriched page entry stored in evaluated_scripts.page_order (PSL-45+). */
export type EvaluatedScriptPage = {
  storagePath: string;
  fileName: string;
  uploadIndex: number;
  /** Hex SHA-256 of uploaded bytes (batch-scoped dedupe). */
  contentHash?: string;
  /** True when this entry reused an earlier page's blob in the same batch. */
  duplicate?: boolean;
  /** Normalized labels e.g. "1", "1a", "a" (legacy number[] coerced on read). */
  questionNumbers?: string[];
  readAdmissionNumber?: string | null;
  conflict?: boolean;
  /** Student already has a submission/script for this assessment. */
  alreadyEvaluated?: boolean;
};

export type EvaluatedScript = {
  id: string;
  batch_id: string;
  student_id: string | null;
  read_admission_number: string | null;
  match_confidence: "high" | "low" | null;
  page_order: EvaluatedScriptPage[];
  status: EvaluatedScriptStatus;
  created_at: string;
};

export type QuestionEvaluationStatus =
  | "ai_draft"
  | "ai_estimate"
  | "teacher_edited"
  | "reevaluated";

export type QuestionEvaluation = {
  id: string;
  script_id: string;
  question_number: string;
  awarded: number | null;
  max: number | null;
  feedback: string | null;
  /** Vision excerpt of what the student wrote (PSL-52). */
  student_answer: string | null;
  /** Scheme expectation for this Q; null when no scheme / ai_estimate. */
  expected_answer: string | null;
  /** Answer regions for highlight + crop re-prompt (ADR-004 / F5). */
  bounding_box: QuestionBoundingBox[] | null;
  status: QuestionEvaluationStatus;
  created_at: string;
};

export type StudentSubmission = {
  id: string;
  assessment_id: string;
  student_id: string;
  content: string | null;
  file_url: string | null;
  submitted_at: string;
  ai_feedback: string | null;
  teacher_feedback: string | null;
  competency_flags: Record<string, unknown>;
  created_at: string;
};

export type CompetencyProgress = {
  id: string;
  student_id: string;
  class_id: string;
  strand: string;
  sub_strand: string | null;
  competency_code: string | null;
  status: "mastered" | "developing" | "not_yet";
  last_evidence_at: string | null;
  evidence_count: number;
  updated_at: string;
};
