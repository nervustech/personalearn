import { describe, expect, it } from "vitest";
import type { Resource, Student } from "@/types/database";
import {
  filterResourcesByQuery,
  filterStudentsByQuery,
} from "./filter-class-lists";

const resources = [
  {
    id: "1",
    title: "Fractions Quiz",
    resource_type: "quiz",
    ai_generated: true,
  },
  {
    id: "2",
    title: "Term 2 Scheme",
    resource_type: "scheme_of_work",
    ai_generated: false,
  },
] as Resource[];

const students = [
  {
    id: "s1",
    full_name: "Jane Doe",
    admission_number: "ADM001",
    gender: "Female",
  },
  {
    id: "s2",
    full_name: "John Kamau",
    admission_number: "ADM002",
    gender: "Male",
  },
] as Student[];

describe("filterResourcesByQuery", () => {
  it("returns all resources when query is empty", () => {
    expect(filterResourcesByQuery(resources, "")).toHaveLength(2);
  });

  it("filters by title, type label, and source", () => {
    expect(filterResourcesByQuery(resources, "fractions")).toHaveLength(1);
    expect(filterResourcesByQuery(resources, "scheme")).toHaveLength(1);
    expect(filterResourcesByQuery(resources, "uploaded")).toHaveLength(1);
    expect(filterResourcesByQuery(resources, "ai")).toHaveLength(1);
  });
});

describe("filterStudentsByQuery", () => {
  it("returns all students when query is empty", () => {
    expect(filterStudentsByQuery(students, "  ")).toHaveLength(2);
  });

  it("filters by name, admission number, and gender", () => {
    expect(filterStudentsByQuery(students, "jane")).toHaveLength(1);
    expect(filterStudentsByQuery(students, "adm002")).toHaveLength(1);
    expect(filterStudentsByQuery(students, "female")).toHaveLength(1);
  });
});
