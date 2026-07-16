import type { CompetencyProgress, Student } from "@/types/database";
import type { CompetencyStatus } from "@/lib/evaluation/competency-map";

export type SnapshotDisplayStatus = CompetencyStatus | "no_evidence";

/** Higher = worse (used for rollup + attention sort). */
export const STATUS_RANK: Record<SnapshotDisplayStatus, number> = {
  no_evidence: -1,
  mastered: 0,
  developing: 1,
  not_yet: 2,
};

export type StudentCompetencyRollup = {
  student: Student;
  status: SnapshotDisplayStatus;
  strandCount: number;
  evidenceCount: number;
  lastEvidenceAt: string | null;
  strands: CompetencyProgress[];
};

export type StrandComposition = {
  strand: string;
  mastered: number;
  developing: number;
  not_yet: number;
  total: number;
};

export type CompetencyPulse = {
  mastered: number;
  developing: number;
  not_yet: number;
  no_evidence: number;
  total: number;
};

export type CompetencySnapshot = {
  hasEvidence: boolean;
  pulse: CompetencyPulse;
  strands: StrandComposition[];
  attention: StudentCompetencyRollup[];
  roster: StudentCompetencyRollup[];
};

function worseStatus(
  a: CompetencyStatus,
  b: CompetencyStatus
): CompetencyStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

export function rollupStudentStatus(
  rows: CompetencyProgress[]
): SnapshotDisplayStatus {
  if (rows.length === 0) return "no_evidence";
  return rows.reduce<CompetencyStatus>(
    (worst, row) => worseStatus(worst, row.status),
    rows[0]!.status
  );
}

function buildRollup(
  student: Student,
  rows: CompetencyProgress[]
): StudentCompetencyRollup {
  const status = rollupStudentStatus(rows);
  let evidenceCount = 0;
  let lastEvidenceAt: string | null = null;

  for (const row of rows) {
    evidenceCount += row.evidence_count ?? 0;
    if (row.last_evidence_at) {
      if (!lastEvidenceAt || row.last_evidence_at > lastEvidenceAt) {
        lastEvidenceAt = row.last_evidence_at;
      }
    }
  }

  return {
    student,
    status,
    strandCount: rows.length,
    evidenceCount,
    lastEvidenceAt,
    strands: rows,
  };
}

function compareAttention(
  a: StudentCompetencyRollup,
  b: StudentCompetencyRollup
): number {
  const statusDiff = STATUS_RANK[b.status] - STATUS_RANK[a.status];
  if (statusDiff !== 0) return statusDiff;

  const evidenceDiff = a.evidenceCount - b.evidenceCount;
  if (evidenceDiff !== 0) return evidenceDiff;

  const aTime = a.lastEvidenceAt ?? "";
  const bTime = b.lastEvidenceAt ?? "";
  if (aTime !== bTime) return aTime < bTime ? -1 : 1;

  return a.student.full_name.localeCompare(b.student.full_name);
}

export function buildCompetencySnapshot(input: {
  students: Student[];
  competency: CompetencyProgress[];
}): CompetencySnapshot {
  const byStudent = new Map<string, CompetencyProgress[]>();
  for (const row of input.competency) {
    const list = byStudent.get(row.student_id) ?? [];
    list.push(row);
    byStudent.set(row.student_id, list);
  }

  const roster = input.students.map((student) =>
    buildRollup(student, byStudent.get(student.id) ?? [])
  );

  const pulse: CompetencyPulse = {
    mastered: 0,
    developing: 0,
    not_yet: 0,
    no_evidence: 0,
    total: roster.length,
  };
  for (const entry of roster) {
    pulse[entry.status] += 1;
  }

  const strandMap = new Map<
    string,
    { mastered: number; developing: number; not_yet: number }
  >();
  for (const row of input.competency) {
    const bucket = strandMap.get(row.strand) ?? {
      mastered: 0,
      developing: 0,
      not_yet: 0,
    };
    bucket[row.status] += 1;
    strandMap.set(row.strand, bucket);
  }

  const strands: StrandComposition[] = [...strandMap.entries()]
    .map(([strand, counts]) => {
      const total = counts.mastered + counts.developing + counts.not_yet;
      return { strand, ...counts, total };
    })
    .sort((a, b) => {
      const aNeed = a.not_yet + a.developing;
      const bNeed = b.not_yet + b.developing;
      if (bNeed !== aNeed) return bNeed - aNeed;
      return a.strand.localeCompare(b.strand);
    });

  const attention = roster
    .filter(
      (entry) => entry.status === "not_yet" || entry.status === "developing"
    )
    .sort(compareAttention);

  return {
    hasEvidence: input.competency.length > 0,
    pulse,
    strands,
    attention,
    roster,
  };
}
