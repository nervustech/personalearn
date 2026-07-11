import { describe, expect, it } from "vitest";
import {
  groupPagesByAdmission,
  scriptHasConflict,
  scriptHasMissingPageWarning,
} from "@/lib/evaluation/group-pages";
import { normalizeAdmissionNumber } from "@/lib/evaluation/normalize-admission";
import { parseScriptPageReadJson } from "@/lib/evaluation/read-script-page";

const roster = [
  { id: "s1", admission_number: "A001", full_name: "Ada" },
  { id: "s2", admission_number: "a002", full_name: "Ben" },
];

describe("normalizeAdmissionNumber", () => {
  it("trims and uppercases", () => {
    expect(normalizeAdmissionNumber("  a001 ")).toBe("A001");
    expect(normalizeAdmissionNumber("")).toBeNull();
    expect(normalizeAdmissionNumber(null)).toBeNull();
  });
});

describe("parseScriptPageReadJson", () => {
  it("parses JSON with admission and questions", () => {
    expect(
      parseScriptPageReadJson(
        '```json\n{"admission_number":"A001","question_numbers":[2,1]}\n```'
      )
    ).toEqual({ admissionNumber: "A001", questionNumbers: [1, 2] });
  });

  it("returns empty on garbage", () => {
    expect(parseScriptPageReadJson("not json")).toEqual({
      admissionNumber: null,
      questionNumbers: [],
    });
  });
});

