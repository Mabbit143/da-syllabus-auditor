import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";

const page = (text: string) => [{ pageNumber: 1, text }];

test("a total in points that the scale's A row does not reach is a conflict", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { scaleVsTotal } = await import("./gradecheck.ts");
  const c = scaleVsTotal(page("Grading. Total = 400 points = 100%. Scale: A 100-94 points Superior work."));
  assert.ok(c);
  assert.equal(c.a.text, "Total = 400 points");
  assert.match(c.b.text, /^A 100-94 points/);
  assert.match(c.explanation, /400 points.*100 points/);
});

test("matching, percent-based or ambiguous inputs raise nothing", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { scaleVsTotal } = await import("./gradecheck.ts");
  assert.equal(scaleVsTotal(page("Total = 400 points. A 360-400 points.")), null);
  assert.equal(scaleVsTotal(page("Total = 400 points. A 94-100 percent.")), null);
  assert.equal(scaleVsTotal(page("Total = 400 points. Total = 500 points. A 100-94 points.")), null); // two totals
  assert.equal(scaleVsTotal(page("A 100-94 points.")), null); // no total
});

test("a model conflict on the same passages is not repeated", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { withScaleCheck, scaleVsTotal } = await import("./gradecheck.ts");
  const pages = page("Total = 400 points = 100%. A 100-94 points.");
  const mine = scaleVsTotal(pages)!;
  assert.equal(withScaleCheck([], pages).length, 1);
  assert.equal(withScaleCheck([{ a: mine.a, b: mine.b, explanation: "model" }], pages).length, 1);
});
