import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";

test("mergePieces renumbers pages sequentially and labels each by its source", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { mergePieces } = await import("./merge.ts");
  const result = mergePieces([
    { label: "Syllabus page", pages: [{ pageNumber: 1, text: "intro" }, { pageNumber: 2, text: "policies" }] },
    { label: "Grading policy page", pages: [{ pageNumber: 1, text: "grading breakdown" }] },
  ]);
  assert.equal(result.pageCount, 3);
  assert.deepEqual(result.pages, [
    { pageNumber: 1, text: "intro", source: "Syllabus page", sourcePageNumber: 1 },
    { pageNumber: 2, text: "policies", source: "Syllabus page", sourcePageNumber: 2 },
    { pageNumber: 3, text: "grading breakdown", source: "Grading policy page", sourcePageNumber: 1 },
  ]);
  assert.deepEqual(result.sources, [
    { label: "Syllabus page", pageCount: 2 },
    { label: "Grading policy page", pageCount: 1 },
  ]);
});

test("mergePieces with a single piece reports no scattering (sources omitted)", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { mergePieces } = await import("./merge.ts");
  const result = mergePieces([{ label: "Whole syllabus", pages: [{ pageNumber: 1, text: "everything" }] }]);
  assert.equal(result.sources, undefined);
  assert.deepEqual(result.pages, [{ pageNumber: 1, text: "everything", source: "Whole syllabus", sourcePageNumber: 1 }]);
});

test("mergePieces keeps each piece's own page number, including repeated labels and non-sequential input pages", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { mergePieces } = await import("./merge.ts");
  const result = mergePieces([
    { label: "Syllabus", pages: [{ pageNumber: 4, text: "late work" }, { pageNumber: 5, text: "attendance" }] },
    { label: "Syllabus", pages: [{ pageNumber: 1, text: "pasted grading text" }] },
  ]);
  assert.deepEqual(result.pages.map((p: { pageNumber: number; source?: string; sourcePageNumber?: number }) => [p.pageNumber, p.source, p.sourcePageNumber]), [
    [1, "Syllabus", 4],
    [2, "Syllabus", 5],
    [3, "Syllabus", 1],
  ]);
});

test("mergePieces falls back to the input ordinal when a piece page has no usable number", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { mergePieces } = await import("./merge.ts");
  const result = mergePieces([
    { label: "Notes", pages: [{ pageNumber: 0, text: "first" }, { pageNumber: Number.NaN, text: "second" }] },
  ]);
  assert.deepEqual(result.pages.map((p: { sourcePageNumber?: number }) => p.sourcePageNumber), [1, 2]);
});

test("mergePieces drops empty pieces and rejects when nothing is left", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { mergePieces } = await import("./merge.ts");
  const result = mergePieces([
    { label: "Empty piece", pages: [] },
    { label: "Real piece", pages: [{ pageNumber: 1, text: "content" }] },
  ]);
  assert.equal(result.pageCount, 1);
  assert.equal(result.pages[0].source, "Real piece");
  assert.throws(() => mergePieces([{ label: "Empty", pages: [] }]), /No readable pages/);
});
