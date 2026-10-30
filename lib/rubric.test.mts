import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";
import type { DimensionResult } from "./types";

// @ts-expect-error Native Node TS entry point.
const { characterizeDimension, overallRead } = await import("./rubric.ts");

test("characterizeDimension names weak/strong plainly, per dimension", () => {
  assert.equal(characterizeDimension("punitive", "weak"), "Punitive");
  assert.equal(characterizeDimension("punitive", "strong"), "Flexible");
  assert.equal(characterizeDimension("perspectives", "weak"), "Single-tradition");
  assert.equal(characterizeDimension("perspectives", "strong"), "Pluralistic");
  assert.equal(characterizeDimension("transparency", "weak"), "Opaque");
  assert.equal(characterizeDimension("accessibility", "weak"), "Exclusionary");
  assert.equal(characterizeDimension("hidden", "weak"), "Discretionary");
});

test("characterizeDimension stays silent on mixed/not_found/not_assessed", () => {
  assert.equal(characterizeDimension("punitive", "mixed"), undefined);
  assert.equal(characterizeDimension("punitive", "not_found"), undefined);
  assert.equal(characterizeDimension("punitive", "not_assessed"), undefined);
});

function dim(dimension: DimensionResult["dimension"], status: DimensionResult["status"], characterization?: string): DimensionResult {
  return { dimension, title: dimension, status, positive: status === "strong" ? 2 : 0, negative: status === "weak" ? 2 : 0, hits: [], ...(characterization ? { characterization } : {}) };
}

test("overallRead builds a plain characterization line from weak+strong dimensions, never invents one from mixed/absent dimensions", () => {
  const overall = overallRead([
    dim("transparency", "weak", "Opaque"),
    dim("punitive", "weak", "Punitive"),
    dim("accessibility", "strong", "Accessible"),
    dim("perspectives", "mixed"),
    dim("hidden", "not_assessed"),
  ]);
  assert.ok(overall.characterization, "expected a characterization line");
  assert.match(overall.characterization!, /Opaque, Punitive on the areas graded weak/);
  assert.match(overall.characterization!, /Accessible on the area graded strong/);
});

test("overallRead omits characterization entirely when fewer than 3 dimensions are included", () => {
  const overall = overallRead([
    dim("transparency", "weak", "Opaque"),
    dim("punitive", "mixed"),
    dim("accessibility", "not_assessed"),
  ]);
  assert.equal(overall.label, null);
  assert.equal(overall.characterization, undefined);
});
