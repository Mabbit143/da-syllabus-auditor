import type { GapGroup } from "./cloud";
import type { PolicyComparison } from "./policy/types";

/** Only agreed differences reach the master list; a match or a disputed topic is never recorded. */
export const agreedGaps = (items: PolicyComparison[]) => items.filter((i) => i.relation !== "matches" && i.relation !== "disputed");

export interface InstructorRow {
  school: string;
  instructor: string | null;
  items: { topic: GapGroup["topic"]; kind: GapGroup["kind"]; syllabi: number; flagged: boolean }[];
}

/** The same master list, regrouped by instructor. Each entry is one syllabus, so counts are distinct syllabi. */
export function byInstructor(groups: GapGroup[]): InstructorRow[] {
  const rows = new Map<string, InstructorRow>();
  for (const g of groups) {
    for (const e of g.entries) {
      const key = `${g.school}|${e.instructor ?? ""}`;
      const row = rows.get(key) ?? { school: g.school, instructor: e.instructor, items: [] };
      const item = row.items.find((i) => i.topic === g.topic && i.kind === g.kind);
      if (item) item.syllabi += 1;
      else row.items.push({ topic: g.topic, kind: g.kind, syllabi: 1, flagged: g.flagged });
      rows.set(key, row);
    }
  }
  const total = (r: InstructorRow) => r.items.reduce((n, i) => n + i.syllabi, 0);
  return [...rows.values()].sort((a, b) => total(b) - total(a) || a.school.localeCompare(b.school));
}
