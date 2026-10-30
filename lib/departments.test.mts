import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";
import type { Course } from "../components/TermView";

// @ts-expect-error Native Node TS entry point.
const { departmentCodeOf, rollupByDepartment } = await import("./departments.ts");

function course(fileName: string, dims: { dimension: string; status: string; characterization?: string }[]): Course {
  return {
    id: fileName,
    report: {
      fileName, pageCount: 1, coverage: { status: "full", skipped: [] },
      dimensions: dims.map((d) => ({ dimension: d.dimension, title: d.dimension, status: d.status, positive: 0, negative: 0, hits: [], ...(d.characterization ? { characterization: d.characterization } : {}) })) as never,
      flags: [], assessments: [], biggestRiskIndex: null,
      overall: { label: null, reason: "", included: 0, score: 0 },
      passages: [],
    } as never,
  };
}

test("departmentCodeOf extracts a leading course-code prefix from a file name", () => {
  assert.equal(departmentCodeOf("ANTH145-Syllabus-Fall-2026.pdf"), "ANTH");
  assert.equal(departmentCodeOf("ANTH341_Food_Origins_Syllabus_F26.pdf"), "ANTH");
  assert.equal(departmentCodeOf("Combined syllabus (3 pieces)"), null);
  assert.equal(departmentCodeOf("syllabus.pdf"), null);
});

test("rollupByDepartment groups courses and finds the dominant characterization per dimension", () => {
  const courses = [
    course("ANTH145-Syllabus-Fall-2026.pdf", [{ dimension: "punitive", status: "weak", characterization: "Punitive" }]),
    course("ANTH341-Food-Origins-F26.pdf", [{ dimension: "punitive", status: "weak", characterization: "Punitive" }]),
    course("CS101-Syllabus.pdf", [{ dimension: "punitive", status: "strong", characterization: "Flexible" }]),
  ];
  const rollup = rollupByDepartment(courses);
  assert.equal(rollup.length, 2);
  const anth = rollup.find((r: { code: string }) => r.code === "ANTH")!;
  assert.equal(anth.courses.length, 2);
  assert.equal(anth.dimensions.punitive.dominant, "Punitive");
  assert.equal(anth.dimensions.punitive.weak, 2);
  assert.equal(anth.dimensions.punitive.strong, 0);
});

test("rollupByDepartment reports no dominant characterization on a tie", () => {
  const courses = [
    course("ANTH101-A.pdf", [{ dimension: "punitive", status: "weak", characterization: "Punitive" }]),
    course("ANTH102-B.pdf", [{ dimension: "punitive", status: "strong", characterization: "Flexible" }]),
  ];
  const rollup = rollupByDepartment(courses);
  assert.equal(rollup[0].dimensions.punitive.dominant, null);
});
