import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";

test("weightSum judges only what verified", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { weightSum } = await import("./rubric.ts");
  const p = (what: string, percent: number) => ({ what, percent });
  assert.deepEqual(weightSum([p("Midterm", 40), p("Final", 60)], false), { sum: 100, reaches100: true });
  assert.deepEqual(weightSum([p("Midterm", 40), p("Final", 50)], false), { sum: 90, reaches100: false });
  assert.equal(weightSum([p("A", 33.3), p("B", 33.3), p("C", 33.3)], false)?.reaches100, true);
  assert.equal(weightSum([p("Midterm", 40), p("Final", 60)], true), null); // a component failed verification
  assert.equal(weightSum([p("Final", 60)], false), null); // one component cannot be summed
  assert.deepEqual(weightSum([p("Quizzes", 20), p("quizzes", 20), p("Final", 60)], false), { sum: 80, reaches100: false }); // listed twice, counted once
  assert.equal(weightSum([p("Quizzes", 20), p("Quizzes", 30), p("Final", 50)], false), null); // two figures for one name
});

const page = (text: string) => [{ pageNumber: 1, text }];

async function run(text: string, weights: object[]) {
  // @ts-expect-error Native Node TS entry point.
  const { runAudit } = await import("./audit.ts");
  const model = async () => JSON.stringify({ assessments: [], signals: [], flags: [], weights });
  return runAudit({ requestId: "t", fileName: "t.pdf", pageCount: 1, pages: page(text) }, model);
}

const GRADES = "Grading: Midterm exam 30%. Final exam 40%. Quizzes 20%. Total 100%.";
const w = (what: string, percent: number | null, quote: string) => ({ what, percent, page: 1, quote });

test("weights that do not reach 100% become one flag citing every component", async () => {
  const report = await run(GRADES, [
    w("Midterm", 30, "Midterm exam 30%."), w("Final", 40, "Final exam 40%."), w("Quizzes", 20, "Quizzes 20%."), w("Total", 100, "Total 100%."),
  ]);
  const flag = report.flags.find((f: { passageIds?: string[] }) => f.passageIds);
  assert.ok(flag);
  assert.match(flag.explanation, /add up to 90%/);
  assert.equal(flag.passageIds?.length, 3);
});

test("weights that reach 100% raise nothing", async () => {
  const report = await run("Midterm exam 40%. Final exam 60%.", [w("Midterm", 40, "Midterm exam 40%."), w("Final", 60, "Final exam 60%.")]);
  assert.equal(report.flags.length, 0);
});

test("an unverifiable component stops the sum instead of guessing", async () => {
  const report = await run(GRADES, [w("Midterm", 30, "Midterm exam 30%."), w("Final", 40, "Final exam 40%."), w("Project", 10, "Project is worth 10%.")]);
  assert.equal(report.flags.length, 0);
});

test("points, ranges and extra credit stop the sum", async () => {
  const text = "Midterm exam 30%. Final exam 40%. Quizzes 10-20%. Extra credit 5%.";
  for (const extra of [w("Quizzes", 20, "Quizzes 10-20%."), w("Bonus", 5, "Extra credit 5%.")]) {
    const report = await run(text, [w("Midterm", 30, "Midterm exam 30%."), w("Final", 40, "Final exam 40%."), extra]);
    assert.equal(report.flags.length, 0);
  }
});
