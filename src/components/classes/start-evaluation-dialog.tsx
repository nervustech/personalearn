"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { useResources } from "@/lib/hooks/use-resources";
import {
  useAssessments,
  useCreateEvaluationBatch,
  useEvaluationBatches,
  useEvaluateLive,
  useProcessEvaluationIdentity,
  useUploadEvaluationPages,
} from "@/lib/hooks/use-evaluation";
import { isOpenEvaluationBatchStatus } from "@/lib/evaluation/batch-stage";
import { compressEvalScanImages } from "@/lib/evaluation/compress-eval-image";
import { isGradableResourceType } from "@/lib/evaluation/gradable";
import { RESOURCE_TYPE_LABELS } from "@/lib/resources/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type StartEvaluationDialogProps = {
  classId: string;
  /** N=1 scope (PSL-48). */
  studentId?: string;
  studentName?: string;
  /** Lock assessment picker when starting from a profile row. */
  preselectedAssessmentId?: string;
  /** Controlled open (profile-driven). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the class-page trigger button. */
  hideTrigger?: boolean;
};

type SchemeMode = "attach" | "generate" | "none";

export function StartEvaluationDialog({
  classId,
  studentId,
  studentName,
  preselectedAssessmentId,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: StartEvaluationDialogProps) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  function setOpen(next: boolean) {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  const [step, setStep] = useState(0);
  const [assessmentId, setAssessmentId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [schemeMode, setSchemeMode] = useState<SchemeMode>("attach");
  const [markingSchemeResourceId, setMarkingSchemeResourceId] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [createdBatchId, setCreatedBatchId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [compressing, setCompressing] = useState(false);

  const { data: assessments } = useAssessments(classId);
  const { data: batches } = useEvaluationBatches(classId);
  const { data: resources } = useResources(classId);
  const createBatch = useCreateEvaluationBatch(classId);
  const uploadPages = useUploadEvaluationPages(classId);
  const startBatch = useProcessEvaluationIdentity(classId);
  const evaluateLive = useEvaluateLive(classId);

  const lockedAssessment = Boolean(preselectedAssessmentId);
  const isN1 = Boolean(studentId);

  const markingSchemes = useMemo(
    () =>
      (resources ?? []).filter((r) => r.resource_type === "marking_scheme"),
    [resources]
  );

  const gradableResources = useMemo(
    () =>
      (resources ?? []).filter(
        (r) =>
          r.resource_type &&
          isGradableResourceType(r.resource_type) &&
          !(assessments ?? []).some((a) => a.resource_id === r.id)
      ),
    [resources, assessments]
  );

  const pending =
    createBatch.isPending ||
    uploadPages.isPending ||
    startBatch.isPending ||
    evaluateLive.isPending ||
    compressing;

  function resetForm() {
    setStep(0);
    setAssessmentId(preselectedAssessmentId ?? "");
    setResourceId("");
    setSchemeMode("attach");
    setMarkingSchemeResourceId("");
    setSelectedFiles([]);
    setCreatedBatchId(null);
    setFormError(null);
    setUploadWarnings([]);
    createBatch.reset();
    uploadPages.reset();
    startBatch.reset();
    evaluateLive.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  useEffect(() => {
    if (open && preselectedAssessmentId) {
      setAssessmentId(preselectedAssessmentId);
      setResourceId("");
    }
  }, [open, preselectedAssessmentId]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  const openBatchForAssessment = useMemo(() => {
    if (!assessmentId) return null;
    return (
      (batches ?? []).find(
        (b) =>
          b.assessment_id === assessmentId &&
          isOpenEvaluationBatchStatus(b.status)
      ) ?? null
    );
  }, [assessmentId, batches]);

  async function resumeOpenBatch(batchId: string) {
    handleOpenChange(false);
    router.push(`/classes/${classId}/evaluations/${batchId}`);
  }

  async function continueOpenSession(batchId: string) {
    const scriptsRes = await fetch(
      `/api/evaluation-batches/${encodeURIComponent(batchId)}/scripts`
    );
    const scriptsPayload = (await scriptsRes.json()) as {
      scripts?: unknown[];
    };
    const hasScripts =
      scriptsRes.ok && (scriptsPayload.scripts?.length ?? 0) > 0;
    if (hasScripts) {
      await resumeOpenBatch(batchId);
      return;
    }
    setCreatedBatchId(batchId);
    setStep(1);
  }

  async function handleCreateBatch() {
    setFormError(null);
    if (!assessmentId && !resourceId) {
      setFormError("Select an assessment or a gradable resource.");
      return;
    }

    if (openBatchForAssessment) {
      await continueOpenSession(openBatchForAssessment.id);
      return;
    }

    if (schemeMode === "generate") {
      setFormError(
        "Generate and save a marking scheme in AI Hub first, then attach it here."
      );
      return;
    }
    if (schemeMode === "attach" && !markingSchemeResourceId) {
      setFormError("Select a marking scheme, or proceed without one.");
      return;
    }

    try {
      const { batch, reused } = await createBatch.mutateAsync({
        assessmentId: assessmentId || null,
        resourceId: assessmentId ? null : resourceId || null,
        markingSchemeResourceId:
          schemeMode === "attach" ? markingSchemeResourceId : null,
        proceedWithoutScheme: schemeMode === "none",
        studentId: studentId ?? null,
      });
      setCreatedBatchId(batch.id);

      if (reused && isOpenEvaluationBatchStatus(batch.status)) {
        const scriptsRes = await fetch(
          `/api/evaluation-batches/${encodeURIComponent(batch.id)}/scripts`
        );
        const scriptsPayload = (await scriptsRes.json()) as {
          scripts?: unknown[];
        };
        const hasScripts =
          scriptsRes.ok && (scriptsPayload.scripts?.length ?? 0) > 0;

        if (hasScripts) {
          await resumeOpenBatch(batch.id);
          return;
        }

        // Empty open batch — continue to upload step.
        setStep(1);
        return;
      }

      setStep(1);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not start evaluation"
      );
    }
  }

  async function handleUpload() {
    setFormError(null);
    setUploadWarnings([]);
    if (!createdBatchId || !selectedFiles.length) {
      setFormError("Choose at least one scan image.");
      return;
    }

    const batchId = createdBatchId;
    try {
      setCompressing(true);
      const files = await compressEvalScanImages(selectedFiles);
      setCompressing(false);
      const uploadResult = await uploadPages.mutateAsync({
        batchId,
        files,
      });
      const warnings = (uploadResult.warnings ?? []).map((w) => w.message);
      if (warnings.length) setUploadWarnings(warnings);

      if (uploadResult.skippedAll) {
        handleOpenChange(false);
        router.push(`/classes/${classId}/evaluations/${batchId}`);
        return;
      }

      // New pages on an existing session — only process pending scripts.
      if (!(uploadResult.skippedAll ?? false)) {
        const scriptId = (uploadResult as { scriptId?: string }).scriptId;
        if (isN1 && scriptId) {
          await evaluateLive.mutateAsync({ batchId, scriptId });
        } else {
          await startBatch.mutateAsync(batchId);
        }
      }

      handleOpenChange(false);
      router.push(`/classes/${classId}/evaluations/${batchId}`);
    } catch (error) {
      setCompressing(false);
      setFormError(
        error instanceof Error ? error.message : "Upload or identity failed"
      );
    }
  }

  const dialogTitle =
    isN1 && studentName
      ? `Evaluate ${studentName}`
      : isN1
        ? "Evaluate student"
        : "Start evaluation";

  const dialogDescription = isN1
    ? "Confirm the marking scheme, then upload this student’s scanned pages."
    : "Pick an assessment and marking scheme, then upload scanned script images.";

  const lockedAssessmentTitle =
    assessments?.find((a) => a.id === assessmentId)?.title ?? "Assessment";

  return (
    <>
      {!hideTrigger ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
          Start evaluation
        </Button>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
        title={dialogTitle}
        description={dialogDescription}
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Step {step + 1} of 2
          </p>

          {step === 0 ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="eval-assessment">Assessment</Label>
                {lockedAssessment ? (
                  <p
                    id="eval-assessment"
                    className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
                  >
                    {lockedAssessmentTitle}
                  </p>
                ) : (
                  <Select
                    id="eval-assessment"
                    value={assessmentId}
                    onChange={(event) => {
                      setAssessmentId(event.target.value);
                      if (event.target.value) setResourceId("");
                    }}
                  >
                    <option value="">Select an assessment…</option>
                    {(assessments ?? []).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              {!lockedAssessment && !assessmentId && gradableResources.length > 0 ? (
                <div className="space-y-1.5">
                  <Label htmlFor="eval-resource">
                    Or create from class resource
                  </Label>
                  <Select
                    id="eval-resource"
                    value={resourceId}
                    onChange={(event) => setResourceId(event.target.value)}
                  >
                    <option value="">Select a resource…</option>
                    {gradableResources.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                        {r.resource_type
                          ? ` (${RESOURCE_TYPE_LABELS[r.resource_type]})`
                          : ""}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}

              {openBatchForAssessment ? (
                <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm">
                  <p className="font-medium text-indigo-950 dark:text-indigo-100">
                    Open session for this assessment
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Continue where you left off — confirm identity, grading, or
                    review. No need to re-select a marking scheme.
                  </p>
                </div>
              ) : (
                <>
              <div className="space-y-1.5">
                <Label htmlFor="eval-scheme-mode">Marking scheme</Label>
                <Select
                  id="eval-scheme-mode"
                  value={schemeMode}
                  onChange={(event) =>
                    setSchemeMode(event.target.value as SchemeMode)
                  }
                >
                  <option value="attach">Attach existing scheme</option>
                  <option value="generate">Generate one in AI Hub</option>
                  <option value="none">Proceed without a scheme</option>
                </Select>
              </div>

              {schemeMode === "attach" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="eval-scheme">Scheme resource</Label>
                  <Select
                    id="eval-scheme"
                    value={markingSchemeResourceId}
                    onChange={(event) =>
                      setMarkingSchemeResourceId(event.target.value)
                    }
                  >
                    <option value="">Select a marking scheme…</option>
                    {markingSchemes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </Select>
                  {markingSchemes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No marking schemes in this class yet. Generate one in AI
                      Hub, or proceed without a scheme.
                    </p>
                  ) : null}
                </div>
              ) : schemeMode === "generate" ? (
                <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  Open{" "}
                  <a
                    href="/ai-hub"
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    AI Hub
                  </a>
                  , ask the assistant to generate a marking scheme, confirm
                  save, then return here and attach the new scheme.
                </p>
              ) : (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                  AI will grade using its own judgment, which is less reliable.
                  All resulting marks will be flagged as AI estimates.
                </p>
              )}
                </>
              )}

              {formError ? (
                <p className="text-sm text-destructive">{formError}</p>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={pending || schemeMode === "generate"}
                  onClick={handleCreateBatch}
                >
                  {createBatch.isPending
                    ? "Starting…"
                    : openBatchForAssessment
                      ? "Continue session"
                      : "Next: upload scans"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {isN1
                  ? "Upload this student’s scanned pages as JPEG or PNG (any order). Large phone photos are resized in the browser first."
                  : "Upload scanned script pages as JPEG or PNG (any order). Large phone photos are resized first. After upload we match admission numbers, grade cleared scripts in the background, and open the session queue — you choose when to review each student."}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="eval-files">Scan images</Label>
                <input
                  ref={fileInputRef}
                  id="eval-files"
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium"
                  disabled={pending}
                  onChange={(event) => {
                    setSelectedFiles(Array.from(event.target.files ?? []));
                    setFormError(null);
                    setUploadWarnings([]);
                  }}
                />
                {selectedFiles.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedFiles.length} file
                    {selectedFiles.length === 1 ? "" : "s"} selected
                  </p>
                ) : null}
              </div>

              {uploadWarnings.length > 0 ? (
                <ul className="space-y-1 text-sm text-amber-900 dark:text-amber-100">
                  {uploadWarnings.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              ) : null}

              {formError ? (
                <p className="text-sm text-destructive">{formError}</p>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setStep(0)}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={pending || selectedFiles.length === 0}
                  onClick={handleUpload}
                >
                  {compressing
                    ? "Preparing images…"
                    : uploadPages.isPending
                      ? "Uploading…"
                      : startBatch.isPending || evaluateLive.isPending
                        ? isN1
                          ? "Grading…"
                          : "Starting batch…"
                        : "Upload & open session"}
                </Button>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </>
  );
}
