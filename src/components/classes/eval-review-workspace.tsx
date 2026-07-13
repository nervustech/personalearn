"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScriptPageViewer } from "@/components/classes/script-page-viewer";
import { previewCompetency } from "@/lib/evaluation/competency-map";
import type { ScriptReviewDto } from "@/lib/evaluation/identity";
import {
  asScriptPages,
  pageUrlsForQuestion,
  reviewMarkerKind,
} from "@/lib/evaluation/page-images";
import { MAX_REEVAL_INSTRUCTION_CHARS } from "@/lib/evaluation/reevaluate-question";
import { computeScriptTotal } from "@/lib/evaluation/script-totals";
import {
  useAssessments,
  useEvaluationScripts,
  useReevaluateQuestion,
  useSignOffScript,
  useUpdateQuestionEvaluation,
} from "@/lib/hooks/use-evaluation";
import type { QuestionEvaluation } from "@/types/database";
import { cn } from "@/lib/utils";
import type { UseMutationResult } from "@tanstack/react-query";

type EvalReviewWorkspaceProps = {
  classId: string;
  batchId: string;
  classSubject?: string;
};

type UpdateMutation = UseMutationResult<
  unknown,
  Error,
  {
    scriptId: string;
    questionId: string;
    awarded?: number | null;
    max?: number | null;
    feedback?: string | null;
  }
>;

type ReevaluateMutation = UseMutationResult<
  unknown,
  Error,
  {
    scriptId: string;
    questionId: string;
    instruction?: string;
  }
>;

function statusLabel(status: QuestionEvaluation["status"]) {
  switch (status) {
    case "ai_estimate":
      return "AI estimate";
    case "teacher_edited":
      return "Teacher edited";
    case "reevaluated":
      return "Re-evaluated";
    default:
      return "AI draft";
  }
}

function parseMarkInput(
  raw: string,
  original: number | null
):
  | { ok: true; value: number | null; changed: boolean }
  | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, value: original, changed: false };
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    return { ok: false, error: "Enter a valid number for marks" };
  }
  return {
    ok: true,
    value: n,
    changed: original === null ? true : original !== n,
  };
}

