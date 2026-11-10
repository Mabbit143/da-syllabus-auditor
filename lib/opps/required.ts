import type { Profile } from "./types";

// The minimum a funding search needs to be about this student rather than anyone.
const REQUIRED: { key: "major" | "school" | "location"; label: string }[] = [
  { key: "major", label: "Major" },
  { key: "school", label: "School" },
  { key: "location", label: "State or city" },
];

/** Labels of the required profile fields that are still blank. Empty array means the profile can be searched. */
export function missingProfileFields(profile: Pick<Profile, "major" | "school" | "location">): string[] {
  return REQUIRED.filter((f) => !(profile[f.key] ?? "").trim()).map((f) => f.label);
}
