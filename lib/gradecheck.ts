import type { Conflict } from "./agent";
import type { Page } from "./types";

const TOTAL = /\btotal\s*(?:=|:|is)?\s*(\d{2,4})\s*points\b/gi;
const SCALE_A = /\bA\s*[:=]?\s*(\d{2,4})\s*[-\u2013]\s*(\d{2,4})\s*points\b/i;

const span = (page: Page, m: RegExpMatchArray) => ({ page: page.pageNumber, start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, text: m[0] });
const overlaps = (a: Conflict["a"], b: Conflict["a"]) => a.page === b.page && a.start < b.end && b.start < a.end;

/**
 * Code, not the model, checks one thing: a stated course total in points against the top of the A row of a grading scale
 * given in points. It reports only when the text names one total and one A row and the two figures differ.
 */
export function scaleVsTotal(pages: Page[]): Conflict | null {
  const totals: { value: number; page: Page; m: RegExpMatchArray }[] = [];
  let scale: { top: number; page: Page; m: RegExpMatchArray } | null = null;
  for (const page of pages) {
    for (const m of page.text.matchAll(TOTAL)) totals.push({ value: Number(m[1]), page, m });
    const a: RegExpExecArray | null = scale ? null : SCALE_A.exec(page.text);
    if (a) scale = { top: Math.max(Number(a[1]), Number(a[2])), page, m: a };
  }
  if (!scale || totals.length === 0 || new Set(totals.map((t) => t.value)).size !== 1) return null;
  const total = totals[0];
  if (total.value === scale.top) return null;
  return {
    a: span(total.page, total.m),
    b: span(scale.page, scale.m),
    explanation: `Total is ${total.value} points, but the grading scale tops out at ${scale.top} points, so the scale does not match the total.`,
  };
}

/** Adds the code-found conflict unless the model already reported one touching the same passages. */
export function withScaleCheck(conflicts: Conflict[], pages: Page[]): Conflict[] {
  const found = scaleVsTotal(pages);
  if (!found || conflicts.some((c) => [c.a, c.b].some((s) => overlaps(s, found.a) || overlaps(s, found.b)))) return conflicts;
  return [found, ...conflicts];
}
