export type CompetencyStatus = "mastered" | "developing" | "not_yet";

export type CompetencyPreview = {
  strand: string;
  sub_strand: string | null;
  status: CompetencyStatus;
  ratio: number | null;
};

/** Map score ratio to CBC-style competency status. */
export function statusFromRatio(
  awarded: number | null,
  max: number | null
): CompetencyStatus {
  if (
    typeof awarded !== "number" ||
    !Number.isFinite(awarded) ||
    typeof max !== "number" ||
    !Number.isFinite(max) ||
    max <= 0
  ) {
    return "not_yet";
  }
  const ratio = awarded / max;
  if (ratio >= 0.8) return "mastered";
  if (ratio >= 0.5) return "developing";
  return "not_yet";
}

export function previewCompetency(input: {
  strand: string;
  subStrand?: string | null;
  awarded: number | null;
  max: number | null;
}): CompetencyPreview {
  const awarded = input.awarded;
  const max = input.max;
  let ratio: number | null = null;
  if (
    typeof awarded === "number" &&
    Number.isFinite(awarded) &&
    typeof max === "number" &&
    Number.isFinite(max) &&
    max > 0
  ) {
    ratio = awarded / max;
  }

  return {
    strand: input.strand,
    sub_strand: input.subStrand ?? null,
    status: statusFromRatio(awarded, max),
    ratio,
  };
}