function QuestionAnalysisPanel({
  script,
  question,
  questionIndex,
  questionCount,
  readOnly,
  updateQuestion,
  reevaluate,
  onPrev,
  onNext,
}: {
  script: ScriptReviewDto;
  question: QuestionEvaluation;
  questionIndex: number;
  questionCount: number;
  readOnly: boolean;
  updateQuestion: UpdateMutation;
  reevaluate: ReevaluateMutation;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [awarded, setAwarded] = useState(
    question.awarded != null ? String(question.awarded) : ""
  );
  const [max, setMax] = useState(
    question.max != null ? String(question.max) : ""
  );
  const [feedback, setFeedback] = useState(question.feedback ?? "");
  const [reevalOpen, setReevalOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setAwarded(question.awarded != null ? String(question.awarded) : "");
    setMax(question.max != null ? String(question.max) : "");
    setFeedback(question.feedback ?? "");
    setLocalError(null);
  }, [question.id, question.awarded, question.max, question.feedback]);

  const hasStructuredAnalysis =
    Boolean(question.student_answer?.trim()) ||
    Boolean(question.expected_answer?.trim());

  async function saveEdits() {
    setLocalError(null);

    const awardedParsed = parseMarkInput(awarded, question.awarded);
    if (!awardedParsed.ok) {
      setLocalError(awardedParsed.error);
      setAwarded(question.awarded != null ? String(question.awarded) : "");
      return;
    }
    const maxParsed = parseMarkInput(max, question.max);
    if (!maxParsed.ok) {
      setLocalError(maxParsed.error);
      setMax(question.max != null ? String(question.max) : "");
      return;
    }

    const nextFeedback = feedback.trim() || null;
    const originalFeedback = question.feedback ?? null;
    const feedbackChanged = nextFeedback !== originalFeedback;

    if (!awardedParsed.changed && !maxParsed.changed && !feedbackChanged) {
      setAwarded(question.awarded != null ? String(question.awarded) : "");
      setMax(question.max != null ? String(question.max) : "");
      return;
    }

    try {
      await updateQuestion.mutateAsync({
        scriptId: script.id,
        questionId: question.id,
        ...(awardedParsed.changed ? { awarded: awardedParsed.value } : {}),
        ...(maxParsed.changed ? { max: maxParsed.value } : {}),
        ...(feedbackChanged ? { feedback: nextFeedback } : {}),
      });
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Could not save edits"
      );
    }
  }

  async function runReeval() {
    setLocalError(null);
    const trimmed = instruction.trim();
    if (trimmed.length > MAX_REEVAL_INSTRUCTION_CHARS) {
      setLocalError(
        `Instruction must be at most ${MAX_REEVAL_INSTRUCTION_CHARS} characters`
      );
      return;
    }
    try {
      await reevaluate.mutateAsync({
        scriptId: script.id,
        questionId: question.id,
        instruction: trimmed || undefined,
      });
      setReevalOpen(false);
      setInstruction("");
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Re-evaluation failed"
      );
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            Question {question.question_number}
          </p>
          <p
            className={cn(
              "text-xs",
              question.status === "ai_estimate"
                ? "text-amber-700"
                : "text-muted-foreground"
            )}
          >
            {statusLabel(question.status)} · {questionIndex + 1} of{" "}
            {questionCount}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={questionIndex <= 0}
            onClick={onPrev}
          >
            Prev
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={questionIndex >= questionCount - 1}
            onClick={onNext}
          >
            Next
          </Button>
        </div>
      </div>

      {hasStructuredAnalysis ? (
        <div className="space-y-3 rounded-xl border border-border/80 bg-background/60 p-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Student wrote
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap">
              {question.student_answer?.trim() || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Expected
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap">
              {question.expected_answer?.trim() ||
                (question.status === "ai_estimate"
                  ? "No scheme — estimate only"
                  : "—")}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-amber-700/30 bg-amber-50/60 p-3 text-sm text-amber-950">
          Structured student vs scheme analysis is not on this draft yet.
          {!readOnly
            ? " Re-evaluate this question to refresh analysis fields."
            : null}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`awarded-${question.id}`}>Awarded</Label>
          <Input
            id={`awarded-${question.id}`}
            type="number"
            step="any"
            value={awarded}
            disabled={readOnly || updateQuestion.isPending}
            onChange={(e) => setAwarded(e.target.value)}
            onBlur={() => {
              if (!readOnly) void saveEdits();
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`max-${question.id}`}>Max</Label>
          <Input
            id={`max-${question.id}`}
            type="number"
            step="any"
            value={max}
            disabled={readOnly || updateQuestion.isPending}
            onChange={(e) => setMax(e.target.value)}
            onBlur={() => {
              if (!readOnly) void saveEdits();
            }}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`feedback-${question.id}`}>Rationale</Label>
        <textarea
          id={`feedback-${question.id}`}
          className="min-h-24 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
          value={feedback}
          disabled={readOnly || updateQuestion.isPending}
          onChange={(e) => setFeedback(e.target.value)}
          onBlur={() => {
            if (!readOnly) void saveEdits();
          }}
        />
      </div>

      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={updateQuestion.isPending}
            onClick={() => void saveEdits()}
          >
            {updateQuestion.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={reevaluate.isPending}
            onClick={() => setReevalOpen(true)}
          >
            Re-evaluate
          </Button>
        </div>
      ) : null}

      {localError ? (
        <p className="text-sm text-destructive">{localError}</p>
      ) : null}

      <Dialog
        open={reevalOpen}
        onOpenChange={setReevalOpen}
        title={`Re-evaluate Q${question.question_number}`}
        description="Optional instruction for the vision grader. Refreshes marks and comparison fields."
      >
        <div className="space-y-3">
          <textarea
            className="min-h-24 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
            placeholder="Instruction (optional)"
            maxLength={MAX_REEVAL_INSTRUCTION_CHARS}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setReevalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={reevaluate.isPending}
              onClick={() => void runReeval()}
            >
              {reevaluate.isPending ? "Re-evaluating…" : "Run re-evaluate"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function ScriptWorkspace({
  script,
  classId,
  batchId,
  strand,
  subStrand,
}: {
  script: ScriptReviewDto;
  classId: string;
  batchId: string;
  strand: string;
  subStrand: string | null;
}) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const signOff = useSignOffScript(classId, batchId);
  const updateQuestion = useUpdateQuestionEvaluation(classId, batchId);
  const reevaluate = useReevaluateQuestion(classId, batchId);
  const readOnly = script.status === "signed_off";
  const questions = script.questions ?? [];
  const totals = script.totals ?? computeScriptTotal(questions);
  const competency = previewCompetency({
    strand,
    subStrand,
    awarded: totals.awarded,
    max: totals.max,
  });

  useEffect(() => {
    setQuestionIndex(0);
  }, [script.id]);

  const safeIndex =
    questions.length === 0
      ? 0
      : Math.min(questionIndex, questions.length - 1);
  const question = questions[safeIndex];

  const pages = useMemo(() => {
    if (!question) return script.pageUrls;
    return pageUrlsForQuestion(
      asScriptPages(script.page_order),
      script.pageUrls,
      question.question_number
    );
  }, [question, script.page_order, script.pageUrls]);

  const markerKind = reviewMarkerKind(
    question?.awarded ?? null,
    question?.max ?? null
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            {script.student_name ?? "Unassigned student"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Admission: {script.read_admission_number ?? "—"} · Status:{" "}
            {script.status}
          </p>
          <p className="mt-1 text-sm">
            Total:{" "}
            <span className="font-medium">
              {totals.awarded ?? "—"} / {totals.max ?? "—"}
            </span>
            <span className="ml-2 text-muted-foreground">
              Competency preview: {competency.status}
            </span>
          </p>
        </div>
        {script.status === "drafted" ? (
          <Button
            type="button"
            size="sm"
            disabled={!script.student_id || signOff.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            Sign off
          </Button>
        ) : null}
      </header>

      {signOff.isError ? (
        <p className="text-sm text-destructive">
          {signOff.error instanceof Error
            ? signOff.error.message
            : "Sign-off failed"}
        </p>
      ) : null}

      {question ? (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <ScriptPageViewer
            pages={pages}
            markerKind={markerKind}
            markerStatus={question.status}
            questionLabel={question.question_number}
          />
          <QuestionAnalysisPanel
            script={script}
            question={question}
            questionIndex={safeIndex}
            questionCount={questions.length}
            readOnly={readOnly}
            updateQuestion={updateQuestion}
            reevaluate={reevaluate}
            onPrev={() => setQuestionIndex((i) => Math.max(0, i - 1))}
            onNext={() =>
              setQuestionIndex((i) => Math.min(questions.length - 1, i + 1))
            }
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No question drafts yet for this script.
        </p>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Sign off this script?"
        description="Writes student submission and competency progress. Drafts stay pending until you confirm."
      >
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setConfirmOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={signOff.isPending}
            onClick={async () => {
              await signOff.mutateAsync(script.id);
              setConfirmOpen(false);
            }}
          >
            {signOff.isPending ? "Signing off…" : "Confirm sign-off"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export function EvalReviewWorkspace({
  classId,
  batchId,
  classSubject = "General",
}: EvalReviewWorkspaceProps) {
  const { data, isLoading, error } = useEvaluationScripts(batchId);
  const { data: assessments } = useAssessments(classId);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);

  const assessmentMeta = useMemo(() => {
    const assessmentId = data?.batch?.assessment_id;
    if (!assessmentId || !assessments?.length) {
      return {
        strand: classSubject,
        subStrand: null as string | null,
      };
    }
    const assessment = assessments.find((a) => a.id === assessmentId);
    const strand =
      assessment?.linked_strand?.trim() || classSubject || "General";
    return {
      strand,
      subStrand: assessment?.linked_sub_strand ?? null,
    };
  }, [assessments, classSubject, data?.batch?.assessment_id]);

  const reviewScripts = useMemo(() => {
    const scripts = data?.scripts ?? [];
    return scripts.filter(
      (s) => s.status === "drafted" || s.status === "signed_off"
    );
  }, [data?.scripts]);

  useEffect(() => {
    if (reviewScripts.length === 0) {
      setSelectedScriptId(null);
      return;
    }
    if (
      selectedScriptId &&
      reviewScripts.some((s) => s.id === selectedScriptId)
    ) {
      return;
    }
    const firstDrafted = reviewScripts.find((s) => s.status === "drafted");
    setSelectedScriptId((firstDrafted ?? reviewScripts[0]).id);
  }, [reviewScripts, selectedScriptId]);

  const selectedScript =
    reviewScripts.find((s) => s.id === selectedScriptId) ?? null;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load review queue"}
      </p>
    );
  }

  if (reviewScripts.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Review workspace</h2>
        <p className="text-sm text-muted-foreground">
          No drafted scripts yet. Process identity and draft marks in the
          section below — then scripts appear here for edit, re-eval, and
          sign-off.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Review workspace</h2>
        <p className="text-sm text-muted-foreground">
          Scan pages beside AI analysis, verify comparison cards, then sign off.
          Durable writes happen only on sign-off.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {reviewScripts.map((script) => {
          const totals =
            script.totals ?? computeScriptTotal(script.questions ?? []);
          const selected = script.id === selectedScriptId;
          return (
            <button
              key={script.id}
              type="button"
              onClick={() => setSelectedScriptId(script.id)}
              className={cn(
                "min-w-[10.5rem] shrink-0 rounded-xl border px-3 py-2 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card/60 hover:bg-muted/50"
              )}
            >
              <p className="truncate text-sm font-medium">
                {script.student_name ?? "Unassigned"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {script.read_admission_number ?? "—"} · {totals.awarded ?? "—"}/
                {totals.max ?? "—"}
              </p>
              <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                {script.status.replaceAll("_", " ")}
              </p>
            </button>
          );
        })}
      </div>

      {selectedScript ? (
        <ScriptWorkspace
          script={selectedScript}
          classId={classId}
          batchId={batchId}
          strand={assessmentMeta.strand}
          subStrand={assessmentMeta.subStrand}
        />
      ) : null}
    </section>
  );
}
