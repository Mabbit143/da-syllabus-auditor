import assert from "node:assert/strict";
import { test } from "node:test";
import "../../test-support/register-typescript.mjs";

test("pair differences keep only quotes found exactly in their own document", async () => {
  // @ts-expect-error Native Node TypeScript entry point.
  const { findPairDifferences } = await import("./pairs.ts");
  const good = { explanation: "Provost allows Canvas only.", pageA: 1, quoteA: "Instructors with a syllabus created in Canvas do not need to create an additional downloadable syllabus", pageB: 1, quoteB: "Provost Long has requested that syllabi for all classes offered at UO this fall be fully digitally accessible" };
  const fakeB = { ...good, quoteB: "This sentence is not on the teaching page at all." };
  const swapped = { ...good, quoteA: "Provost Long has requested that syllabi for all classes", quoteB: "Instructors with a syllabus created in Canvas do not need" };
  const ask = async () => JSON.stringify({ differences: [good, fakeB, swapped] });
  const result = await findPairDifferences("syllabus-requirement", ask);
  assert.equal(result.differences.length, 1);
  assert.match(result.differences[0].a.url, /^https:\/\/provost\.uoregon\.edu\//);
  assert.match(result.differences[0].b.url, /^https:\/\/teaching\.uoregon\.edu\//);
  await assert.rejects(() => findPairDifferences("../etc/passwd", ask));
});
