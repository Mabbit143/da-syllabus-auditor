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
    { pageNumber: 1, text: "intro", source: "Syllabus page" },
    { pageNumber: 2, text: "policies", source: "Syllabus page" },
    { pageNumber: 3, text: "grading breakdown", source: "Grading policy page" },
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
  assert.deepEqual(result.pages, [{ pageNumber: 1, text: "everything", source: "Whole syllabus" }]);
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
