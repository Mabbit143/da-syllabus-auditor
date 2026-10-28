import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";

async function a1Hits(text: string, quote: string) {
  // @ts-expect-error Native Node TS entry point.
  const { runAudit } = await import("./audit.ts");
  const model = async () => JSON.stringify({ assessments: [], flags: [], weights: [], signals: [{ code: "A1", page: 1, quote }] });
  const report = await runAudit({ requestId: "t", fileName: "t.pdf", pageCount: 1, pages: [{ pageNumber: 1, text }] }, model);
  return report.dimensions.find((d: { dimension: string }) => d.dimension === "accessibility")?.hits.length ?? -1;
}

test("an invitation to ask is not a stated accommodation process", async () => {
  const text = "If you need any accommodations, you are invited to let me know early in the term.";
  assert.equal(await a1Hits(text, text), 0);
});

test("a named office or letter counts as a stated process", async () => {
  const office = "Students with disabilities should contact the Accessible Education Center for an accommodation letter.";
  assert.equal(await a1Hits(office, office), 1);
  const aec = "Please send your AEC letter to me during the first week of class.";
  assert.equal(await a1Hits(aec, aec), 1);
});

async function report(text: string, code: string) {
  // @ts-expect-error Native Node TS entry point.
  const { runAudit } = await import("./audit.ts");
  const model = async () => JSON.stringify({ assessments: [], flags: [], weights: [], signals: [{ code, page: 1, quote: text }] });
  return runAudit({ requestId: "t", fileName: "t.pdf", pageCount: 1, pages: [{ pageNumber: 1, text }] }, model);
}

test("a statement with no named route is reported as present, not as absent", async () => {
  const text = "If you have a documented disability, you are invited to let me know and we will discuss.";
  const dim = (await report(text, "A1")).dimensions.find((d: { dimension: string }) => d.dimension === "accessibility");
  assert.equal(dim?.hits.length, 0);
  assert.match(dim?.notes?.[0] ?? "", /names no office/);
});

test("late work needs a named extension or process to count", async () => {
  const vague = "Late assignments are handled on a case-by-case basis.";
  const punitive = (r: { dimensions: { dimension: string }[] }) => r.dimensions.find((d) => d.dimension === "punitive") as unknown as { hits: unknown[]; notes?: string[] };
  const none = punitive(await report(vague, "F1"));
  assert.equal(none.hits.length, 0);
  assert.match(none.notes?.[0] ?? "", /names no extension/);
  const named = "Late work is accepted with a 2 day extension if you email me before the deadline.";
  assert.equal(punitive(await report(named, "F1")).hits.length, 1);
});

test("an accommodation statement the model missed is not reported as absent", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { runAudit } = await import("./audit.ts");
  const model = async () => JSON.stringify({ assessments: [], flags: [], weights: [], signals: [] });
  const text = "Students with disabilities should contact the Accessible Education Center.";
  const r = await runAudit({ requestId: "t", fileName: "t.pdf", pageCount: 1, pages: [{ pageNumber: 1, text }] }, model);
  const dim = r.dimensions.find((d: { dimension: string }) => d.dimension === "accessibility");
  assert.equal(dim?.status, "not_assessed");
  const none = await runAudit({ requestId: "t", fileName: "t.pdf", pageCount: 1, pages: [{ pageNumber: 1, text: "Grading is by exams." }] }, model);
  assert.equal(none.dimensions.find((d: { dimension: string }) => d.dimension === "accessibility")?.status, "not_found");
});
