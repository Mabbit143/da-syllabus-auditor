import type { RequirementFlag } from "./types";

/**
 * Study level, read by code from the listing's own title and eligibility quote, so a model that
 * mis-tags a graduate-only award cannot slip it past the filter. If both levels are named, neither is required.
 */
export function levelFlags(text: string): RequirementFlag[] {
  const t = text.toLowerCase();
  const grad = /\b(graduate students?|graduate[- ]level|doctoral|ph\.?\s?d\.?|dissertation|master'?s (student|degree|program))\b/.test(t);
  const under = /\bundergraduates?\b/.test(t);
  if (grad && !under) return ["grad"];
  if (under && !grad) return ["undergrad"];
  return [];
}

const clean = (s: string) =>
  s.toLowerCase().replace(/\buniversity of\b/g, "").replace(/\buniversity\b|\bcollege\b|\binstitute\b/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** True if the student's school is one of the schools an award is limited to. */
export function schoolMatches(limitedTo: string[], studentSchool: string): boolean {
  const s = clean(studentSchool);
  if (!s) return false;
  // Same set of words, so "Oregon State University" never matches "University of Oregon".
  const words = (x: string) => [...new Set(x.split(" "))].sort().join(" ");
  return limitedTo.some((l) => {
    const c = clean(l);
    return c.length > 0 && words(c) === words(s);
  });
}
