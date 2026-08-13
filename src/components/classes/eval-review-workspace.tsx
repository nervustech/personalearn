"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScriptPageViewer } from "@/components/classes/script-page-viewer";
import {
  EvalProgressDot,
  evalDotStateFromScriptStatus,
} from "@/components/classes/eval-progress-dot";
import { previewCompetency } from "@/lib/evaluation/competency-map";
import type { ScriptReviewDto } from "@/lib/evaluation/identity";
import {
  asScriptPages,
  pageUrlsForQuestion,
  resolvePageNumberMode,
  reviewMarkerKind,
} from "@/lib/evaluation/page-images";
import { formatStructuredField } from "@/lib/evaluation/format-structured-field";
import { MAX_REEVAL_INSTRUCTION_CHARS } from "@/lib/evaluation/reeval-constants";
import { formatQuestionDisplayLabel } from "@/lib/evaluation/question-identity";
import { scriptReviewPath } from "@/lib/evaluation/review-routes";
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
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { EvalQueueSummaryBar } from "@/components/classes/eval-queue-summary";
import { EvalUploadGradingBanner } from "@/components/classes/eval-upload-grading-banner";
import { EvalSessionToolbar } from "@/components/classes/eval-session-toolbar";
import { useEvalScriptRealtime } from "@/lib/hooks/use-eval-script-realtime";

