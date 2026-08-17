type ScriptLike = {
  status: string;
  alreadyEvaluated?: boolean;
};

export type IdentityPanelState = {
  hasPending: boolean;
  amberCount: number;
  blockedCount: number;
  identityClearedWaiting: number;
  inFlightCount: number;
  draftedCount: number;
  signedOffCount: number;
  needsTeacherAttention: boolean;
  needsGradingKick: boolean;
  panelVisible: boolean;
};

/**
 * Amber/unmatched/duplicates need a teacher. Uploaded pages and ready
 * scripts do not — those are the start-grading toolbar and the review queue.
 */
export function identityPanelState(
  scripts: ScriptLike[],
  options?: { processingError?: boolean }
): IdentityPanelState {
  const hasPending = scripts.some(
    (s) => s.status === "pending" || s.status === "uploaded"
  );
  const amberCount = scripts.filter(
    (s) =>
      (s.status === "identity_amber" || s.status === "unmatched") &&
      !s.alreadyEvaluated
  ).length;
  const blockedCount = scripts.filter(
    (s) =>
      Boolean(s.alreadyEvaluated) &&
      (s.status === "identity_amber" ||
        s.status === "unmatched" ||
        s.status === "pending" ||
        s.status === "uploaded")
  ).length;
  const identityClearedWaiting = scripts.filter(
    (s) => s.status === "identity_cleared"
  ).length;
  const inFlightCount = scripts.filter((s) =>
    ["queued_draft", "drafting", "parsing", "indexing", "evaluating"].includes(
      s.status
    )
  ).length;
  const draftedCount = scripts.filter(
    (s) => s.status === "ready" || s.status === "drafted"
  ).length;
  const signedOffCount = scripts.filter((s) => s.status === "signed_off").length;

  const needsTeacherAttention = amberCount > 0 || blockedCount > 0;
  const needsGradingKick =
    Boolean(options?.processingError) ||
    (identityClearedWaiting > 0 && inFlightCount === 0);

  return {
    hasPending,
    amberCount,
    blockedCount,
    identityClearedWaiting,
    inFlightCount,
    draftedCount,
    signedOffCount,
    needsTeacherAttention,
    needsGradingKick,
    panelVisible: needsTeacherAttention || needsGradingKick,
  };
}
