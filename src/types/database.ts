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
  | "in_review"
  | "signed_off";

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

export type EvaluationBatchMode = "batch" | "live";

export type EvaluationBatch = {
  id: string;
  class_id: string;
  assessment_id: string | null;
  marking_scheme_resource_id: string | null;
  /** When set, batch was started for a single student (PSL-48 N=1). */
  scoped_student_id: string | null;
  mode: EvaluationBatchMode;
  status: EvaluationBatchStatus;
  created_at: string;
};

/** Normalized vertical scroll region on a page (0–1). */
export type QuestionVerticalBounds = {
  top_percent: number;
  bottom_percent: number;
};

export type EvaluatedScriptStatus =
  | "uploaded"
  | "indexing"
  | "identity_amber"
  | "evaluating"
  | "ready"
  | "signed_off"
  | "failed"
  | "unmatched"
  /** @deprecated Legacy ADR-004 rows — treat as uploaded/indexing during migration */
  | "pending"
  | "parsing"
  | "queued_draft"
  | "drafting"
  | "identity_cleared"
  | "drafted";

export type GeminiBatchJobPhase = "index" | "evaluate";

export type GeminiBatchJobState =
  | "pending"
  | "submitted"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type GeminiBatchJob = {
  id: string;
  batch_id: string;
  phase: GeminiBatchJobPhase;
  provider_batch_name: string | null;
  state: GeminiBatchJobState;
  attempt_count: number;
  page_count: number;
  script_count: number;
  error: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EvaluationPage = {
  id: string;
  batch_id: string;
  script_id: string | null;
  storage_path: string;
  file_name: string;
  upload_index: number;
  content_hash: string;
  admission_number: string | null;
  admission_confidence: number | null;
  page_number: number | null;
  total_pages: number | null;
  questions_found: string[];
  index_model_id: string | null;
  created_at: string;
};

/** Page entry on a script (legacy page_order + new pipeline). */
export type EvaluatedScriptPage = {
  storagePath: string;
  fileName: string;
  uploadIndex: number;
  contentHash?: string;
  duplicate?: boolean;
  questionNumbers?: string[];
  readAdmissionNumber?: string | null;
  conflict?: boolean;
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

export type QuestionAttentionStatus = "CORRECT" | "ATTENTION_NEEDED";

export type QuestionEvaluationStatus =
  | "ai_draft"
  | "ai_estimate"
  | "teacher_edited"
  | "reevaluated";

export type QuestionEvaluation = {
  id: string;
  script_id: string;
  question_number: string;
  /** Section/part label when known (A, B, BLK1, …). */
  section: string | null;
  /** Unique within script — e.g. A:1, B:1, or bare 1. */
  canonical_key: string | null;
  awarded: number | null;
  max: number | null;
  feedback: string | null;
  student_answer: string | null;
  expected_answer: string | null;
  student_work: Record<string, unknown> | null;
  correct_reference: Record<string, unknown> | null;
  explanation: string | null;
  page_number: number | null;
  vertical_bounds: QuestionVerticalBounds | null;
  model_id: string | null;
  confidence: number | null;
  attention_status: QuestionAttentionStatus | null;
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