type EvalReviewWorkspaceProps = {
  classId: string;
  batchId: string;
  /** Display name for breadcrumb root segment. */
  classLabel?: string;
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

  const studentDisplay = formatStructuredField(
    question.student_work,
    question.student_answer
  );
  const expectedDisplay = formatStructuredField(
    question.correct_reference,
    question.expected_answer
  );
  const hasStructuredAnalysis =
    Boolean(studentDisplay) || Boolean(expectedDisplay);

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
    <div className="flex h-full flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">
            Q
            {formatQuestionDisplayLabel({
              section: question.section,
              questionNumber: question.question_number,
            })}
            <span
              className={cn(
                "ml-2 text-xs font-normal",
                question.status === "ai_estimate"
                  ? "text-amber-700"
                  : "text-muted-foreground"
              )}
            >
              {statusLabel(question.status)}
              {question.attention_status === "ATTENTION_NEEDED" ? (
                <span className="ml-1 text-amber-700">· needs review</span>
              ) : null}
              {" · "}
              {questionIndex + 1}/{questionCount}
            </span>
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 px-2"
            disabled={questionIndex <= 0}
            onClick={onPrev}
          >
            Prev
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 px-2"
            disabled={questionIndex >= questionCount - 1}
            onClick={onNext}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-1.5">
        <div className="space-y-0.5">
          <Label htmlFor={`awarded-${question.id}`} className="text-xs">
            Awarded
          </Label>
          <Input
            id={`awarded-${question.id}`}
            type="number"
            step="any"
            className="h-8"
            value={awarded}
            disabled={readOnly || updateQuestion.isPending}
            onChange={(e) => setAwarded(e.target.value)}
            onBlur={() => {
              if (!readOnly) void saveEdits();
            }}
          />
        </div>
        <span className="pb-1.5 text-sm text-muted-foreground">/</span>
        <div className="space-y-0.5">
          <Label htmlFor={`max-${question.id}`} className="text-xs">
            Max
          </Label>
          <Input
            id={`max-${question.id}`}
            type="number"
            step="any"
            className="h-8"
            value={max}
            disabled={readOnly || updateQuestion.isPending}
            onChange={(e) => setMax(e.target.value)}
            onBlur={() => {
              if (!readOnly) void saveEdits();
            }}
          />
        </div>
      </div>

      {hasStructuredAnalysis ? (
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Student
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-xs leading-snug">
              {studentDisplay || "—"}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Expected
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-xs leading-snug">
              {expectedDisplay ||
                (question.status === "ai_estimate"
                  ? "No scheme — estimate only"
                  : "—")}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          No structured analysis yet.
          {!readOnly ? " Re-evaluate to refresh." : null}
        </p>
      )}

      {question.explanation?.trim() ? (
        <div className="text-sm">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Explanation
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-xs leading-snug">
            {question.explanation.trim()}
          </p>
        </div>
      ) : null}

      <div className="space-y-0.5">
        <Label htmlFor={`feedback-${question.id}`} className="text-xs">
          Rationale
        </Label>
        <textarea
          id={`feedback-${question.id}`}
          className="min-h-16 w-full rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs leading-snug shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
          value={feedback}
          disabled={readOnly || updateQuestion.isPending}
          onChange={(e) => setFeedback(e.target.value)}
          onBlur={() => {
            if (!readOnly) void saveEdits();
          }}
        />
      </div>

      {!readOnly ? (
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7"
            disabled={updateQuestion.isPending}
            onClick={() => void saveEdits()}
          >
            {updateQuestion.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7"
            disabled={reevaluate.isPending}
            onClick={() => setReevalOpen(true)}
          >
            Re-evaluate
          </Button>
        </div>
      ) : null}

      {localError ? (
        <p className="text-xs text-destructive">{localError}</p>
      ) : null}

      <Dialog
        open={reevalOpen}
        onOpenChange={setReevalOpen}
        title={`Re-evaluate Q${formatQuestionDisplayLabel({
          section: question.section,
          questionNumber: question.question_number,
        })}`}
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

function scriptNeedsAttention(questions: QuestionEvaluation[]): boolean {
  return questions.some((q) => {
    const kind = reviewMarkerKind(q.awarded, q.max);
    return kind !== "correct" || q.status === "ai_estimate";
  });
}

export function SplitPaneScriptReview({
  script,
  classId,
  batchId,
  assessmentId,
  strand,
  subStrand,
  siblings = [],
}: {
  script: ScriptReviewDto;
  classId: string;
  batchId: string;
  assessmentId?: string | null;
  strand: string;
  subStrand: string | null;
  siblings?: {
    id: string;
    student_name: string | null;
    read_admission_number: string | null;
    status: string;
  }[];
}) {
  const router = useRouter();
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

  const siblingIndex = siblings.findIndex((s) => s.id === script.id);
  const prevSibling =
    siblingIndex > 0 ? siblings[siblingIndex - 1] : undefined;
  const nextSibling =
    siblingIndex >= 0 && siblingIndex < siblings.length - 1
      ? siblings[siblingIndex + 1]
      : undefined;

  function goToSibling(siblingId: string) {
    if (!assessmentId) return;
    router.push(scriptReviewPath(classId, assessmentId, siblingId));
  }

  const safeIndex =
    questions.length === 0
      ? 0
      : Math.min(questionIndex, questions.length - 1);
  const question = questions[safeIndex];

  const pageNumberMode = useMemo(
    () => resolvePageNumberMode(asScriptPages(script.page_order), questions),
    [script.page_order, questions]
  );

  const pages = useMemo(() => {
    if (!question) return script.pageUrls;
    return pageUrlsForQuestion(
      asScriptPages(script.page_order),
      script.pageUrls,
      question.question_number,
      question.page_number,
      pageNumberMode
    );
  }, [question, script.page_order, script.pageUrls, pageNumberMode]);

  const markerKind = reviewMarkerKind(
    question?.awarded ?? null,
    question?.max ?? null
  );
  const attentionNeeded = scriptNeedsAttention(questions);

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-2 lg:h-[calc(100dvh-7.5rem)]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold tracking-tight">
              {script.student_name ?? "Unassigned student"}
            </h3>
            {attentionNeeded ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Attention needed
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {script.read_admission_number ?? "—"} ·{" "}
            <span className="font-medium text-foreground">
              {totals.awarded ?? "—"}/{totals.max ?? "—"}
            </span>{" "}
            · {competency.status.replaceAll("_", " ")}
            {siblings.length > 1 && siblingIndex >= 0
              ? ` · student ${siblingIndex + 1}/${siblings.length}`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {siblings.length > 1 && assessmentId ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 px-2"
                disabled={!prevSibling}
                onClick={() => prevSibling && goToSibling(prevSibling.id)}
              >
                Prev student
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 px-2"
                disabled={!nextSibling}
                onClick={() => nextSibling && goToSibling(nextSibling.id)}
              >
                Next student
              </Button>
            </>
          ) : null}
          {(script.status === "ready" || script.status === "drafted") ? (
            <Button
              type="button"
              size="sm"
              className="h-7"
              disabled={!script.student_id || signOff.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              Sign off
            </Button>
          ) : (
            <span className="text-xs capitalize text-muted-foreground">
              {script.status.replaceAll("_", " ")}
            </span>
          )}
        </div>
      </header>

      {signOff.isError ? (
        <p className="shrink-0 text-xs text-destructive">
          {signOff.error instanceof Error
            ? signOff.error.message
            : "Sign-off failed"}
        </p>
      ) : null}

      {question ? (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,1fr)] lg:items-stretch">
          <ScriptPageViewer
            key={`${script.id}-${question.id}`}
            pages={pages}
            markerKind={markerKind}
            markerStatus={question.status}
            questionLabel={formatQuestionDisplayLabel({
              section: question.section,
              questionNumber: question.question_number,
            })}
            verticalBounds={question.vertical_bounds}
          />
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-card/90 shadow-sm backdrop-blur-sm">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
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
                  setQuestionIndex((i) =>
                    Math.min(questions.length - 1, i + 1)
                  )
                }
              />
            </div>
          </aside>
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
  classLabel = "Class",
  classSubject = "General",
}: EvalReviewWorkspaceProps) {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useEvaluationScripts(batchId);
  useEvalScriptRealtime(batchId);
  const { data: assessments } = useAssessments(classId);

  const assessmentMeta = useMemo(() => {
    const assessmentId = data?.batch?.assessment_id;
    if (!assessmentId || !assessments?.length) {
      return {
        id: assessmentId ?? null,
        title: "Evaluation",
        strand: classSubject,
        subStrand: null as string | null,
      };
    }
    const assessment = assessments.find((a) => a.id === assessmentId);
    const strand =
      assessment?.linked_strand?.trim() || classSubject || "General";
    return {
      id: assessmentId,
      title: assessment?.title?.trim() || "Evaluation",
      strand,
      subStrand: assessment?.linked_sub_strand ?? null,
    };
  }, [assessments, classSubject, data?.batch?.assessment_id]);

  const allScripts = data?.scripts ?? [];

  const readyScripts = useMemo(
    () =>
      allScripts.filter(
        (s) => s.status === "ready" || s.status === "drafted" || s.status === "signed_off"
      ),
    [allScripts]
  );

  const draftingInProgress = useMemo(
    () =>
      allScripts.some((s) =>
        ["identity_cleared", "queued_draft", "drafting", "parsing", "indexing", "evaluating"].includes(
          s.status
        )
      ),
    [allScripts]
  );

  const awaitingIdentity = useMemo(
    () =>
      allScripts.some(
        (s) => s.status === "pending" || s.status === "identity_amber"
      ),
    [allScripts]
  );

  function openScriptReview(script: ScriptReviewDto) {
    if (assessmentMeta.id) {
      router.push(scriptReviewPath(classId, assessmentMeta.id, script.id));
      return;
    }
    // Batches without an assessment stay on the session page (inline fallback).
    router.push(
      `/classes/${classId}/evaluations/${batchId}?script=${script.id}`
    );
  }

  const breadcrumbItems = [
    { label: classLabel, href: `/classes/${classId}` },
    { label: assessmentMeta.title },
  ];

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Breadcrumbs
          items={[
            { label: classLabel, href: `/classes/${classId}` },
            { label: "Evaluation" },
          ]}
        />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <Breadcrumbs
          items={[
            { label: classLabel, href: `/classes/${classId}` },
            { label: "Evaluation" },
          ]}
        />
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load review queue"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Breadcrumbs items={breadcrumbItems} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {assessmentMeta.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            Grading session — confirm amber identities in the panel above when
            needed, then review scripts as they turn ready.
          </p>
        </div>
        <Link
          href={`/classes/${classId}`}
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          Back to class
        </Link>
      </div>
      <EvalQueueSummaryBar scripts={allScripts} />
      <EvalUploadGradingBanner batchId={batchId} />
      <EvalSessionToolbar
        classId={classId}
        batchId={batchId}
        batchSignedOff={data?.batch?.status === "signed_off"}
        scripts={allScripts}
        pageCount={data?.pageCount ?? 0}
        isLive={data?.batch?.mode === "live"}
        onUpdated={() => {
          void refetch();
        }}
      />

      {allScripts.length === 0 && (data?.pageCount ?? 0) === 0 ? (
        <section className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
          <p className="text-sm font-medium">No pages yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use <span className="font-medium">Add pages</span> above to upload
            scans for this session.
          </p>
        </section>
      ) : allScripts.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
          <p className="text-sm font-medium">Pages uploaded</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start grading when uploads finish — scripts appear here as identity
            is matched and marks are drafted.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Students · {allScripts.length}
              {draftingInProgress ? " · grading in background" : ""}
              {awaitingIdentity ? " · confirm identity above" : ""}
            </p>
          </div>
          <ul className="divide-y divide-border">
            {allScripts.map((script) => {
              const totals =
                script.totals ?? computeScriptTotal(script.questions ?? []);
              const dot = evalDotStateFromScriptStatus(script.status);
              const canReview =
                script.status === "ready" ||
                script.status === "drafted" ||
                script.status === "signed_off";
              return (
                <li
                  key={script.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <EvalProgressDot
                      state={dot}
                      title={script.status}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {script.student_name ?? "Unassigned"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {script.read_admission_number ?? "—"}
                        {canReview
                          ? ` · ${totals.awarded ?? "—"}/${totals.max ?? "—"}`
                          : ""}
                        {script.status === "signed_off" ? " · signed off" : ""}
                        {script.status === "identity_amber"
                          ? " · needs identity"
                          : ""}
                        {["queued_draft", "drafting", "parsing", "indexing", "evaluating", "identity_cleared"].includes(
                          script.status
                        )
                          ? " · grading…"
                          : ""}
                      </p>
                    </div>
                  </div>
                  {canReview ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        script.status === "ready" || script.status === "drafted"
                          ? "primary"
                          : "secondary"
                      }
                      onClick={() => openScriptReview(script)}
                    >
                      {script.status === "signed_off"
                        ? "View review"
                        : "Open review"}
                    </Button>
                  ) : script.status === "identity_amber" &&
                    !script.alreadyEvaluated ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        document
                          .getElementById("identity-review")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      Confirm student
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {readyScripts.length === 0 && draftingInProgress ? (
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              Cleared scripts are drafting in the background. Open review as soon
              as a student turns ready — you do not have to wait for the whole
              class.
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}
