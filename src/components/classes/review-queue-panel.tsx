"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { previewCompetency } from "@/lib/evaluation/competency-map";
import type { ScriptReviewDto } from "@/lib/evaluation/identity";
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

type ReviewQueuePanelProps = {
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
  // Empty field keeps the stored mark — never clear on blur.
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

function QuestionRow({
  script,
  question,
  readOnly,
  updateQuestion,
  reevaluate,
}: {
  script: ScriptReviewDto;
  question: QuestionEvaluation;
  readOnly: boolean;
  updateQuestion: UpdateMutation;
  reevaluate: ReevaluateMutation;
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

    if (
      !awardedParsed.changed &&
      !maxParsed.changed &&
      !feedbackChanged
    ) {
      // Restore empty fields to stored values so UI matches DB.
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
    <li className="space-y-3 rounded-xl border border-border/80 bg-card/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Question {question.question_number}</p>
        <span
          className={cn(
            "text-xs",
            question.status === "ai_estimate"
              ? "text-amber-700"
              : "text-muted-foreground"
          )}
        >
          {statusLabel(question.status)}
        </span>
      </div>
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
        <Label htmlFor={`feedback-${question.id}`}>Feedback</Label>
        <textarea
          id={`feedback-${question.id}`}
          className="min-h-20 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
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
        description="Optional instruction for the vision grader (e.g. award method marks)."
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
    </li>
  );
}

function ScriptReviewCard({
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
  const [open, setOpen] = useState(script.status === "drafted");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const signOff = useSignOffScript(classId, batchId);
  const updateQuestion = useUpdateQuestionEvaluation(classId, batchId);
  const reevaluate = useReevaluateQuestion(classId, batchId);
  const readOnly = script.status === "signed_off";
  const totals = script.totals ?? computeScriptTotal(script.questions ?? []);
  const competency = previewCompetency({
    strand,
    subStrand,
    awarded: totals.awarded,
    max: totals.max,
  });

  return (
    <article className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-medium">
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
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide questions" : "Review questions"}
          </Button>
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
        </div>
      </div>

      {signOff.isError ? (
        <p className="mt-2 text-sm text-destructive">
          {signOff.error instanceof Error
            ? signOff.error.message
            : "Sign-off failed"}
        </p>
      ) : null}

      {open ? (
        <ul className="mt-4 space-y-3">
          {(script.questions ?? []).map((q) => (
            <QuestionRow
              key={`${q.id}-${q.status}-${q.awarded}-${q.max}-${q.feedback}`}
              script={script}
              question={q}
              readOnly={readOnly}
              updateQuestion={updateQuestion}
              reevaluate={reevaluate}
            />
          ))}
          {(script.questions ?? []).length === 0 ? (
            <li className="text-sm text-muted-foreground">
              No question drafts yet for this script.
            </li>
          ) : null}
        </ul>
      ) : null}

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
    </article>
  );
}

export function ReviewQueuePanel({
  classId,
  batchId,
  classSubject = "General",
}: ReviewQueuePanelProps) {
  const { data, isLoading, error } = useEvaluationScripts(batchId);
  const { data: assessments } = useAssessments(classId);

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

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
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
        <h2 className="text-lg font-semibold tracking-tight">Review queue</h2>
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
        <h2 className="text-lg font-semibold tracking-tight">Review queue</h2>
        <p className="text-sm text-muted-foreground">
          Edit marks and feedback, re-evaluate a single question, then sign off
          to write student results. Competency preview updates as totals change;
          durable writes happen only on sign-off.
        </p>
      </div>
      <div className="space-y-3">
        {reviewScripts.map((script) => (
          <ScriptReviewCard
            key={script.id}
            script={script}
            classId={classId}
            batchId={batchId}
            strand={assessmentMeta.strand}
            subStrand={assessmentMeta.subStrand}
          />
        ))}
      </div>
    </section>
  );
}