describe("groupPagesByAdmission", () => {
  it("groups shuffled pages by admission and orders by question number", () => {
    const drafts = groupPagesByAdmission(
      [
        {
          storagePath: "p3",
          fileName: "c.jpg",
          uploadIndex: 0,
          admissionNumber: "A002",
          questionNumbers: [2],
        },
        {
          storagePath: "p1",
          fileName: "a.jpg",
          uploadIndex: 1,
          admissionNumber: "A001",
          questionNumbers: [3],
        },
        {
          storagePath: "p2",
          fileName: "b.jpg",
          uploadIndex: 2,
          admissionNumber: "a001",
          questionNumbers: [1],
        },
      ],
      roster
    );

    expect(drafts).toHaveLength(2);
    const ada = drafts.find((d) => d.student_id === "s1")!;
    expect(ada.status).toBe("identity_cleared");
    expect(ada.match_confidence).toBe("high");
    expect(ada.page_order.map((p) => p.storagePath)).toEqual(["p2", "p1"]);
    expect(ada.missingPageWarning).toBe(true);

    const ben = drafts.find((d) => d.student_id === "s2")!;
    expect(ben.status).toBe("identity_cleared");
    expect(ben.page_order).toHaveLength(1);
  });

  it("flags amber for missing or off-roster admission", () => {
    const drafts = groupPagesByAdmission(
      [
        {
          storagePath: "x",
          fileName: "x.jpg",
          uploadIndex: 0,
          admissionNumber: null,
          questionNumbers: [1],
        },
        {
          storagePath: "y",
          fileName: "y.jpg",
          uploadIndex: 1,
          admissionNumber: "Z999",
          questionNumbers: [1],
        },
      ],
      roster
    );

    expect(drafts).toHaveLength(2);
    expect(drafts.every((d) => d.status === "identity_amber")).toBe(true);
    expect(drafts.every((d) => d.student_id === null)).toBe(true);
    expect(drafts.find((d) => d.read_admission_number === "Z999")).toBeTruthy();
  });

  it("keeps both pages on duplicate admission+question conflict", () => {
    const drafts = groupPagesByAdmission(
      [
        {
          storagePath: "a",
          fileName: "a.jpg",
          uploadIndex: 0,
          admissionNumber: "A001",
          questionNumbers: [1],
        },
        {
          storagePath: "b",
          fileName: "b.jpg",
          uploadIndex: 1,
          admissionNumber: "A001",
          questionNumbers: [1],
        },
      ],
      roster
    );

    expect(drafts).toHaveLength(1);
    const script = drafts[0]!;
    expect(script.page_order).toHaveLength(2);
    expect(script.hasConflict).toBe(true);
    expect(script.status).toBe("identity_amber");
    expect(script.student_id).toBeNull();
    expect(scriptHasConflict(script.page_order)).toBe(true);
    expect(script.page_order.every((p) => p.conflict)).toBe(true);
  });

  it("detects missing-page gaps", () => {
    const drafts = groupPagesByAdmission(
      [
        {
          storagePath: "a",
          fileName: "a.jpg",
          uploadIndex: 0,
          admissionNumber: "A001",
          questionNumbers: [1],
        },
        {
          storagePath: "b",
          fileName: "b.jpg",
          uploadIndex: 1,
          admissionNumber: "A001",
          questionNumbers: [3],
        },
      ],
      roster
    );
    expect(drafts[0]!.missingPageWarning).toBe(true);
    expect(scriptHasMissingPageWarning(drafts[0]!.page_order)).toBe(true);
  });

  it("flags byte-duplicate pages as conflict even with empty question numbers", () => {
    const drafts = groupPagesByAdmission(
      [
        {
          storagePath: "same/path.jpg",
          fileName: "a.jpg",
          uploadIndex: 0,
          admissionNumber: "A001",
          questionNumbers: [],
          contentHash: "abc123",
        },
        {
          storagePath: "same/path.jpg",
          fileName: "a-copy.jpg",
          uploadIndex: 1,
          admissionNumber: "A001",
          questionNumbers: [],
          contentHash: "abc123",
          duplicate: true,
        },
      ],
      roster
    );

    expect(drafts).toHaveLength(1);
    const script = drafts[0]!;
    expect(script.page_order).toHaveLength(2);
    expect(script.hasConflict).toBe(true);
    expect(script.status).toBe("identity_amber");
    expect(script.student_id).toBeNull();
    expect(script.page_order.every((p) => p.conflict)).toBe(true);
    expect(script.page_order[1]!.duplicate).toBe(true);
  });

  it("links byte-duplicates when one page lacks admission into one amber conflict group", () => {
    const drafts = groupPagesByAdmission(
      [
        {
          storagePath: "same/path.jpg",
          fileName: "with-id.jpg",
          uploadIndex: 0,
          admissionNumber: "A001",
          questionNumbers: [1],
          contentHash: "samehash",
        },
        {
          storagePath: "same/path.jpg",
          fileName: "no-id.jpg",
          uploadIndex: 1,
          admissionNumber: null,
          questionNumbers: [],
          contentHash: "samehash",
          duplicate: true,
        },
      ],
      roster
    );

    expect(drafts).toHaveLength(1);
    const script = drafts[0]!;
    expect(script.read_admission_number).toBe("A001");
    expect(script.page_order).toHaveLength(2);
    expect(script.hasConflict).toBe(true);
    expect(script.status).toBe("identity_amber");
    expect(script.student_id).toBeNull();
    expect(script.page_order.every((p) => p.conflict)).toBe(true);
  });

  it("groups two unmatched byte-duplicates together with conflict", () => {
    const drafts = groupPagesByAdmission(
      [
        {
          storagePath: "x.jpg",
          fileName: "a.jpg",
          uploadIndex: 0,
          admissionNumber: null,
          questionNumbers: [],
          contentHash: "orphanhash",
        },
        {
          storagePath: "x.jpg",
          fileName: "b.jpg",
          uploadIndex: 1,
          admissionNumber: null,
          questionNumbers: [],
          contentHash: "orphanhash",
          duplicate: true,
        },
      ],
      roster
    );

    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.hasConflict).toBe(true);
    expect(drafts[0]!.status).toBe("identity_amber");
    expect(drafts[0]!.page_order).toHaveLength(2);
  });
});
