import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";
import type { DimensionResult } from "./types";
// @ts-expect-error Native Node TS entry point.
const { areaStatus, AREA_LABELS } = await import("./report-presentation.ts");

function area(overrides: Partial<DimensionResult> = {}): DimensionResult {
  return {
    dimension: "punitive",
    title: "Punitive vs. flexible",
    status: "mixed",
    positive: 0,
    negative: 1,
    hits: [],
    ...overrides,
  };
}

test("uses a student-facing area name", () => {
  assert.equal(AREA_LABELS.punitive, "Late work and missed class");
});

test("one negative finding is limited evidence, not a strong verdict", () => {
  assert.equal(areaStatus(area()), "We found too little to draw a clear conclusion.");
});

test("opposing findings remain unresolved", () => {
  assert.equal(areaStatus(area({ positive: 1 })), "The wording points in different directions.");
});

test("unconfirmed related wording is not called absent", () => {
  assert.equal(
    areaStatus(area({ status: "not_found", notes: ["Related text present"] })),
    "We found related wording, but could not confirm this.",
  );
});

test("not checked is not missing", () => {
  assert.equal(areaStatus(area({ status: "not_assessed" })), "We could not check this area.");
});

test("not found without notes is absent", () => {
  assert.equal(areaStatus(area({ status: "not_found", notes: [] })), "We did not find this in the syllabus.");
});

test("all five area labels are plain language", () => {
  assert.equal(AREA_LABELS.transparency, "Grades, dates, and expectations");
  assert.equal(AREA_LABELS.accessibility, "Getting support and accessing materials");
  assert.equal(AREA_LABELS.perspectives, "Whose ideas and experiences are included");
  assert.equal(AREA_LABELS.hidden, "Expectations you should not have to guess");
});
