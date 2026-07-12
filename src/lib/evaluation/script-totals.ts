export type ScriptTotal = {
  awarded: number | null;
  max: number | null;
};

/** Sum finite awarded/max across questions; null when no finite values. */
export function computeScriptTotal(
  questions: ReadonlyArray<{ awarded: number | null; max: number | null }>
): ScriptTotal {
  let awardedSum = 0;
  let maxSum = 0;
  let hasAwarded = false;
  let hasMax = false;

  for (const q of questions) {
    if (typeof q.awarded === "number" && Number.isFinite(q.awarded)) {
      awardedSum += q.awarded;
      hasAwarded = true;
    }
    if (typeof q.max === "number" && Number.isFinite(q.max)) {
      maxSum += q.max;
      hasMax = true;
    }
  }

  return {
    awarded: hasAwarded ? awardedSum : null,
    max: hasMax ? maxSum : null,
  };
}
