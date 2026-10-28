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
