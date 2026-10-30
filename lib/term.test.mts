import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";

test("termOf buckets a date into the right UO-style quarter", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { termOf } = await import("./term.ts");
  // Built with the local Date(year, monthIndex, day) constructor, not ISO date-only strings
  // (those parse as UTC midnight and can read back as the previous local day).
  assert.deepEqual(termOf(new Date(2026, 0, 15)), { id: "2026-winter", label: "Winter 2026" });
  assert.deepEqual(termOf(new Date(2026, 3, 1)), { id: "2026-spring", label: "Spring 2026" });
  assert.deepEqual(termOf(new Date(2026, 6, 4)), { id: "2026-summer", label: "Summer 2026" });
  assert.deepEqual(termOf(new Date(2026, 9, 29)), { id: "2026-fall", label: "Fall 2026" });
  assert.deepEqual(termOf(new Date(2026, 2, 20)), { id: "2026-winter", label: "Winter 2026" });
  assert.deepEqual(termOf(new Date(2026, 2, 21)), { id: "2026-spring", label: "Spring 2026" });
});

test("previousTermId steps back one quarter, wrapping the year at winter", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { previousTermId } = await import("./term.ts");
  assert.equal(previousTermId("2026-fall"), "2026-summer");
  assert.equal(previousTermId("2026-summer"), "2026-spring");
  assert.equal(previousTermId("2026-spring"), "2026-winter");
  assert.equal(previousTermId("2026-winter"), "2025-fall");
});

test("termLabel renders a term id back to a display label", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { termLabel } = await import("./term.ts");
  assert.equal(termLabel("2026-fall"), "Fall 2026");
  assert.equal(termLabel("2025-winter"), "Winter 2025");
});
