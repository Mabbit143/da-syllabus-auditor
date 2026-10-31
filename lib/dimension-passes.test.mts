import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";

// @ts-expect-error Native Node TS entry point.
const { dimensionInstructions, runAudit } = await import("./audit.ts");

const PAGE = `COURSE POLICIES
Accommodations: contact the Accessible Education Center for a letter of accommodation.
Course grades will be based on the midterm, worth 30%, and the final, worth 70%.
All students are expected to share ideas and contribute to the learning environment.
Because this is a 3-credit course, expect 5-6 hours of work each week outside class.
Late work is not accepted under any circumstances, with no exceptions.`;

const pages = [{ pageNumber: 1, text: PAGE }];

/** Drives one audit with a model that answers per prompt, so each area's pass can be steered. */
async function run(answer: (instructions: string) => object | Error) {
  const model = async (instructions: string) => {
    const result = answer(instructions);
    if (result instanceof Error) throw result;
    return JSON.stringify({ assessments: [], signals: [], flags: [], weights: [], ...result });
  };
  return runAudit({ requestId: "t", fileName: "t.pdf", pageCount: 1, pages }, model);
}

const areaOf = (instructions: string) =>
  /ONE area: (.*?)\.?\s*$/m.exec(instructions)?.[1]?.trim() ?? null;

interface Area {
  dimension: string;
  status: string;
  positive: number;
  negative: number;
  hits: unknown[];
}

const dimension = (report: { dimensions: Area[] }, id: string): Area => {
  const found = report.dimensions.find((d) => d.dimension === id);
  assert.ok(found, `no ${id} dimension in the report`);
  return found;
};

const AREAS = ["transparency", "punitive", "accessibility", "perspectives", "hidden"] as const;

test("each area's prompt offers only that area's own codes", () => {
  const accessibility = dimensionInstructions("accessibility");
  for (const code of ["A1:", "A2:", "A3:", "A4:", "A5:", "A6:"]) assert.ok(accessibility.includes(code), `${code} missing`);
  for (const code of ["T1:", "F1:", "P1:", "H1:"]) assert.equal(accessibility.includes(code), false, `${code} leaked in`);
  assert.match(accessibility, /ONE area: Accessibility in practice/);
  assert.match(accessibility, /names how or where to get an accommodation/); // the A1 note travels with A1
});

test("the codes code decides elsewhere are never offered to the model", () => {
  for (const id of AREAS) {
    const instructions = dimensionInstructions(id);
    for (const code of ["P6:", "P7:", "T7:"]) assert.equal(instructions.includes(code), false, `${code} offered for ${id}`);
  }
});

test("each area's prompt asks for completeness rather than a first match", () => {
  assert.match(dimensionInstructions("punitive"), /Report EVERY passage/);
  assert.match(dimensionInstructions("transparency"), /states a percentage or a share of the grade/); // the T1 note
});

test("every area is graded from its own pass, with no signals in the shared pass", async () => {
  const report = await run((instructions) => {
    switch (areaOf(instructions)) {
      case "Accessibility in practice":
        return { signals: [{ code: "A1", page: 1, quote: "contact the Accessible Education Center for a letter of accommodation" }] };
      case "Punitive vs. flexible":
        return { signals: [
          { code: "F5", page: 1, quote: "Late work is not accepted under any circumstances" },
          { code: "F6", page: 1, quote: "with no exceptions" },
        ] };
      case "Hidden curriculum":
        return { signals: [{ code: "H3", page: 1, quote: "expect 5-6 hours of work each week outside class" }] };
      default:
        return {};
    }
  });
  assert.equal(dimension(report, "accessibility").status, "mixed");
  assert.equal(dimension(report, "accessibility").positive, 1);
  assert.equal(dimension(report, "punitive").status, "weak");
  assert.equal(dimension(report, "punitive").negative, 2);
  assert.equal(dimension(report, "hidden").status, "mixed");
  assert.equal(dimension(report, "transparency").status, "not_found");
});

test("a signal returned by the wrong area's pass is ignored", async () => {
  const report = await run((instructions) =>
    areaOf(instructions) === "Accessibility in practice"
      ? { signals: [{ code: "T1", page: 1, quote: "the midterm, worth 30%, and the final, worth 70%" }] }
      : {},
  );
  assert.equal(dimension(report, "transparency").positive, 0);
  assert.equal(dimension(report, "accessibility").hits.length, 0);
});

test("an area whose pass fails is not assessed rather than reported as not found", async () => {
  const report = await run((instructions) =>
    areaOf(instructions) === "Whose perspectives are in the room"
      ? new Error("model unavailable")
      : { signals: [{ code: "H3", page: 1, quote: "expect 5-6 hours of work each week outside class" }] },
  );
  assert.equal(dimension(report, "perspectives").status, "not_assessed");
  assert.equal(report.coverage.status, "partial");
  assert.ok(report.coverage.skipped.some((s: string) => /Whose perspectives are in the room could not be fully assessed/.test(s)));
  // An area that answered is still graded normally.
  assert.equal(dimension(report, "hidden").status, "mixed");
});

test("one failed area does not stop the report", async () => {
  const report = await run((instructions) => (areaOf(instructions) ? new Error("all areas down") : {}));
  assert.equal(report.dimensions.length, 5);
  for (const d of report.dimensions) assert.equal(d.status, "not_assessed");
  assert.equal(report.overall.label, null);
  assert.match(report.overall.reason, /enough verified evidence/);
});
