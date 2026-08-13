import { describe, expect, it } from "vitest";
import type { CompetencyProgress, Student } from "@/types/database";
import {
  buildCompetencySnapshot,
  rollupStudentStatus,
} from "./competency-snapshot";

function student(
  overrides: Partial<Student> & Pick<Student, "id" | "full_name">
): Student {
  return {
    class_id: "class-1",
    admission_number: overrides.admission_number ?? null,
    gender: null,
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function progress(
  overrides: Partial<CompetencyProgress> &
    Pick<CompetencyProgress, "student_id" | "strand" | "status">
): CompetencyProgress {
  return {
    id: overrides.id ?? `${overrides.student_id}-${overrides.strand}`,
    class_id: "class-1",
    sub_strand: null,
    competency_code: null,
    last_evidence_at: overrides.last_evidence_at ?? "2026-07-01T00:00:00.000Z",
    evidence_count: overrides.evidence_count ?? 1,
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("rollupStudentStatus", () => {
  it("returns no_evidence when there are no rows", () => {
    expect(rollupStudentStatus([])).toBe("no_evidence");
  });

  it("picks the worst status across strands", () => {
    expect(
      rollupStudentStatus([
        progress({
          student_id: "s1",
          strand: "Numbers",
          status: "mastered",
        }),
        progress({
          student_id: "s1",
          strand: "Measurement",
          status: "not_yet",
        }),
      ])
    ).toBe("not_yet");
  });
});

describe("buildCompetencySnapshot", () => {
  const alice = student({ id: "s1", full_name: "Alice", admission_number: "A1" });
  const bob = student({ id: "s2", full_name: "Bob", admission_number: "B2" });
  const cara = student({ id: "s3", full_name: "Cara", admission_number: "C3" });

  it("returns empty pulse and no evidence for an empty class", () => {
    const snapshot = buildCompetencySnapshot({ students: [], competency: [] });
    expect(snapshot.hasEvidence).toBe(false);
    expect(snapshot.pulse).toEqual({
      mastered: 0,
      developing: 0,
      not_yet: 0,
      no_evidence: 0,
      total: 0,
    });
    expect(snapshot.roster).toEqual([]);
    expect(snapshot.attention).toEqual([]);
    expect(snapshot.strands).toEqual([]);
  });

  it("marks all students as no_evidence when competency is empty", () => {
    const snapshot = buildCompetencySnapshot({
      students: [alice, bob],
      competency: [],
    });
    expect(snapshot.hasEvidence).toBe(false);
    expect(snapshot.pulse.no_evidence).toBe(2);
    expect(snapshot.roster).toHaveLength(2);
    expect(snapshot.roster.every((r) => r.status === "no_evidence")).toBe(true);
    expect(snapshot.attention).toEqual([]);
  });

  it("builds pulse, strands, attention, and full roster for mixed evidence", () => {
    const snapshot = buildCompetencySnapshot({
      students: [alice, bob, cara],
      competency: [
        progress({
          student_id: "s1",
          strand: "Numbers",
          status: "mastered",
          evidence_count: 2,
        }),
        progress({
          student_id: "s1",
          strand: "Geometry",
          status: "developing",
          evidence_count: 1,
          last_evidence_at: "2026-07-10T00:00:00.000Z",
        }),
        progress({
          student_id: "s2",
          strand: "Numbers",
          status: "not_yet",
          evidence_count: 1,
          last_evidence_at: "2026-07-05T00:00:00.000Z",
        }),
      ],
    });

    expect(snapshot.hasEvidence).toBe(true);
    expect(snapshot.pulse).toEqual({
      mastered: 0,
      developing: 1,
      not_yet: 1,
      no_evidence: 1,
      total: 3,
    });
    expect(snapshot.roster).toHaveLength(3);

    const aliceRollup = snapshot.roster.find((r) => r.student.id === "s1");
    expect(aliceRollup?.status).toBe("developing");
    expect(aliceRollup?.strandCount).toBe(2);

    // Equal need → alphabetical; Numbers has 1 not_yet, Geometry has 1 developing.
    expect(snapshot.strands.map((s) => s.strand)).toEqual([
      "Geometry",
      "Numbers",
    ]);
    expect(snapshot.strands.find((s) => s.strand === "Numbers")).toMatchObject({
      mastered: 1,
      developing: 0,
      not_yet: 1,
      total: 2,
    });

    expect(snapshot.attention.map((a) => a.student.id)).toEqual(["s2", "s1"]);
    expect(
      snapshot.attention.every(
        (a) => a.status === "not_yet" || a.status === "developing"
      )
    ).toBe(true);
  });

  it("orders attention by worse status, then thinner then older evidence", () => {
    const snapshot = buildCompetencySnapshot({
      students: [alice, bob, cara],
      competency: [
        progress({
          student_id: "s1",
          strand: "Numbers",
          status: "developing",
          evidence_count: 3,
          last_evidence_at: "2026-07-12T00:00:00.000Z",
        }),
        progress({
          student_id: "s2",
          strand: "Numbers",
          status: "developing",
          evidence_count: 1,
          last_evidence_at: "2026-07-12T00:00:00.000Z",
        }),
        progress({
          student_id: "s3",
          strand: "Numbers",
          status: "not_yet",
          evidence_count: 5,
          last_evidence_at: "2026-07-01T00:00:00.000Z",
        }),
      ],
    });

    expect(snapshot.attention.map((a) => a.student.id)).toEqual([
      "s3",
      "s2",
      "s1",
    ]);
  });
});
