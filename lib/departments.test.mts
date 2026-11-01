import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";
import type { Course } from "../components/TermView";

// @ts-expect-error Native Node TS entry point.
const { departmentCodeOf, normalizeCourseCode, rollupByDepartment } = await import("./departments.ts");

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

test("normalizeCourseCode accepts course codes and rejects guesses", () => {
  assert.equal(normalizeCourseCode(" anth341 "), "ANTH 341");
  assert.equal(normalizeCourseCode("cs_101h"), "CS 101H");
  assert.equal(normalizeCourseCode(""), null);
  assert.equal(normalizeCourseCode("Anthropology"), null);
  assert.equal(normalizeCourseCode("ANTH 341 extra"), null);
});

test("combined reports group by their explicit course code while legacy filenames still work", () => {
  const combined = course("Combined syllabus (3 pieces)", []);
  combined.report = { ...combined.report, courseCode: "ANTH 341" } as typeof combined.report;
  const ordinary = course("ANTH145-Syllabus-Fall-2026.pdf", []);
  const unknown = course("Combined syllabus (2 pieces)", []);
  const unrelated = course("CS101-Syllabus.pdf", []);
  const groups = rollupByDepartment([combined, ordinary, unknown, unrelated]);
  assert.deepEqual(groups.map((g) => [g.code, g.courses.length]), [["ANTH", 2], ["CS", 1]]);
  assert.equal(combined.report.fileName, "Combined syllabus (3 pieces)");
});

test("an explicit course code overrides a misleading filename and invalid metadata retains legacy fallback", () => {
  const explicit = course("CS101-Syllabus.pdf", []);
  explicit.report.courseCode = " anth_341 ";
  const invalid = course("CS102-Syllabus.pdf", []);
  invalid.report.courseCode = "Anthropology";
  assert.deepEqual(rollupByDepartment([explicit, invalid]).map((g) => [g.code, g.courses[0].id]), [
    ["ANTH", explicit.id], ["CS", invalid.id],
  ]);
  const reloaded = JSON.parse(JSON.stringify(explicit)) as Course;
  assert.equal(reloaded.report.courseCode, " anth_341 ");
  assert.equal(rollupByDepartment([reloaded])[0].code, "ANTH");
});

test("rollupByDepartment reports no dominant characterization on a tie", () => {
  const courses = [
    course("ANTH101-A.pdf", [{ dimension: "punitive", status: "weak", characterization: "Punitive" }]),
    course("ANTH102-B.pdf", [{ dimension: "punitive", status: "strong", characterization: "Flexible" }]),
  ];
  const rollup = rollupByDepartment(courses);
  assert.equal(rollup[0].dimensions.punitive.dominant, null);
});
