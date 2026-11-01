import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";

const entry = (instructor: string | null) => ({ instructor, syllabusQuote: "q", syllabusPage: 1, schoolQuote: "s", schoolUrl: "https://provost.uoregon.edu/x", at: "2026-10-28T00:00:00Z" });
const group = (topic: string, kind: string, entries: ReturnType<typeof entry>[], flagged = false) => ({ school: "university of oregon", topic, kind, syllabi: entries.length, flagged, entries });

test("only agreed differences are recorded: matches and disputed topics are dropped", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { agreedGaps } = await import("./gaps.ts");
  const items = ["matches", "conflicts", "adds_requirement", "silent", "disputed"].map((relation) => ({ relation }));
  assert.deepEqual(agreedGaps(items as never).map((i: { relation: string }) => i.relation), ["conflicts", "adds_requirement", "silent"]);
});

test("the instructor view counts distinct syllabi per topic and keeps unnamed instructors apart", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { byInstructor } = await import("./gaps.ts");
  const rows = byInstructor([
    group("attendance", "conflicts", [entry("A. Smith"), entry("A. Smith"), entry(null)]),
    group("late_work", "silent", [entry("A. Smith")], true),
  ] as never);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].instructor, "A. Smith");
  assert.deepEqual(rows[0].items.map((i: { topic: string; syllabi: number }) => [i.topic, i.syllabi]), [["attendance", 2], ["late_work", 1]]);
  assert.equal(rows[1].instructor, null);
});

test("an instructor with one syllabus is not labeled as flagged by the school-wide count", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { byInstructor } = await import("./gaps.ts");
  const school = [entry("A. Smith"), entry("B. Jones"), entry("B. Jones"), entry("C. Lee"), entry("D. Park")];
  const rows = byInstructor([group("attendance", "conflicts", school, true)] as never);
  const smith = rows.find((r: { instructor: string | null }) => r.instructor === "A. Smith")!;
  assert.equal(smith.items[0].syllabi, 1);
  assert.equal("flagged" in smith.items[0], false);
  assert.equal(smith.items[0].schoolGroupFlagged, true);
});
