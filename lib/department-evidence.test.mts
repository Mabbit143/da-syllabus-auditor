import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";
import type { EvidenceRecord } from "./policy/evidence";
import type { Course } from "../components/TermView";

// @ts-expect-error Native Node TS entry point.
const { rollupByDepartment } = await import("./departments.ts");
// @ts-expect-error Native Node TS entry point.
const { evidenceForDepartment, packetEvidenceForCourses } = await import("./department-evidence.ts");
// @ts-expect-error Native Node TS entry point.
const { loadAllEvidence } = await import("./policy/evidence.ts");
// @ts-expect-error Native Node TS entry point.
const { default: nextConfig } = await import("../next.config.ts");

test("deployed packet route includes the verified department evidence corpus", () => {
  assert.ok(nextConfig.outputFileTracingIncludes?.["/api/departments/packet"]?.includes("./data/uo-policies/reviewed-ocr/**/*"));
});

const course = (fileName: string, school?: string): Course => ({
  id: fileName,
  report: { fileName, dimensions: [], ...(school ? { policyCheck: { school } } : {}) },
} as unknown as Course);

test("published department evidence matches only its department and school", async () => {
  const evidence = await loadAllEvidence();
  const groups = rollupByDepartment([
    course("ANTH145.pdf", "University of Oregon"),
    course("CS101.pdf", "University of Oregon"),
  ]);
  const anth = groups.find((r) => r.code === "ANTH")!;
  const cs = groups.find((r) => r.code === "CS")!;
  assert.ok(evidenceForDepartment(evidence, anth).some((e: EvidenceRecord) => e.topic.id === "dept_uo_anthropology"));
  assert.deepEqual(evidenceForDepartment(evidence, cs), []);
  assert.deepEqual(evidenceForDepartment(evidence, rollupByDepartment([course("ANTH101.pdf", "Another University")])[0]), []);
  assert.deepEqual(evidenceForDepartment(evidence, rollupByDepartment([course("ANTH101.pdf")])[0]), []);
  assert.ok(evidenceForDepartment(evidence, rollupByDepartment([course("ANTH101.pdf")])[0], " University of Oregon ").length > 0);
  assert.ok(evidenceForDepartment(evidence, rollupByDepartment([course("ANTH101.pdf", " university   OF Oregon ")])[0]).length > 0);
  assert.deepEqual(evidenceForDepartment(evidence, rollupByDepartment([course("ANTH101.pdf", "Another University")])[0], "University of Oregon"), []);
  assert.deepEqual(evidenceForDepartment(evidence, rollupByDepartment([course("ANTH101.pdf")])[0], "Oregon"), []);
  assert.deepEqual(evidenceForDepartment(evidence, rollupByDepartment([course("ANTH101.pdf")])[0], "UO"), []);
  const mixed = rollupByDepartment([course("ANTH101.pdf", "University of Oregon"), course("ANTH102.pdf", "Another University")])[0];
  assert.deepEqual(evidenceForDepartment(evidence, mixed, "University of Oregon"), []);
  const partlyUnknown = rollupByDepartment([course("ANTH101.pdf", "University of Oregon"), course("ANTH102.pdf")])[0];
  assert.deepEqual(evidenceForDepartment(evidence, partlyUnknown), []);
  assert.ok(evidenceForDepartment(evidence, partlyUnknown, "University of Oregon").length > 0);
});

test("evidence with no department scope cannot leak into a department rollup", () => {
  const unscoped: EvidenceRecord = {
    topic: { id: "new_topic", label: "Unscoped", description: "", syllabusComparable: false },
    quote: "An institutional quote", sourceUrl: "https://uoregon.edu", page: 1,
    reviewedAt: "2026-10-31T00:00:00Z", extractionMethod: "text",
  };
  const group = rollupByDepartment([course("ANTH145.pdf", "University of Oregon")])[0];
  assert.deepEqual(evidenceForDepartment([unscoped], group), []);
});

test("packet evidence is selected from the registered corpus for the whole department, not the submitted quote", async () => {
  const evidence = await loadAllEvidence();
  const anth = [course("ANTH145.pdf", "University of Oregon")];
  const record = evidenceForDepartment(evidence, rollupByDepartment(anth)[0])[0];
  assert.ok(record);
  const candidate = { quote: record.quote, sourceUrl: record.sourceUrl, page: record.page };
  assert.deepEqual(packetEvidenceForCourses(evidence, anth, candidate), record);
  assert.equal(packetEvidenceForCourses(evidence, [course("CS101.pdf", "University of Oregon")], candidate), null);
  assert.equal(packetEvidenceForCourses(evidence, anth, { ...candidate, quote: "An invented published quotation." }), null);
  assert.equal(packetEvidenceForCourses(evidence, anth, { ...candidate, page: candidate.page + 1 }), null);
  assert.equal(packetEvidenceForCourses(evidence, anth, { ...candidate, sourceUrl: "https://example.edu" }), null);
  assert.equal(packetEvidenceForCourses(evidence, anth, null), null);
  assert.equal(packetEvidenceForCourses(evidence, [...anth, course("CS101.pdf", "University of Oregon")], candidate), null);
  assert.equal(packetEvidenceForCourses(evidence, [...anth, course("Combined syllabus (2 pieces)", "University of Oregon")], candidate), null);
});
