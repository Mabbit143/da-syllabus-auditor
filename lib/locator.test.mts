import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";

// @ts-expect-error Native Node TS entry point.
const load = () => import("./locator.ts");

const combined = [
  { pageNumber: 1, text: "intro", source: "Syllabus page", sourcePageNumber: 1 },
  { pageNumber: 2, text: "policies", source: "Syllabus page", sourcePageNumber: 2 },
  { pageNumber: 3, text: "grading breakdown", source: "Grading policy page", sourcePageNumber: 1 },
];

test("an ordinary PDF page keeps the plain page locator", async () => {
  const { pageLocator } = await load();
  const pages = [{ pageNumber: 1, text: "a" }, { pageNumber: 2, text: "b" }];
  assert.equal(pageLocator(pages, 2), "page 2");
  assert.equal(pageLocator(pages, 2, { capitalize: true }), "Page 2");
});

test("a combined page names its piece, its page within the piece, and the combined page", async () => {
  const { pageLocator } = await load();
  assert.equal(pageLocator(combined, 3), "Grading policy page, page 1 (combined page 3)");
  assert.equal(pageLocator(combined, 2, { capitalize: true }), "Syllabus page, page 2 (combined page 2)");
});

test("a legacy combined page names its piece and combined page without guessing the page within the piece", async () => {
  const { pageLocator } = await load();
  const legacy = combined.map((p) => ({ pageNumber: p.pageNumber, text: p.text, source: p.source }));
  assert.equal(pageLocator(legacy, 3), "Grading policy page, combined page 3");
  // Repeated labels make the local page unknowable from grouping; it is never inferred.
  assert.equal(pageLocator(legacy, 2), "Syllabus page, combined page 2");
});

test("a single-piece document with matching numbering does not repeat the combined page", async () => {
  const { pageLocator } = await load();
  const single = [{ pageNumber: 1, text: "a", source: "Canvas syllabus", sourcePageNumber: 1 }, { pageNumber: 2, text: "b", source: "Canvas syllabus", sourcePageNumber: 2 }];
  assert.equal(pageLocator(single, 2), "Canvas syllabus, page 2");
});

test("two pieces sharing one label still show the combined page when numbering differs", async () => {
  const { pageLocator } = await load();
  const repeated = [
    { pageNumber: 1, text: "a", source: "Syllabus", sourcePageNumber: 1 },
    { pageNumber: 2, text: "b", source: "Syllabus", sourcePageNumber: 1 },
  ];
  assert.equal(pageLocator(repeated, 2), "Syllabus, page 1 (combined page 2)");
});

test("a page missing from the saved pages or with a blank label falls back to the plain page", async () => {
  const { pageLocator } = await load();
  assert.equal(pageLocator([], 4, { capitalize: true }), "Page 4");
  assert.equal(pageLocator(undefined, 4), "page 4");
  assert.equal(pageLocator([{ pageNumber: 4, text: "x", source: "   ", sourcePageNumber: 9 }], 4), "page 4");
});

test("a malformed saved local page number is ignored rather than shown", async () => {
  const { pageLocator } = await load();
  // Saved JSON is untrusted: shapes outside the type must not leak into the citation.
  const bad = [{ pageNumber: 3, text: "x", source: "Grading policy page", sourcePageNumber: -2 }, { pageNumber: 4, text: "y", source: "Other", sourcePageNumber: "2" }] as never;
  assert.equal(pageLocator(bad, 3), "Grading policy page, combined page 3");
  assert.equal(pageLocator(bad, 4), "Other, combined page 4");
});
