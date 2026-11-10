import type { Profile } from "./types";

// The minimum a funding search needs to be about this student rather than anyone.
// Major is deliberately optional: undeclared students still get a search, ranked toward
// general opportunities that are open to any major.
const REQUIRED: { key: "school" | "location"; label: string }[] = [
  { key: "school", label: "School" },
  { key: "location", label: "State or city" },
];

/** The option the Major field offers for students who have not picked a major yet. */
export const UNDECLARED_MAJOR = "Undeclared / exploring";

// Typed answers that mean "no major yet", compared after lowercasing and squashing punctuation.
const UNDECLARED_WORDS = new Set([
  "undeclared exploring", "undeclared", "undecided", "exploring", "exploratory", "none", "n a", "na", "not sure", "unsure", "tbd", "any",
]);

/** True when the major is blank or says the student has not declared one. */
export function isUndeclaredMajor(major: string | null | undefined): boolean {
  const m = (major ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return !m || UNDECLARED_WORDS.has(m);
}

/** The major a search should use: the student's major, or "" when they are undeclared. Never undefined. */
export function declaredMajor(major: string | null | undefined): string {
  return isUndeclaredMajor(major) ? "" : (major ?? "").trim();
}

/** Labels of the required profile fields that are still blank. Empty array means the profile can be searched. */
export function missingProfileFields(profile: Partial<Pick<Profile, "school" | "location">>): string[] {
  return REQUIRED.filter((f) => !(profile[f.key] ?? "").trim()).map((f) => f.label);
}
